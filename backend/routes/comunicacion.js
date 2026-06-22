/**
 * backend/routes/comunicacion.js
 *
 * Historia 6:
 * Simular comunicación con la mascota usando buzzer.
 *
 * Historia 5:
 * Simular cámara/video usando LCD 1602.
 */

const express = require('express');
const { randomUUID } = require('crypto');

const router = express.Router();

const {
    leerJSON,
    escribirJSON,
    agregarElementoALista
} = require('../utils/fileUtils')

const {
    enviarComandoArduino,
    estaConectado
} = require ('../arduino-connection');

const ARCHIVO_COMUNICACION = 'comunicacion.json';
const ARCHIVO_EVENTOS = 'eventos.json';

const COMUNICACION_BASE = {
    buzzer_ultimo_uso: null,
    video_activo: false,
    lcd_linea_1: '',
    lcd_linea_2: '',
    lcd_linea_3: '',
    lcd_linea_4: '',
    ultimo_cambio: null
};

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

function limpiarLCD(texto, max = 20) {
    return String(texto || '')
    .replaceAll('|', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('\r', ' ')
    .trim()
    .slice(0, max);
}
function obtenerLineasLCD(body = {}) {
    return {
        linea1: limpiarLCD(body.linea1 || 'SMART PET HOME'),
        linea2: limpiarLCD(body.linea2 || 'VIDEO EN VIVO'),
        linea3: limpiarLCD(body.linea3 || 'Mascota online :)'),
        linea4: limpiarLCD(body.linea4 || 'Sistema activo')
    };
}

function construirComandoLCD(lineas) {
    return `LCD_TEXT:${lineas.linea1}|${lineas.linea2}|${lineas.linea3}|${lineas.linea4}`;
}

async function obtenerEstadoComunicacion() {
    return leerJSON(ARCHIVO_COMUNICACION, COMUNICACION_BASE)
}

async function guardarEstadoComunicacion(cambios) {
    const estadoActual = await obtenerEstadoComunicacion();

    const nuevoEstado = {
        ...estadoActual,
        ...cambios,
        ultimo_cambio: obtenerTimestamp()
    };

    await escribirJSON(ARCHIVO_COMUNICACION, nuevoEstado);

    return nuevoEstado;
}

async function registrarEvento(evento) {
    const eventoFinal = {
        id: generarIdEvento('evento'),
        timestamp: obtenerTimestamp(),
        dispositivo: 'comunicacion',
        dispositivo_nombre: 'Comuniación mascota',
        tipo: 'actuador',
        categoria: 'comunicación',
        ...evento
    };

    await agregarElementoALista(ARCHIVO_EVENTOS, 'eventos', eventoFinal);

    return eventoFinal;
}

// ================================================================
// RUTAS
// ================================================================

router.get('/status', asyncHandler(async (req, res) => {
    const estado = await obtenerEstadoComunicacion();

    res.json({
        success: true,
        ...estado
    });
}));

router.post('/hablar', asyncHandler(async (req, res) => {
    const duracionMs = validarNumero(
        req.body.duracionMs ?? req.body.duracion ?? 1500,
        'La duración del buzzer',
        200,
        10000
    );

    const arduino = await enviarArduino(`BUZZER_PLAY:${duracionMs}`, 'BUZZER:STARTED');

    const estado = await guardarEstadoComunicacion({
        buzzer_ultimo_uso: obtenerTimestamp()
    });

    const evento = await registrarEvento({
        accion: 'hablar_mascota',
        duracion_ms: duracionMs,
        mensaje: `Buzzer activado por ${duracionMs} ms`
    });

    res.json({
        success: true,
        message: 'Mensaje enviado a la mascota',
        estado,
        evento,
        arduino
    });
}));

router.post('/video/encender', asyncHandler(async (req, res) => {
    const lineas = obtenerLineasLCD(req.body);
    const comando = construirComandoLCD(lineas);

    const arduino = await enviarArduino(comando, 'LCD:OK');

    const estado = await guardarEstadoComunicacion({
        video_activo: true,
        lcd_linea_1: lineas.linea1,
        lcd_linea_2: lineas.linea2,
        lcd_linea_3: lineas.linea3,
        lcd_linea_4: lineas.linea4
    });

    const evento = await registrarEvento({
        accion: 'encender_video',
        mensaje: 'Simulación de video activada',
        lcd_linea_1: lineas.linea1,
        lcd_linea_2: lineas.linea2,
        lcd_linea_3: lineas.linea3,
        lcd_linea_4: lineas.linea4
    });

    res.json({
        success: true,
        message: 'Video simulado activado',
        estado,
        evento,
        arduino
    });
}));

router.post('/video/apagar', asyncHandler(async (req, res) => {
    const lineas = {
        linea1: 'VIDEO APAGADO',
        linea2: 'Monitoreo pausado',
        linea3: 'Smart Pet Home',
        linea4: 'Sistema listo'
    };

    const comando = construirComandoLCD(lineas);
    const arduino = await enviarArduino(comando, 'LCD:OK');

    const estado = await guardarEstadoComunicacion({
        video_activo: false,
        lcd_linea_1: lineas.linea1,
        lcd_linea_2: lineas.linea2,
        lcd_linea_3: lineas.linea3,
        lcd_linea_4: lineas.linea4
    });

    const evento = await registrarEvento({
        accion: 'apagar_video',
        mensaje: 'Simulación de video apagada',
        lcd_linea_1: lineas.linea1,
        lcd_linea_2: lineas.linea2,
        lcd_linea_3: lineas.linea3,
        lcd_linea_4: lineas.linea4
    });

    res.json({
        success: true,
        message: 'Video simulado apagado',
        estado,
        evento,
        arduino
    });
}));

router.post('/lcd/texto', asyncHandler(async (req, res) => {
    const lineas = {
        linea1: limpiarLCD(req.body.linea1 || 'Smart Pet Home'),
        linea2: limpiarLCD(req.body.linea2 || 'Hola mascota'),
        linea3: limpiarLCD(req.body.linea3 || ''),
        linea4: limpiarLCD(req.body.linea4 || '')
    };

    const comando = construirComandoLCD(lineas);
    const arduino = await enviarArduino(comando, 'LCD:OK');

    const estado = await guardarEstadoComunicacion({
        lcd_linea_1: lineas.linea1,
        lcd_linea_2: lineas.linea2,
        lcd_linea_3: lineas.linea3,
        lcd_linea_4: lineas.linea4
    });

    const evento = await registrarEvento({
        accion: 'lcd_texto',
        mensaje: `LCD actualizado: ${lineas.linea1} / ${lineas.linea2} / ${lineas.linea3} / ${lineas.linea4}`,
        lcd_linea_1: lineas.linea1,
        lcd_linea_2: lineas.linea2,
        lcd_linea_3: lineas.linea3,
        lcd_linea_4: lineas.linea4
    });

    res.json({
        success: true,
        message: 'Texto enviado a LCD',
        estado,
        evento,
        arduino
    });
}));

router.use((err, req, res, next) => {
    console.error('[comunicacion.js]', err.message);

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Error interno en comunicación'
    });
});

module.exports = router;