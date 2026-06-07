/**
 * backend/routes/eventos.js
 *
 * Historial centralizado de eventos.
 *
 * Este archivo permite:
 * - Listar eventos.
 * - Filtrar por dispositivo.
 * - Filtrar por tipo, categoría, acción o alerta.
 * - Ver un evento específico.
 * - Crear eventos manuales.
 * - Eliminar eventos.
 * - Obtener un resumen para dashboard.
 */

const express = require('express');
const { randomUUID } = require('crypto');

const router = express.Router();

const {
    leerJSON,
    escribirJSON
} = require('../utils/fileUtils');

const ARCHIVO_EVENTOS = 'eventos.json';

const EVENTOS_BASE = {
    eventos: []
};

// ================================================================
// UTILIDADES
// ================================================================

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

function generarIdEvento() {
    if (typeof randomUUID === 'function') {
        return randomUUID();
    }

    return `${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function obtenerTimestamp() {
    return new Date().toISOString();
}

function convertirBooleano(valor) {
    if (valor === undefined || valor === null || valor === '') return null;

    if (typeof valor === 'boolean') return valor;

    const texto = String(valor).toLowerCase().trim();

    if (['true', '1', 'si', 'sí', 'yes'].includes(texto)) return true;
    if (['false', '0', 'no'].includes(texto)) return false;

    return null;
}

function convertirLimite(valor, valorPorDefecto = 20, maximo = 200) {
    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero <= 0) {
        return valorPorDefecto;
    }

    return Math.min(Math.round(numero), maximo);
}

function convertirOffset(valor) {
    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero < 0) {
        return 0;
    }

    return Math.round(numero);
}

function convertirFecha(valor, nombre) {
    if (!valor) return null;

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        throw new AppError(`${nombre} no tiene una fecha válida`, 400);
    }

    return fecha;
}

function normalizarTexto(valor) {
    return String(valor || '').toLowerCase().trim();
}

function contieneTexto(evento, busqueda) {
    if (!busqueda) return true;

    const textoEvento = JSON.stringify(evento).toLowerCase();
    return textoEvento.includes(busqueda);
}

// ================================================================
// REPOSITORIO
// ================================================================

class EventoRepository {
    async listarTodos() {
        const data = (await leerJSON(ARCHIVO_EVENTOS, EVENTOS_BASE)) || EVENTOS_BASE;

        if (!Array.isArray(data.eventos)) {
            return [];
        }

        return data.eventos;
    }

    async guardarTodos(eventos) {
        if (!Array.isArray(eventos)) {
            throw new AppError('La lista de eventos debe ser un arreglo', 500);
        }

        const guardado = await escribirJSON(ARCHIVO_EVENTOS, {
            eventos
        });

        if (!guardado) {
            throw new AppError('No se pudieron guardar los eventos', 500);
        }
    }

    async crear(datosEvento) {
        const eventos = await this.listarTodos();

        const evento = {
            id: generarIdEvento(),
            timestamp: obtenerTimestamp(),
            ...datosEvento
        };

        eventos.push(evento);

        await this.guardarTodos(eventos);

        return evento;
    }

    async obtenerPorId(id) {
        const eventos = await this.listarTodos();
        return eventos.find((evento) => String(evento.id) === String(id)) || null;
    }

    async eliminarPorId(id) {
        const eventos = await this.listarTodos();

        const eventoEliminado = eventos.find((evento) => String(evento.id) === String(id));

        if (!eventoEliminado) {
            throw new AppError(`No existe un evento con id "${id}"`, 404);
        }

        const eventosFiltrados = eventos.filter((evento) => String(evento.id) !== String(id));

        await this.guardarTodos(eventosFiltrados);

        return eventoEliminado;
    }

    async eliminarTodos() {
        await this.guardarTodos([]);
    }
}

// ================================================================
// SERVICIO DE CONSULTA
// ================================================================

class EventoQueryService {
    filtrar(eventos, filtros) {
        let resultado = [...eventos];

        if (filtros.dispositivo) {
            resultado = resultado.filter((evento) => {
                return evento.dispositivo === filtros.dispositivo;
            });
        }

        if (filtros.tipo) {
            resultado = resultado.filter((evento) => {
                return evento.tipo === filtros.tipo ||
                    evento.categoria === filtros.tipo ||
                    String(evento.dispositivo || '').includes(filtros.tipo);
            });
        }

        if (filtros.categoria) {
            resultado = resultado.filter((evento) => {
                return evento.categoria === filtros.categoria;
            });
        }

        if (filtros.accion) {
            resultado = resultado.filter((evento) => {
                return evento.accion === filtros.accion;
            });
        }

        if (filtros.alerta !== null) {
            resultado = resultado.filter((evento) => {
                return Boolean(evento.alerta) === filtros.alerta;
            });
        }

        if (filtros.desde) {
            resultado = resultado.filter((evento) => {
                return new Date(evento.timestamp) >= filtros.desde;
            });
        }

        if (filtros.hasta) {
            resultado = resultado.filter((evento) => {
                return new Date(evento.timestamp) <= filtros.hasta;
            });
        }

        if (filtros.q) {
            resultado = resultado.filter((evento) => {
                return contieneTexto(evento, filtros.q);
            });
        }

        return resultado;
    }

    ordenar(eventos, orden = 'desc') {
        return [...eventos].sort((a, b) => {
            const fechaA = new Date(a.timestamp).getTime();
            const fechaB = new Date(b.timestamp).getTime();

            if (orden === 'asc') {
                return fechaA - fechaB;
            }

            return fechaB - fechaA;
        });
    }

    paginar(eventos, limite, offset) {
        return eventos.slice(offset, offset + limite);
    }

    crearResumen(eventos) {
        const porDispositivo = {};
        const porTipo = {};
        const porCategoria = {};
        let alertas = 0;

        for (const evento of eventos) {
            const dispositivo = evento.dispositivo || 'desconocido';
            const tipo = evento.tipo || 'desconocido';
            const categoria = evento.categoria || 'desconocida';

            porDispositivo[dispositivo] = (porDispositivo[dispositivo] || 0) + 1;
            porTipo[tipo] = (porTipo[tipo] || 0) + 1;
            porCategoria[categoria] = (porCategoria[categoria] || 0) + 1;

            if (evento.alerta) {
                alertas += 1;
            }
        }

        const eventosOrdenados = this.ordenar(eventos, 'desc');

        const ultimaTemperatura = eventosOrdenados.find((evento) => {
            return evento.accion === 'lectura_temperatura';
        }) || null;

        const ultimaPresencia = eventosOrdenados.find((evento) => {
            return evento.accion === 'lectura_presencia';
        }) || null;

        return {
            total: eventos.length,
            alertas,
            por_dispositivo: porDispositivo,
            por_tipo: porTipo,
            por_categoria: porCategoria,
            ultima_temperatura: ultimaTemperatura,
            ultima_presencia: ultimaPresencia,
            ultimo_evento: eventosOrdenados[0] || null
        };
    }
}

const eventoRepository = new EventoRepository();
const eventoQueryService = new EventoQueryService();

// ================================================================
// RUTAS
// ================================================================

/**
 * GET /api/eventos
 *
 * Query params disponibles:
 * - dispositivo=dispensador_comida
 * - tipo=dispensador
 * - categoria=comida
 * - accion=dispensar_comida
 * - alerta=true
 * - desde=2026-06-01
 * - hasta=2026-06-02
 * - q=temperatura
 * - limite=20
 * - offset=0
 * - orden=desc
 */
router.get('/', asyncHandler(async (req, res) => {
    const filtros = {
        dispositivo: req.query.dispositivo || null,
        tipo: req.query.tipo || null,
        categoria: req.query.categoria || null,
        accion: req.query.accion || null,
        alerta: convertirBooleano(req.query.alerta),
        desde: convertirFecha(req.query.desde, 'desde'),
        hasta: convertirFecha(req.query.hasta, 'hasta'),
        q: normalizarTexto(req.query.q)
    };

    const limite = convertirLimite(req.query.limite, 20, 200);
    const offset = convertirOffset(req.query.offset);
    const orden = req.query.orden === 'asc' ? 'asc' : 'desc';

    const eventos = await eventoRepository.listarTodos();

    const filtrados = eventoQueryService.filtrar(eventos, filtros);
    const ordenados = eventoQueryService.ordenar(filtrados, orden);
    const paginados = eventoQueryService.paginar(ordenados, limite, offset);

    res.json({
        success: true,
        total: filtrados.length,
        limite,
        offset,
        orden,
        eventos: paginados
    });
}));

/**
 * GET /api/eventos/resumen
 *
 * Pensado para dashboard.
 */
router.get('/resumen', asyncHandler(async (req, res) => {
    const eventos = await eventoRepository.listarTodos();
    const resumen = eventoQueryService.crearResumen(eventos);

    res.json({
        success: true,
        resumen
    });
}));

/**
 * GET /api/eventos/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const evento = await eventoRepository.obtenerPorId(req.params.id);

    if (!evento) {
        throw new AppError(`No existe un evento con id "${req.params.id}"`, 404);
    }

    res.json({
        success: true,
        evento
    });
}));

/**
 * POST /api/eventos
 *
 * Permite crear eventos manualmente.
 * Útil para pruebas, dashboard o futuras integraciones.
 */
router.post('/', asyncHandler(async (req, res) => {
    const {
        dispositivo,
        tipo,
        categoria,
        accion,
        mensaje
    } = req.body;

    if (!accion && !mensaje) {
        throw new AppError('El evento necesita al menos una acción o un mensaje', 400);
    }

    const evento = await eventoRepository.crear({
        dispositivo: dispositivo || 'sistema',
        tipo: tipo || 'sistema',
        categoria: categoria || 'general',
        accion: accion || 'evento_manual',
        mensaje: mensaje || '',
        ...req.body
    });

    res.status(201).json({
        success: true,
        message: 'Evento registrado correctamente',
        evento
    });
}));

/**
 * DELETE /api/eventos
 *
 * Limpia todo el historial.
 */
router.delete('/', asyncHandler(async (req, res) => {
    await eventoRepository.eliminarTodos();

    res.json({
        success: true,
        message: 'Todos los eventos fueron eliminados'
    });
}));

/**
 * DELETE /api/eventos/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const evento = await eventoRepository.eliminarPorId(req.params.id);

    res.json({
        success: true,
        message: 'Evento eliminado correctamente',
        evento
    });
}));

// ================================================================
// MANEJO DE ERRORES
// ================================================================

router.use((err, req, res, next) => {
    console.error('[eventos.js]', err.message);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        error: err.message || 'Error interno en eventos'
    });
});

module.exports = router;