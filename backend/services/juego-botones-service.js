const { randomUUID } = require('crypto');

const {
    leerJSON,
    escribirJSON,
    agregarElementoALista
} = require ('../utils/fileUtils');

const {
    enviarComandoArduino,
    estaConectado
} = require ('../arduino-connection');

const ARCHIVO_JUEGO = 'juego-botones.json';
const ARCHIVO_EVENTOS = 'eventos.json';

const TOTAL_BOTONES = 5;
const DURACION_SERVO_PREMIO_MS = 1200;

const DEBUG_JUEGO = process.env.DEBUG_JUEGO === 'true';

const JUEGO_BASE = {
    fecha: null,
    botonGanador: null,
    premioEntregado: false,
    totalIntentos: 0,
    intentos: []
};

class AppError extends Error {
    constructor(message, statusCode= 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

function generarId(prefix = 'juego') {
    if (typeof randomUUID === 'function') {
        return `${prefix}_${randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

function obtenerTimestamp() {
    return new Date().toISOString();
}

function obtenerFecha() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Costa_Rica',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function obtenerProximoReinicio() {
    const ahora = new Date();

    const fechaCR = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Costa_Rica',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(ahora);

    const proximoReinicio = new Date(`${fechaCR}T06:00:00.000Z`);
    proximoReinicio.setUTCDate(proximoReinicio.getUTCDate() + 1);

    return proximoReinicio;
}

function obtenerSegundosRestantesParaPremio() {
    const ahora = new Date();
    const proximo = obtenerProximoReinicio();

    return Math.max(0, Math.floor((proximo.getTime() - ahora.getTime()) / 1000));
}

function elegirBotonGanador() {
    return Math.floor(Math.random() * TOTAL_BOTONES) + 1;
}

function validarBoton(valor) {
    const boton = Number(valor);

    if (!Number.isInteger(boton)) {
        throw new AppError('El botón debe ser un número entero', 400);
    }

    if (boton < 1 || boton > TOTAL_BOTONES) {
        throw new AppError(`El botón debe estar entre 1 y ${TOTAL_BOTONES}`, 400);
    }

    return boton;
}

class JuegoBotonesRepository {
    async obtenerEstado() {
        const data = await leerJSON(ARCHIVO_JUEGO, JUEGO_BASE);

        return {
            ...JUEGO_BASE,
            ...(data || {})
        };
    }

    async guardarEstado(estado) {
        const guardado= await escribirJSON(ARCHIVO_JUEGO, estado);

        if (!guardado) {
            throw new AppError('No se pudo guardar el estado del juego', 500);
        }

        return estado;
    }

    async obtenerEstadoDelDia() {
        const estadoActual = await this.obtenerEstado();
        const fechaHoy = obtenerFecha();

        if (estadoActual.fecha !== fechaHoy) {
            const nuevoEstado = {
                fecha: fechaHoy,
                botonGanador: elegirBotonGanador(),
                premioEntregado: false,
                totalIntentos: 0,
                intentos: [],
                creado_en: obtenerTimestamp(),
                actualizado_en: obtenerTimestamp()
            };

            await this.guardarEstado(nuevoEstado);
            return nuevoEstado;
        }

        return estadoActual;
    }

    async registrarIntento(intento) {
        const estado =await this.obtenerEstadoDelDia();

        const intentoFinal = {
            id: generarId('intento'),
            timestamp: obtenerTimestamp(),
            ...intento
        };

        const actualizado = {
            ...estado,
            totalIntentos: Number(estado.totalIntentos || 0) + 1,
            intentos: [
                intentoFinal,
                ...(Array.isArray(estado.intentos) ? estado.intentos : [])
            ].slice(0, 100),
            actualizado_en: obtenerTimestamp()
        };

        if (intento.premioEntregadoAhora) {
            actualizado.premioEntregado = true;
            actualizado.premio_entregado_en = obtenerTimestamp();
        }

        await this.guardarEstado(actualizado)

        return {
            estado: actualizado,
            intento: intentoFinal
        };
    }

    async reiniciarEstadoDelDia() {
        const fechaHoy = obtenerFecha();

        const nuevoEstado = {
            fecha: fechaHoy,
            botonGanador: elegirBotonGanador(),
            premioEntregado: false,
            totalIntentos: 0,
            intentos: [],
            creado_en: obtenerTimestamp(),
            reiniciado_manual: true
        };

        await this.guardarEstado(nuevoEstado);

        return nuevoEstado;
    }
}

class EventoRepository {
    async registrar(evento) {
        const eventoFinal = {
            id: generarId('evento'),
            timestamp: obtenerTimestamp(),
            dispositivo: 'juego_botones',
            dispositivo_nombre: 'Juego de botones',
            tipo: 'juego',
            categoria: 'premio',
            ...evento
        };

        await agregarElementoALista(ARCHIVO_EVENTOS, 'eventos', eventoFinal);

        return eventoFinal;
    }

}

class ArduinoGateway {
    estaDisponible() {
        return estaConectado();
    }

    async enviar(comando, respuestaEsperada = null) {
        const resultado = await enviarComandoArduino(comando, respuestaEsperada);

        if (!resultado) {
            throw new AppError('No se pudo comunicar con Arduino', 503);
        }

        return {
            success: true,
            comando
        };
    }
}

class JuegoBotonesService {
    constructor({ juegoRepo, eventoRepo, arduino }) {
        this.juegoRepo = juegoRepo;
        this.eventoRepo = eventoRepo;
        this.arduino = arduino;
    }

    async obtenerEstadoPublico() {
        const estado = await this.juegoRepo.obtenerEstadoDelDia();

        const respuesta ={
            success: true,
            fecha: estado.fecha,
            total_botones: TOTAL_BOTONES,
            premio_entregado: Boolean(estado.premioEntregado),
            premio_disponible: !estado.premioEntregado,
            total_intentos: Number(estado.totalIntentos || 0),
            ultimos_intentos: (estado.intentos || []).slice(0, 10),
            arduino_conectado: this.arduino.estaDisponible(),
            segundos_restantes_premio: estado.premioEntregado
            ? obtenerSegundosRestantesParaPremio()
            : 0,
            proximo_premio_en: estado.premioEntregado
            ? obtenerProximoReinicio().toISOString()
            : null
        };

        if (DEBUG_JUEGO) {
            respuesta.boton_ganador_debug = estado.botonGanador;
        }

        return respuesta;
    }

    async jugar(payload) {
        const botonElegido = validarBoton(payload.boton ?? payload.button);
        const estado = await this.juegoRepo.obtenerEstadoDelDia();

        const botonGanador = Number(estado.botonGanador);
        const acerto = botonElegido === botonGanador;
        const premioYaEntregado = Boolean(estado.premioEntregado);
        const premioEntregadoAhora = acerto && !premioYaEntregado;

        let mensaje;
        let comandoResultado;

        if (acerto) {
            comandoResultado = await this.arduino.enviar(`GAME_WIN:${botonElegido}`, 'GAME:OK');

            if (premioEntregadoAhora) {
                await this.arduino.enviar(`REWARD:${DURACION_SERVO_PREMIO_MS}`, 'REWARD:OK');
                mensaje = `¡Ganó! Botón ${botonElegido}. Premio dispensado.`;
            } else {
                mensaje = `Ganó otra vez! Botón ${botonElegido}, pero el premio de hoy ya fue entregado.`;
            }
        } else{
            comandoResultado = await this.arduino.enviar(`GAME_LOSE:${botonElegido}`, 'GAME:OK');
            mensaje = `Botón ${botonElegido}: no era el ganador. Puede seguir intentando.`;
        }

        const { estado: estadoActualizado, intento } = await this.juegoRepo.registrarIntento({
            botonElegido,
            acerto,
            premioYaEntregado,
            premioEntregadoAhora,
            mensaje
        });

        const evento = await this.eventoRepo.registrar({
            accion: 'jugar_botones',
            boton_elegido: botonElegido,
            acerto,
            premio_ya_entregado: premioYaEntregado,
            premio_entregado_ahora: premioEntregadoAhora,
            premio_entregado: Boolean(estadoActualizado.premioEntregado),
            mensaje
        });

        const respuesta = {
            success: true,
            message: mensaje,
            boton_elegido: botonElegido,
            acerto,
            premio_entregado_ahora: premioEntregadoAhora,
            premio_disponible: !estadoActualizado.premioEntregado,
            total_intentos: estadoActualizado.totalIntentos,
            intento,
            evento,
            arduino: comandoResultado
        };

        if (DEBUG_JUEGO) {
            respuesta.boton_ganador_debug = botonGanador;
        }

        return respuesta;
    }

    async entregarPremioManual() {
        const resultadoArduino = await this.arduino.enviar(
            `REWARD:${DURACION_SERVO_PREMIO_MS}`,
            'REWARD:OK'
        );

        const evento = await this.eventoRepo.registrar({
            accion: 'premio_manual',
            mensaje: 'Premio dispensado manualmente desde el software'
        });

        return {
            success: true,
            message: 'Premio dispensado manualmente',
            evento,
            arduino: resultadoArduino
        };
    }

    async reiniciarDia() {
        const estado = await this.juegoRepo.reiniciarEstadoDelDia();

        await this.arduino.enviar('GAME_RESET_LEDS', 'GAME:OK');

        const evento = await this.eventoRepo.registrar({
            accion: 'reiniciar_juego_botones',
            mensaje: 'juego de botones reiniciado manualmente'
        });

        const respuesta = {
            success: true,
            message: 'Juego reiniciado para el día actual',
            fecha: estado.fecha,
            premio_entregado: estado.premioEntregado,
            total_intentos: estado.totalIntentos,
            evento
        };

        if (DEBUG_JUEGO) {
            respuesta.boton_ganador_debug = estado.botonGanador;
        }

        return respuesta;
    }

    async obtenerHistorial(limite = 20) {
        const estado = await this.juegoRepo.obtenerEstadoDelDia();

        return {
            success: true,
            fecha: estado.fecha,
            total: (estado.intentos || []).length,
            intentos: (estado.intentos || []).slice(0, limite)
        };
    }
}

function crearJuegoBotonesService() {
    return new JuegoBotonesService({
        juegoRepo: new JuegoBotonesRepository(),
        eventoRepo: new EventoRepository(),
        arduino: new ArduinoGateway()
    });
}

module.exports = {
    crearJuegoBotonesService,
    JuegoBotonesService
};