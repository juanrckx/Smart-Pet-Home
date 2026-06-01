/**
 * arduino-connection.js
 * 
 * Gestiona la conexión serial con el Arduino
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { obtenerPuertoArduino } = require('./utils/arduino-detection');

// =============== ESTADO INTERNO ===============
let puertoArduino = null;
let parser = null;
let conectado = false;

// Mapa de callbacks en espera: { 'dispense': resolveFn, 'water': resolveFn, ... }
const callbacksEnEspera = {};

// Cuánto tiempo esperar la respuesta del Arduino antes de dar error (ms)
const TIEMPO_ESPERA_RESPUESTA = 8000;

// Cada cuánto intentar reconectar si se pierde la conexión (ms)
const TIEMPO_REINTENTO_RECONEXION = 5000;

// =============== CONEXIÓN ===============

/**
 * Inicializa la conexión con el Arduino.. Llamar una vez al arrancar el servidor.
 * Si falla, seguirá intentando reconectar cada TIEMPO_REINTENTO_RECONEXION ms.
 */
async function iniciarConexionArduino() {
    try {
        const puerto = await obtenerPuertoArduino();

        if (!puerto) {
            console.error('[arduino-connection] No se pudo encontrar el puerto del Arduino. Reintentando en unos segundos...');
            setTimeout(iniciarConexionArduino, TIEMPO_REINTENTO_RECONEXION);
            return;
        }

        console.log(`[arduino-connection] Intentando conectar al Arduino en ${puerto}...`);
        puertoArduino = new SerialPort({ path: puerto, baudRate: 9600 });

        parser = puertoArduino.pipe(new ReadlineParser({ delimiter: '\n' }));

        // ---- Eventos del puerto ----

        puertoArduino.on('open', () => {
            conectado = true;
            console.log('[arduino-connection] Conexión con Arduino establecida.');
        });

        puertoArduino.on('close', () => {
            conectado = false;
            console.warn('[arduino-connection] Conexión con Arduino cerrada. Intentando reconectar...');
            _rechazarCallbacksPendientes('Conexión perdida');
            setTimeout(iniciarConexionArduino, TIEMPO_REINTENTO_RECONEXION);
        });

        puertoArduino.on('error', (err) => {
            conectado = false;
            console.error('[arduino-connection] Error en la conexión con Arduino:', err.message);
        });

        parser.on('data', _procesarRespuesta);
    } catch (error) {
        console.error('[arduino-connection] Error al iniciar la conexión con Arduino:', error);
        setTimeout(iniciarConexionArduino, TIEMPO_REINTENTO_RECONEXION);
    }
}

// =============== COMANDOS ===============

/**
 * Envía un comando al Arduino y espera su respuesta. "PREFIJO: OK"
 * @param {string} comando - El comando a enviar
 * @param {string} [esperarRespuesta] - El prefijo que se espera en la respuesta (ej: "FOOD", "WATER")
 * @returns {Promise<boolean>}
 */

function enviarComandoArduino(comando, esperarRespuesta = null) {
    return new Promise((resolve) => {

        if (!puertoArduino || !puertoArduino.isOpen || !conectado) {
            console.error('[arduino-connection] No se puede enviar comando, Arduino no conectado.');
            return resolve(false);
        }

        // Inferir a clave de respuesta según el comando
        // DISPENSE, WATER, TEST
        const claveEspera = esperarRespuesta || _inferirClaveRespuesta(comando);

        console.log(`[arduino-connection] Enviando comando al Arduino: "${comando}" (esperando respuesta: "${claveEspera}")`);

        // Registrar callback ANTES de escribir para no perder respuestas rápidas
        let timeoutId;

        callbacksEnEspera[claveEspera] = () => {
            clearTimeout(timeoutId);
            delete callbacksEnEspera[claveEspera];
            resolve(true);
        };

        // Timeout de seguridad
        timeoutId = setTimeout(() => {
            if (callbacksEnEspera[claveEspera]) {
                delete callbacksEnEspera[claveEspera];
                console.error(`[arduino-connection] Timeout esperando respuesta "${claveEspera}" del Arduino.`);
                resolve(false);
            }
        }, TIEMPO_ESPERA_RESPUESTA);

        // Enviar el comando al Arduino
        puertoArduino.write(comando + '\n', (err) => {
            if (err) {
                clearTimeout(timeoutId);
                delete callbacksEnEspera[claveEspera];
                console.error('[arduino-connection] Error al enviar comando al Arduino:', err.message);
                return resolve(false);
            }
        }); 
    });
}

// =============== FUNCIONES INTERNAS ===============

function _procesarRespuesta(lineaRaw) {
    const linea = lineaRaw.trim();
    if (!linea) return;

    console.log(`[Arduino <-] ${linea}`);

    // Revisar si algún callback en espera conincide con esta línea
    for (const clave of Object.keys(callbacksEnEspera)) {
        if (linea.startsWith(clave)) {
            callbacksEnEspera[clave]();
            return;
        }
    }

    // Mensaje informativos del Arduino
    if (linea === 'ARDUINO_READY') {
        console.log('[arduino-connection] Arduino reporta que está listo.');
    }
}

function _inferirClaveRespuesta(comando) {
   const MAPA_RESPUESTAS ={
       'DISPENSE': 'DISPENSE:OK',
       'WATER': 'WATER:OK',
       'TEST_SERVO': 'TEST:COMPLETADO'
   };

   const prefijo = comando.split(':')[0].split('_')[0]; // Ej: "DISPENSE:5000" -> "DISPENSE"
   if (MAPA_RESPUESTAS[comando]) return MAPA_RESPUESTAS[comando];
   return MAPA_RESPUESTAS[prefijo] || `${prefijo}:OK`;
}

function _rechazarCallbacksPendientes(mensaje) {
    const claves = Object.keys(callbacksEnEspera);
    if (claves.length === 0) return;

    console.warn(`[arduino-connection] Rechazando ${claves.length} callbacks pendientes: ${mensaje}`);
    claves.forEach(clave => {
        delete callbacksEnEspera[clave];
    });
}

function estaConectado() {
    return conectado && puertoArduino?.isOpen === true;
}

module.exports = {
    iniciarConexionArduino,
    enviarComandoArduino,
    estaConectado
};