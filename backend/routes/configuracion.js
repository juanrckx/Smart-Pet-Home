/**
 * backend/routes/configuracion.js
 *
 * Configuración general de Smart Pet Home.
 */

const express = require('express');

const router = express.Router();

const {
    leerJSON,
    escribirJSON,
    agregarElementoALista
} = require('../utils/fileUtils');

const ARCHIVO_CONFIGURACION = 'configuracion.json';
const ARCHIVO_EVENTOS = 'eventos.json';

const CONFIGURACION_BASE = {
    comida: {
        gramosPorDefecto: 100,
        minimoGramos: 10,
        maximoGramos: 500,
        tiempoDispensaMs: 5000
    },
    agua: {
        duracionPorDefectoMs: 3000,
        duracionMinimaMs: 1000,
        duracionMaximaMs: 10000
    },
    temperatura: {
        minima: 18,
        maxima: 30,
        alertasActivas: true
    },
    comunicacion: {
        buzzerDuracionDefectoMs: 1500,
        lcdLinea1: 'SMART PET HOME',
        lcdLinea2: 'VIDEO EN VIVO',
        lcdLinea3: 'Mascota online :)',
        lcdLinea4: 'Sistema activo'
    },
    juego: {
        totalBotones: 4,
        duracionPremioMs: 1200
    },
    lanzador: {
        cantidadDefecto: 5,
        cantidadMaxima: 5
    },
    sistema: {
        modoDefensa: true,
        moduloDemo: '',
        notas: 'Cerrar Serial Monitor antes de iniciar Node.js.'
    }
};

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

function obtenerTimestamp() {
    return new Date().toISOString();
}

function mezclarConfiguracion(base, actual) {
    return {
        comida: {
            ...base.comida,
            ...(actual.comida || {})
        },
        agua: {
            ...base.agua,
            ...(actual.agua || {})
        },
        temperatura: {
            ...base.temperatura,
            ...(actual.temperatura || {})
        },
        comunicacion: {
            ...base.comunicacion,
            ...(actual.comunicacion || {})
        },
        juego: {
            ...base.juego,
            ...(actual.juego || {})
        },
        lanzador: {
            ...base.lanzador,
            ...(actual.lanzador || {})
        },
        sistema: {
            ...base.sistema,
            ...(actual.sistema || {})
        }
    };
}

async function obtenerConfiguracion() {
    const actual = await leerJSON(ARCHIVO_CONFIGURACION, CONFIGURACION_BASE);
    const configuracion = mezclarConfiguracion(CONFIGURACION_BASE, actual || {});

    await escribirJSON(ARCHIVO_CONFIGURACION, configuracion);

    return configuracion;
}

function validarNumero(valor, nombreCampo, minimo, maximo) {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        throw new AppError(`${nombreCampo} debe ser un número válido`, 400);
    }

    if (numero < minimo || numero > maximo) {
        throw new AppError(`${nombreCampo} debe estar entre ${minimo} y ${maximo}`, 400);
    }

    return numero;
}

function validarTexto(valor, nombreCampo, max = 200) {
    const texto = String(valor ?? '').trim();

    if (texto.length > max) {
        throw new AppError(`${nombreCampo} no puede superar ${max} caracteres`, 400);
    }

    return texto;
}

function limitarLCD(texto) {
    return validarTexto(texto, 'Texto LCD', 20)
        .replaceAll('|', ' ')
        .replaceAll('\n', ' ')
        .replaceAll('\r', ' ');
}

function validarConfiguracion(payload = {}) {
    const actual = mezclarConfiguracion(CONFIGURACION_BASE, payload);

    return {
        comida: {
            gramosPorDefecto: validarNumero(actual.comida.gramosPorDefecto, 'Gramos por defecto', 10, 500),
            minimoGramos: validarNumero(actual.comida.minimoGramos, 'Mínimo de gramos', 1, 500),
            maximoGramos: validarNumero(actual.comida.maximoGramos, 'Máximo de gramos', 10, 1000),
            tiempoDispensaMs: validarNumero(actual.comida.tiempoDispensaMs, 'Tiempo de dispensación', 300, 20000)
        },
        agua: {
            duracionPorDefectoMs: validarNumero(actual.agua.duracionPorDefectoMs, 'Duración por defecto del agua', 500, 20000),
            duracionMinimaMs: validarNumero(actual.agua.duracionMinimaMs, 'Duración mínima del agua', 300, 10000),
            duracionMaximaMs: validarNumero(actual.agua.duracionMaximaMs, 'Duración máxima del agua', 1000, 30000)
        },
        temperatura: {
            minima: validarNumero(actual.temperatura.minima, 'Temperatura mínima', -10, 60),
            maxima: validarNumero(actual.temperatura.maxima, 'Temperatura máxima', -10, 60),
            alertasActivas: Boolean(actual.temperatura.alertasActivas)
        },
        comunicacion: {
            buzzerDuracionDefectoMs: validarNumero(actual.comunicacion.buzzerDuracionDefectoMs, 'Duración del buzzer', 200, 10000),
            lcdLinea1: limitarLCD(actual.comunicacion.lcdLinea1),
            lcdLinea2: limitarLCD(actual.comunicacion.lcdLinea2),
            lcdLinea3: limitarLCD(actual.comunicacion.lcdLinea3),
            lcdLinea4: limitarLCD(actual.comunicacion.lcdLinea4)
        },
        juego: {
            totalBotones: 4,
            duracionPremioMs: validarNumero(actual.juego.duracionPremioMs, 'Duración del premio', 300, 5000)
        },
        lanzador: {
            cantidadDefecto: validarNumero(actual.lanzador.cantidadDefecto, 'Cantidad por defecto de pelotas', 1, 5),
            cantidadMaxima: 5
        },
        sistema: {
            modoDefensa: Boolean(actual.sistema.modoDefensa),
            moduloDemo: validarTexto(actual.sistema.moduloDemo, 'Módulo demo', 60),
            notas: validarTexto(actual.sistema.notas, 'Notas', 500)
        }
    };
}

async function registrarEvento(accion, mensaje) {
    const evento = {
        id: `evento_${Date.now()}_${Math.round(Math.random() * 100000)}`,
        timestamp: obtenerTimestamp(),
        dispositivo: 'sistema',
        dispositivo_nombre: 'Configuración',
        tipo: 'sistema',
        categoria: 'configuracion',
        accion,
        mensaje
    };

    await agregarElementoALista(ARCHIVO_EVENTOS, 'eventos', evento);

    return evento;
}

router.get('/', asyncHandler(async (req, res) => {
    const configuracion = await obtenerConfiguracion();

    res.json({
        success: true,
        configuracion
    });
}));

router.put('/', asyncHandler(async (req, res) => {
    const configuracion = validarConfiguracion(req.body);

    if (configuracion.temperatura.minima >= configuracion.temperatura.maxima) {
        throw new AppError('La temperatura mínima debe ser menor que la máxima', 400);
    }

    if (configuracion.comida.minimoGramos > configuracion.comida.maximoGramos) {
        throw new AppError('El mínimo de comida no puede ser mayor que el máximo', 400);
    }

    if (configuracion.agua.duracionMinimaMs > configuracion.agua.duracionMaximaMs) {
        throw new AppError('La duración mínima del agua no puede superar la máxima', 400);
    }

    await escribirJSON(ARCHIVO_CONFIGURACION, configuracion);

    const evento = await registrarEvento(
        'guardar_configuracion',
        'Configuración general actualizada'
    );

    res.json({
        success: true,
        message: 'Configuración guardada correctamente',
        configuracion,
        evento
    });
}));

router.patch('/:seccion', asyncHandler(async (req, res) => {
    const seccion = req.params.seccion;
    const configuracionActual = await obtenerConfiguracion();

    if (!Object.prototype.hasOwnProperty.call(CONFIGURACION_BASE, seccion)) {
        throw new AppError(`La sección "${seccion}" no existe`, 404);
    }

    const configuracionNueva = {
        ...configuracionActual,
        [seccion]: {
            ...configuracionActual[seccion],
            ...req.body
        }
    };

    const configuracionValidada = validarConfiguracion(configuracionNueva);

    await escribirJSON(ARCHIVO_CONFIGURACION, configuracionValidada);

    const evento = await registrarEvento(
        'actualizar_configuracion',
        `Configuración actualizada: ${seccion}`
    );

    res.json({
        success: true,
        message: `Configuración de ${seccion} guardada correctamente`,
        configuracion: configuracionValidada,
        evento
    });
}));

router.post('/restablecer', asyncHandler(async (req, res) => {
    await escribirJSON(ARCHIVO_CONFIGURACION, CONFIGURACION_BASE);

    const evento = await registrarEvento(
        'restablecer_configuracion',
        'Configuración restablecida a valores por defecto'
    );

    res.json({
        success: true,
        message: 'Configuración restablecida correctamente',
        configuracion: CONFIGURACION_BASE,
        evento
    });
}));

router.use((err, req, res, next) => {
    console.error('[configuracion.js]', err.message);

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Error interno en configuración'
    });
});

module.exports = router;