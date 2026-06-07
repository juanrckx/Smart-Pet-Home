/**
 * backend/routes/puerta.js
 *
 * Historia 9:
 * Puerta automática con servomotor.
 *
 * Permite:
 * - Abrir puerta.
 * - Cerrar puerta.
 * - Abrir por cierto tiempo.
 * - Programar apertura automática cada cierto intervalo.
 */

const express = require('express');
const { randomUUID } = require ('crypto');

const router = express.Router();

const {
    leerJSON,
    escribirJSON,
    agregarElementoALista
} = require('../utils/fileUtils');

const {
    enviarComandoArduino,
    estaConectado
} = require('../arduino-connection');
const { type } = require('os');
const { clearInterval } = require('timers');

const ARCHIVO_PUERTA = 'puerta.json';
const ARCHIVO_EVENTOS = 'eventos.json';

const PUERTA_BASE ={
    estado: 'cerrada',
    programacion: {
        activa: false,
        intervalo_minutos: null,
        duracion_segundos: null
    },
    ultimo_cambio: null
};

let intervaloProgramado = null;

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function generarIdEvento(prefix = 'evento') {
    if (typeof randomUUID === 'function') {
        return `${prefix}_${randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

function obtenerTimestamp() {
    return new Date().toISOString();
}

function validarNumero(valor, nombre, minimo, maximo) {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        const error = new Error(`${nombre} debe ser un número válido`);
        error.statusCode = 400;
        throw error;
    }

    if (numero < minimo || numero > maximo) {
        const error = new Error(`${nombre} debe estar entre ${minimo} y ${maximo}`);
        error.statusCode = 400;
        throw error;
    }

    return numero;
}

async function enviarArduino(comando, respuestaEsperada) {
    const ok = await enviarComandoArduino(comando, respuestaEsperada);

    if (!ok) {
        const error = new Error('No se pudo comunicar con Arduino');
        error.statusCode = 503;
        throw error;
    }

    return {
        success: true,
        comando
    };
}

async function obtenerEstadoPuerta() {
    return leerJSON(ARCHIVO_PUERTA, PUERTA_BASE);
}

async function guardarEstadoPuerta(cambios) {
    const estadoActual = await obtenerEstadoPuerta();

    const nuevoEstado = {
        ...estadoActual,
        ...cambios,
        ultimo_cambio: obtenerTimestamp()
    };

    await escribirJSON(ARCHIVO_PUERTA, nuevoEstado);

    return nuevoEstado;
}

async function registrarEvento(evento) {
    const eventoFinal = {
        id: generarIdEvento('evento'),
        timestamp: obtenerTimestamp(),
        dispositivo: 'puerta_automatica',
        dispositivo_nombre: 'Puerta automática',
        tipo: 'actuador',
        categoria: 'puerta',
        ...evento
    };

    await agregarElementoALista(ARCHIVO_EVENTOS, 'eventos', eventoFinal);

    return eventoFinal;
}

async function abrirPuerta(origen = 'web') {
    const arduino = await enviarArduino('DOOR_OPEN', 'DOOR:OPEN');

    const estado = await guardarEstadoPuerta({
        estado: 'Abierta'
    });

    const evento = await registrarEvento({
        accion: 'abrir_puerta',
        origen,
        mensaje: 'Puerta abierta'
    });

    return {
        success: true,
        message: 'Puerta abierta correctamente',
        estado,
        evento,
        arduino
    };
}

async function cerrarPuerta(origen = 'web') {
    const arduino = await enviarArduino('DOOR_CLOSE', 'DOOR:CLOSE');

    const estado = await guardarEstadoPuerta({
        estado: 'Cerrada'
    });

    const evento = await registrarEvento({
        accion: 'cerrar_puerta',
        origen,
        mensaje: 'Puerta cerrada'
    });

    return {
        success: true,
        message: 'Puerta cerrada correctamente',
        estado,
        evento,
        arduino
    };
}

async function abrirPuertaTemporal(duracionMs, origen = 'web') {
    const arduino = await enviarArduino(`DOOR_OPEN_FOR:${duracionMs}`, 'DOOR:OK');

    const estado = await guardarEstadoPuerta({
        estado: 'cerrada'
    });

    const evento = await registrarEvento({
        accion: 'abrir_puerta_temporal',
        origen,
        duracion_ms: duracionMs,
        duracion_s: Math.round(duracionMs / 1000),
        mensaje: `Puerta abierta temporalmente por ${Math.round(duracionMs / 1000)} segundos`
    });

    return {
        success: true,
        message: `Puerta abierta por ${Math.round(duracionMs / 1000)} segundos`,
        estado,
        evento,
        arduino
    };
}

function detenerProgramacionInterna() {
    if (intervaloProgramado) {
        clearInterval(intervaloProgramado);
        intervaloProgramado = null;
    }
}

function iniciarProgramacion(intervaloMinutos, duracionSegundos) {
    detenerProgramacionInterna();

    const intervaloMs = intervaloMinutos * 60 * 1000;
    const duracionMs = duracionSegundos * 1000;

    intervaloProgramado = setInterval(async () => {
        try {
            await abrirPuertaTemporal(duracionMs, 'programacion');
        } catch (error) {
            console.error('[puerta.js] Error en programación:', error.message);
        }
    }, intervaloMs);
}

// ================================================================
// RUTAS
// ================================================================

router.get('/status', asyncHandler(async (req, res) => {
    const estado = await obtenerEstadoPuerta();

    res.json({
        success: true,
        ...estado,
        arduino_conectado: estaConectado(),
    });
}));

router.post('/abrir', asyncHandler(async (req, res) => {
    const resultado = await abrirPuerta('web');
    res.json(resultado);
}));

router.post('/cerrar', asyncHandler(async (req, res) => {
    const resultado = await cerrarPuerta('web');
    res.json(resultado);
}));

router.post('/abrir-temporal', asyncHandler(async (req, res) => {
    const segundos = validarNumero(
        req.body.segundos ?? req.body.duracionSegundos ?? 3,
        'La duración',
        1,
        60
    );

    const resultado = await abrirPuertaTemporal(segundos * 1000, 'web');

    res.json(resultado);
}));

router.post('/programar', asyncHandler(async (req, res) => {
    const intervaloMinutos = validarNumero(
        req.body.intervaloMinutos,
        'El intervalo en minutos',
        1,
        1440
    );

    const duracionSegundos = validarNumero(
        req.body.duracionSegundos,
        'La duración en segundos',
        1,
        60
    );

    iniciarProgramacion(intervaloMinutos, duracionSegundos);

    const estado = await guardarEstadoPuerta({
        programacion: {
            activa: true,
            intervalo_minutos: intervaloMinutos,
            duracion_segundos: duracionSegundos
        }
    });

    const evento = await registrarEvento({
        accion: 'programar_puerta',
        intervalo_minutos: intervaloMinutos,
        duracion_segundos: duracionSegundos,
        mensaje: `Puerta programada cada ${intervaloMinutos} minutos por ${duracionSegundos} segundos`
    });

    res.json({
        success: true,
        message: 'Programación de puerta guardada',
        estado,
        evento
    });
}));

router.post('/detener-programacion', asyncHandler(async (req, res) => {
    detenerProgramacionInterna();

    const estado = await guardarEstadoPuerta({
        programacion: {
            activa: false,
            intervalo_minutos: null,
            duracion_segundos: null
        }
    });

    const evento = await registrarEvento({
        accion: 'detener_programacion_puerta',
        mensaje: 'Programación de puerta detenida'
    });

    res.json({
        success: true,
        message: 'Programación detenida',
        estado,
        evento
    });
}));

router.use((err, req, res, next) => {
    console.error('[puerta.js]', err.message);

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Error interno en puerta'
    });
});

module.exports = router;
