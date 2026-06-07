/**
 * backend/routes/lanzador-pelotas.js
 *
 * Historia 10 y 11:
 * - Juego de lanzamiento de pelotas a distancia.
 * - Lanzamiento de al menos 5 pelotas.
 */

const express = require('express');
const { randomUUID } = require('crypto');

const router = express.Router();

const{ 
    leerJSON,
    escribirJSON,
    agregarElementoALista
} = require('../utils/fileUtils');

const {
    enviarComandoArduino,
    estaConectado
} = require('../arduino-connection');
const { timeStamp } = require('console');

const ARCHIVO_LANZADOR = 'lanzador-pelotas.json';
const ARCHIVO_EVENTOS = 'eventos.json';

const LANZADOR_BASE = {
    estado: 'listo',
    ultimo_lanzamiento: null,
    total_lanzamiento: 0,
    pelotas_lanzadas_total: 0,
    ultima_cantidad: 0,
    ultimo_cambio: null
};

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function generarId(prefix = 'evento') {
    if (typeof randomUUID === 'function') {
        return `${prefix}_${randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

function obtenerTimestamp() {
    return new Date().toISOString();
}

function validarCantidad(valor) {
    const cantidad = Number(valor);

    if (!Number.isInteger(cantidad)) {
        const error = new Error('La cantidad de pelotas debe ser un número entero');
        error.statusCode = 400;
        throw error;
    }

    if (cantidad < 1 || cantidad > 5) {
        const error = new Error('La cantidad de pelotas debe estar entre 1 y 5');
        error.statusCode = 400;
        throw error;
    }

    return cantidad;
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

async function obtenerEstadoLanzador() {
    return leerJSON(ARCHIVO_LANZADOR, LANZADOR_BASE);
}

async function guardarEstadoLanzador(cambios) {
    const estadoActual = await obtenerEstadoLanzador();

    const nuevoEstado = {
        ...estadoActual,
        ...cambios,
        ultimo_cambio: obtenerTimestamp()
    };

    await escribirJSON(ARCHIVO_LANZADOR, nuevoEstado);

    return nuevoEstado
}

async function registrarEvento(evento) {
    const eventoFinal = {
        id: generarId('evento'),
        timeStamp: obtenerTimestamp(),
        dispositivo: 'lanzador_pelotas',
        dispositivo_nombre: 'Lanzador de pelotas',
        tipo: 'juego',
        categoria: 'pelotas',
        ...evento
    };

    await agregarElementoALista(ARCHIVO_EVENTOS, 'eventos', eventoFinal);

    return eventoFinal;
}

// ================================================================
// RUTAS
// ================================================================

router.get('/status', asyncHandler(async (req, res) => {
    const estado = await obtenerEstadoLanzador();

    res.json({
        success: true,
        ...estado,
        arduino_conectado: estaConectado()
    });
}));

router.post('/lanzar', asyncHandler(async (req, res) => {
    const cantidad = validarCantidad(req.body.cantidad ?? 5);

    await guardarEstadoLanzador({
        estado: 'lanzando',
        ultima_cantidad: cantidad
    });

    const eventoInicio = await registrarEvento({
        accion: 'iniciar_lanzamiento_pelotas',
        cantidad,
        mensaje: `Lanzamiento iniciado: ${cantidad} pelota(s)`
    });

    const arduino = await enviarArduino(`BALL_LAUNCH:${cantidad}`, 'BALL:LAUNCH:OK');

    const estadoActual = await obtenerEstadoLanzador();

    const estado = await guardarEstadoLanzador({
        estado: 'listo',
        ultimo_lanzamiento: obtenerTimestamp(),
        total_lanzamientos: Number(estadoActual.total_lanzamientos || 0) + 1,
        pelotas_lanzadas_total: Number(estadoActual.pelotas_lanzadas_total || 0) + cantidad,
        ultima_cantidad: cantidad
    });

    const eventoFin = await registrarEvento({
        accion: 'finalizar_lanzamiento_pelotas',
        cantidad,
        mensaje: `Lanzamiento finalizado: ${cantidad} pelota(s)`
    });

    res.json({
        success: true,
        message: `${cantidad} pelota(s) lanzada(s) correctamente`,
        cantidad,
        estado,
        evento_inicio: eventoInicio,
        evento_fin: eventoFin,
        arduino
    });
}));

router.post('/detener', asyncHandler(async (req, res) => {
    const arduino = await enviarArduino('BALL_STOP', 'BALL:STOP:OK');

    const estado = await guardarEstadoLanzador({
        estado: 'detenido'
    });

    const evento = await registrarEvento({
        accion: 'detener_lanzador_pelotas',
        mensaje: 'Lanzador de pelotas detenido'
    });

    res.json({
        success: true,
        message: 'Lanzador detenido correctamente',
        estado,
        evento,
        arduino
    });
}));

router.use((err, req, res, next) => {
    console.error('[lanzador-pelotas.js]', err.message);

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Error interno en lanzador de pelotas'
    });
});

module.exports = router;