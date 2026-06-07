/**
 * backend/arduino-connection.js
 *
 * Gestiona la conexión serial con Arduino.
 *
 * Responsabilidades:
 * - Detectar puerto Arduino.
 * - Abrir conexión serial.
 * - Enviar comandos a Arduino.
 * - Esperar respuestas como DISPENSE:OK, WATER:OK, GAME:OK, etc.
 * - Notificar al servidor cuando Arduino envía eventos como:
 *   GAME_BUTTON:3
 *   TEMP:24.5
 *   PRESENCE:1
 */

let SerialPort;
let ReadlineParser;

try {
    ({ SerialPort } = require('serialport'));
    ({ ReadlineParser } = require('@serialport/parser-readline'));
} catch (error) {
    console.error(
        '[arduino-connection] No se pudieron cargar serialport o @serialport/parser-readline:',
        error.message
    );

    SerialPort = null;
    ReadlineParser = null;
}

const {
    obtenerPuertoArduino
} = require('./utils/arduino-detection');

// ================================================================
// ESTADO INTERNO
// ================================================================

let puertoArduino = null;
let parser = null;
let conectado = false;
let intentandoReconectar = false;

const callbacksEnEspera = new Map();
const manejadoresLineaSerial = new Set();

const BAUD_RATE = 9600;
const TIEMPO_ESPERA_RESPUESTA_MS = 8000;
const TIEMPO_REINTENTO_MS = 5000;

// ================================================================
// CONEXIÓN
// ================================================================

async function iniciarConexionArduino() {
    if (!SerialPort || !ReadlineParser) {
        console.warn('[arduino-connection] SerialPort no está disponible.');
        return;
    }

    if (conectado || intentandoReconectar) {
        return;
    }

    try {
        const puerto = await obtenerPuertoArduino();

        if (!puerto) {
            console.warn('[arduino-connection] No se encontró Arduino. Reintentando...');

            intentandoReconectar = true;

            setTimeout(() => {
                intentandoReconectar = false;
                iniciarConexionArduino();
            }, TIEMPO_REINTENTO_MS);

            return;
        }

        console.log(`[arduino-connection] Intentando conectar Arduino en ${puerto}...`);

        puertoArduino = new SerialPort({
            path: puerto,
            baudRate: BAUD_RATE,
            autoOpen: false
        });

        parser = puertoArduino.pipe(new ReadlineParser({
            delimiter: '\n'
        }));

        puertoArduino.open((error) => {
            intentandoReconectar = false;

            if (error) {
                conectado = false;

                console.error(
                    '[arduino-connection] Error al abrir puerto:',
                    error.message
                );

                setTimeout(iniciarConexionArduino, TIEMPO_REINTENTO_MS);
            }
        });

        puertoArduino.on('open', () => {
            conectado = true;
            intentandoReconectar = false;

            console.log('[arduino-connection] Arduino conectado correctamente.');
        });

        puertoArduino.on('close', () => {
            conectado = false;

            console.warn('[arduino-connection] Arduino desconectado.');

            limpiarCallbacksPendientes();

            setTimeout(iniciarConexionArduino, TIEMPO_REINTENTO_MS);
        });

        puertoArduino.on('error', (error) => {
            conectado = false;

            console.error('[arduino-connection] Error serial:', error.message);
        });

        parser.on('data', procesarLineaSerial);
    } catch (error) {
        conectado = false;
        intentandoReconectar = false;

        console.error(
            '[arduino-connection] Error al iniciar conexión:',
            error.message
        );

        setTimeout(iniciarConexionArduino, TIEMPO_REINTENTO_MS);
    }
}

// ================================================================
// ENVÍO DE COMANDOS
// ================================================================

function enviarComandoArduino(comando, esperarRespuesta = null) {
    return new Promise((resolve) => {
        const respuestaEsperada = esperarRespuesta || inferirRespuestaEsperada(comando);

        if (!puertoArduino || !puertoArduino.isOpen || !conectado) {
            console.error(
                `[arduino-connection] No se puede enviar "${comando}". Arduino no conectado.`
            );

            resolve(false);
            return;
        }

        const timeoutId = setTimeout(() => {
            callbacksEnEspera.delete(respuestaEsperada);

            console.error(
                `[arduino-connection] Timeout esperando "${respuestaEsperada}" para "${comando}".`
            );

            resolve(false);
        }, TIEMPO_ESPERA_RESPUESTA_MS);

        callbacksEnEspera.set(respuestaEsperada, () => {
            clearTimeout(timeoutId);
            callbacksEnEspera.delete(respuestaEsperada);
            resolve(true);
        });

        console.log(`[Arduino ->] ${comando}`);

        puertoArduino.write(`${comando}\n`, (error) => {
            if (error) {
                clearTimeout(timeoutId);
                callbacksEnEspera.delete(respuestaEsperada);

                console.error(
                    '[arduino-connection] Error al escribir en serial:',
                    error.message
                );

                resolve(false);
            }
        });
    });
}

// ================================================================
// LECTURA SERIAL
// ================================================================

function procesarLineaSerial(lineaRaw) {
    const linea = String(lineaRaw || '').trim();

    if (!linea) {
        return;
    }

    console.log(`[Arduino <-] ${linea}`);

    /**
     * Primero revisamos si la línea recibida es una respuesta
     * a un comando que Node envió.
     *
     * Ejemplos:
     * - DISPENSE:OK
     * - WATER:OK
     * - GAME:OK
     * - REWARD:OK
     */
    if (callbacksEnEspera.has(linea)) {
        callbacksEnEspera.get(linea)();
        return;
    }

    /**
     * A veces una respuesta puede venir con información adicional.
     * Por eso también aceptamos startsWith().
     */
    for (const [clave, callback] of callbacksEnEspera.entries()) {
        if (linea.startsWith(clave)) {
            callback();
            return;
        }
    }

    /**
     * Si no era respuesta a un comando, es un evento espontáneo
     * enviado desde Arduino.
     *
     * Ejemplos:
     * - GAME_BUTTON:3
     * - TEMP:24.5
     * - PRESENCE:1
     */
    notificarManejadoresLineaSerial(linea);
}

async function notificarManejadoresLineaSerial(linea) {
    for (const handler of manejadoresLineaSerial) {
        try {
            await handler(linea);
        } catch (error) {
            console.error(
                '[arduino-connection] Error en manejador de línea serial:',
                error.message
            );
        }
    }
}

function registrarManejadorLineaSerial(handler) {
    if (typeof handler !== 'function') {
        throw new Error('El manejador serial debe ser una función');
    }

    manejadoresLineaSerial.add(handler);

    return () => {
        manejadoresLineaSerial.delete(handler);
    };
}

// ================================================================
// RESPUESTAS ESPERADAS
// ================================================================

function inferirRespuestaEsperada(comando) {
    if (comando.startsWith('DISPENSE:')) {
        return 'DISPENSE:OK';
    }

    if (comando.startsWith('WATER:')) {
        return 'WATER:OK';
    }

    if (comando.startsWith('REWARD:')) {
        return 'REWARD:OK';
    }

    if (comando.startsWith('GAME_WIN:')) {
        return 'GAME:OK';
    }

    if (comando.startsWith('GAME_LOSE:')) {
        return 'GAME:OK';
    }

    if (comando.startsWith('GAME_LED:')) {
        return 'GAME:OK';
    }

    if (comando === 'GAME_RESET_LEDS') {
        return 'GAME:OK';
    }

    if (comando === 'DOOR_OPEN') return 'DOOR:OPEN';
    if (comando === 'DOOR_CLOSE') return 'DOOR:CLOSE';
    if (comando.startsWith('DOOR_OPEN_FOR:')) return 'DOOR:OK';

    if (comando.startsWith('BUZZER_PLAY:')) return 'BUZZER:OK';
    if (comando === 'LCD_VIDEO_ON') return 'LCD:OK';
    if (comando === 'LCD_VIDEO_OFF') return 'LCD:OK';
    if (comando.startsWith('LCD_TEXT:')) return 'LCD:OK';

    if (comando.startsWith('BALL_LAUNCH:')) {
        return 'BALL:LAUNCH:OK';
    }
    
    if (comando === 'BALL_STOP') {
        return 'BALL:STOP:OK';
    }

    if (comando === 'PING') {
        return 'PONG';
    }

    if (comando === 'TEST_SERVO') {
        return 'TEST:COMPLETADO';
    }

    return 'OK';
}

function limpiarCallbacksPendientes() {
    callbacksEnEspera.clear();
}

function estaConectado() {
    return conectado && puertoArduino?.isOpen === true;
}

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
    iniciarConexionArduino,
    enviarComandoArduino,
    estaConectado,
    registrarManejadorLineaSerial
};