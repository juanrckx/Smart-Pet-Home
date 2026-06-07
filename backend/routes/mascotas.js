const express = require('express');
const { randomUUID } = require('crypto');

const router = express.Router();

const {
    leerJSON,
    escribirJSON,
    agregarElementoALista
} = require('../utils/fileUtils');
const { timeStamp } = require('console');

const ARCHIVOS_MASCOTAS = 'mascotas.json';
const ARCHIVO_EVENTOS = 'eventos.json';

const MASCOTAS_BASE = {
    mascotas: []
};

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message)
        this.statusCode = statusCode;
    }
}

function obtenerTimestamp() {
    return new Date().toISOString();
}

function generarId(prefix = 'mascota') {
    if (typeof randomUUID === 'function') {
        return `${prefix}_${randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

function limpiarTexto(valor) {
    if (valor === undefined || valor === null) return '';
    return String(valor).trim();
}

function normalizarTexto(valor) {
    return limpiarTexto(valor).toLowerCase();
}

function validarTextoRequerido(valor, nombreCampo, min = 1, max = 80) {
    const texto = limpiarTexto(valor);

    if (texto.length < min) {
        throw new AppError(`${nombreCampo} es obligatorio`, 400);
    }

    if (texto.length > max) {
        throw new AppError(`${nombreCampo} no puede superar ${max} caracteres`, 400);
    }

    return texto;
}

function validarTextoOpcional(valor, nombreCampo, max = 100) {
    const texto = limpiarTexto(valor);

    if (texto.length > max) {
        throw new AppError(`${nombreCampo} no puede superar ${max} caracteres`, 400);
    }

    return texto;
}


function validarNumeroOpcional(valor, nombreCampo, minimo, maximo) {
    if (valor === undefined || valor === null || valor === '') {
        return null;
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        throw new AppError(`${nombreCampo} debe ser un número válido`, 400);
    }

    if (numero < minimo || numero > maximo) {
        throw new AppError(`${nombreCampo} debe estar entre ${minimo} y ${maximo}`, 400);
    }

    return numero;
}

function validarBooleanoOpcional(valor, valorPorDefecto = false) {
    if (valor === undefined || valor === null || valor === '') {
        return valorPorDefecto;
    }

    if (typeof valor === 'boolean') {
        return valor;
    }

    const texto = String(valor).toLowerCase().trim();

    if (['true', '1', 'si', 'sí', 'yes'].includes(texto)) {
        return true;
    }

    if (['false', '0', 'no'].includes(texto)) {
        return false;
    }

    return valorPorDefecto;
}

// ================================================================
// REPOSITORIO
// ================================================================

class MascotaRepository {
    async listarTodas() {
        const data = await leerJSON(ARCHIVOS_MASCOTAS, MASCOTAS_BASE);

        if (!data || !Array.isArray(data.mascotas)) {
            return [];
        }

        return data.mascotas
    }

    async guardarTodas(mascotas) {
        if (!Array.isArray(mascotas)) {
            throw new AppError('La lista de mascotas debe ser un arreglo', 500);
        }

        const guardado = await escribirJSON(ARCHIVOS_MASCOTAS, {
            mascotas
        });

        if (!guardado) {
            throw new AppError('No se pudieron guardar las mascotas', 500);
        }
    }

    async obtenerPorId(id) {
        const mascotas = await this.listarTodas();

        return mascotas.find((mascota) => String(mascota.id) === String(id)) || null;
    }

    async crear(mascotaNueva) {
        const mascotas = await this.listarTodas()

        mascotas.push(mascotaNueva);

        await this.guardarTodas(mascotas);

        return mascotaNueva;
    }

    async actualizar(id, cambios) {
        const mascotas = await this.listarTodas();

        const indice = mascotas.findIndex((mascota) => String(mascota.id) === String(id));

        if (indice === -1) {
            throw new AppError(`No existe una mascota con id "${id}`, 404);
        }

        mascotas[indice] = {
            ...mascotas[indice],
            ...cambios,
            actualzada_en: obtenerTimestamp()
        };

        await this.guardarTodas(mascotas);

        return mascotas[indice];
    }

    async eliminar(id) {
        const mascotas = await this.listarTodas();

        const mascotaEliminada = mascotas.find((mascota) => String(mascota.id) === String(id));

        if (!mascotaEliminada) {
            throw new AppError(`No existe una mascota con id ${id}`, 404);
        }

        const mascotasFiltradas = mascotas.filter((mascota) => String(mascota.id) !== String(id));

        await this.guardarTodas(mascotasFiltradas);

        return mascotaEliminada;
    }

    async marcarPrincipal(id) {
        const mascotas = await this.listarTodas();

        const existe = mascotas.some((mascota) => String(mascota.id) === String(id));

        if (!existe) {
            throw new AppError(`No existe una mascota con id ${id}`, 404);
        }

        const actualizadas = mascotas.map((mascota) => {
            return {
                ...mascota,
                principal: String(mascota.id) === String(id),
                actualizada_en: String(mascota.id) === String(id)
                ? obtenerTimestamp()
                : mascota.actualizada_en
            };
        });

        await this.guardarTodas(actualizadas);

        return actualizadas.find((mascota) => String(mascota.id) === String(id));
    }
}

class EventoRepository {
    async registrar(evento) {
        const eventoFinal = {
            id: generarId('evento'),
            timeStamp: obtenerTimestamp(),
            dispositivo: 'sistema',
            tipo: 'sistema',
            categoria: 'mascotas',
            ...evento
        };

        await agregarElementoALista(ARCHIVO_EVENTOS, 'eventos', eventoFinal);

        return eventoFinal;
    }
}

// ================================================================
// MODELO / CLASE MASCOTA
// ================================================================

class Mascota {
    constructor({
        id,
        nombre,
        tipo,
        raza = '',
        edad = null,
        peso = null,
        foto = '',
        notas = '',
        principal = false,
        creada_en = obtenerTimestamp(),
        actualizada_en = null
    }) {
        this.id = id;
        this.nombre = nombre;
        this.tipo = tipo;
        this.raza = raza;
        this.edad = edad;
        this.peso = peso;
        this.foto = foto;
        this.notas = notas;
        this.principal = principal;
        this.creada_en = creada_en;
        this.actualizada_en = actualizada_en;
    }
}

// ================================================================
// SERVICIO
// ================================================================

class MascotaService {
    constructor({ mascotaRepo, eventoRepo }) {
        this.mascotaRepo = mascotaRepo;
        this.eventoRepo = eventoRepo;
    }

    async listar({ tipo = null, q = null } = {}) {
        let mascotas = await this.mascotaRepo.listarTodas();

        if (tipo) {
            const tipoNormalizado = normalizarTexto(tipo);
            mascotas = mascotas.filter((mascota) => {
                return normalizarTexto(mascota.tipo) === tipoNormalizado;
            });
        }

        if (q) {
            const busqueda = normalizarTexto(q);
            mascotas = mascotas.filter((mascota) => {
                return JSON.stringify(mascota).toLowerCase().includes(busqueda);
            });
        }

        return mascotas;
    }

    async obtener(id) {
        const mascota = await this.mascotaRepo.obtenerPorId(id);

        if (!mascota) {
            throw new AppError(`No existe una mascota con id "${id}"`, 404);
        }

        return mascota;
    }

    async crear(payload) {
        const mascotasExistentes = await this.mascotaRepo.listarTodas();

        const datos = this.validarDatosCreacion(payload);

        const seraPrincipal = mascotasExistentes.length === 0
            ? true
            : validarBooleanoOpcional(payload.principal, false);

        let mascotasActualizadas = mascotasExistentes;

        if (seraPrincipal) {
            mascotasActualizadas = mascotasExistentes.map((mascota) => ({
                ...mascota,
                principal: false
            }));

            await this.mascotaRepo.guardarTodas(mascotasActualizadas);
        }

        const mascota = new Mascota({
            id: generarId('mascota'),
            ...datos,
            principal: seraPrincipal
        });

        const creada = await this.mascotaRepo.crear(mascota);

        await this.eventoRepo.registrar({
            accion: 'crear_mascota',
            mensaje: `Mascota registrada: ${creada.nombre}`,
            mascota_id: creada.id,
            mascota_nombre: creada.nombre
        });

        return creada;
    }

    async actualizar(id, payload) {
        const mascotaActual = await this.obtener(id);
        const cambios = this.validarDatosActualizacion(payload);

        if (Object.keys(cambios).length === 0) {
            throw new AppError('No se enviaron datos para actualizar', 400);
        }

        let mascotaActualizada = await this.mascotaRepo.actualizar(id, cambios);

        if (cambios.principal === true) {
            mascotaActualizada = await this.mascotaRepo.marcarPrincipal(id);
        }

        await this.eventoRepo.registrar({
            accion: 'actualizar_mascota',
            mensaje: `Mascota actualizada: ${mascotaActualizada.nombre}`,
            mascota_id: mascotaActualizada.id,
            mascota_nombre: mascotaActualizada.nombre,
            antes: mascotaActual,
            despues: mascotaActualizada
        });

        return mascotaActualizada;
    }

    async eliminar(id) {
        const eliminada = await this.mascotaRepo.eliminar(id);

        await this.eventoRepo.registrar({
            accion: 'eliminar_mascota',
            mensaje: `Mascota eliminada: ${eliminada.nombre}`,
            mascota_id: eliminada.id,
            mascota_nombre: eliminada.nombre
        });

        return eliminada;
    }

    async marcarPrincipal(id) {
        const mascota = await this.mascotaRepo.marcarPrincipal(id);

        await this.eventoRepo.registrar({
            accion: 'seleccionar_mascota_principal',
            mensaje: `Mascota principal seleccionada: ${mascota.nombre}`,
            mascota_id: mascota.id,
            mascota_nombre: mascota.nombre
        });

        return mascota;
    }

    async obtenerPrincipal() {
        const mascotas = await this.mascotaRepo.listarTodas();

        if (mascotas.length === 0) {
            return null;
        }

        return mascotas.find((mascota) => mascota.principal) || mascotas[0];
    }

    async obtenerResumen() {
        const mascotas = await this.mascotaRepo.listarTodas();

        const porTipo = {};

        for (const mascota of mascotas) {
            const tipo = mascota.tipo || 'sin_tipo';
            porTipo[tipo] = (porTipo[tipo] || 0) + 1;
        }

        return {
            total: mascotas.length,
            principal: mascotas.find((mascota) => mascota.principal) || mascotas[0] || null,
            por_tipo: porTipo,
            ultima_creada: mascotas
                .slice()
                .sort((a, b) => new Date(b.creada_en) - new Date(a.creada_en))[0] || null
        };
    }

    validarDatosCreacion(payload) {
        return {
            nombre: validarTextoRequerido(payload.nombre, 'El nombre de la mascota', 2, 60),
            tipo: validarTextoRequerido(payload.tipo, 'El tipo de mascota', 2, 40),
            raza: validarTextoOpcional(payload.raza, 'La raza', 80),
            edad: validarNumeroOpcional(payload.edad, 'La edad', 0, 80),
            peso: validarNumeroOpcional(payload.peso, 'El peso', 0, 200),
            foto: validarTextoOpcional(payload.foto, 'La foto', 500),
            notas: validarTextoOpcional(payload.notas, 'Las notas', 500)
        };
    }

    validarDatosActualizacion(payload) {
        const cambios = {};

        if ('nombre' in payload) {
            cambios.nombre = validarTextoRequerido(payload.nombre, 'El nombre de la mascota', 2, 60);
        }

        if ('tipo' in payload) {
            cambios.tipo = validarTextoRequerido(payload.tipo, 'El tipo de mascota', 2, 40);
        }

        if ('raza' in payload) {
            cambios.raza = validarTextoOpcional(payload.raza, 'La raza', 80);
        }

        if ('edad' in payload) {
            cambios.edad = validarNumeroOpcional(payload.edad, 'La edad', 0, 80);
        }

        if ('peso' in payload) {
            cambios.peso = validarNumeroOpcional(payload.peso, 'El peso', 0, 200);
        }

        if ('foto' in payload) {
            cambios.foto = validarTextoOpcional(payload.foto, 'La foto', 500);
        }

        if ('notas' in payload) {
            cambios.notas = validarTextoOpcional(payload.notas, 'Las notas', 500);
        }

        if ('principal' in payload) {
            cambios.principal = validarBooleanoOpcional(payload.principal, false);
        }

        return cambios;
    }
}

// ================================================================
// FACTORY
// ================================================================

function crearMascotaService() {
    return new MascotaService({
        mascotaRepo: new MascotaRepository(),
        eventoRepo: new EventoRepository()
    });
}

// ================================================================
// RUTAS
// ================================================================

/**
 * GET /api/mascotas
 *
 * Query params:
 * - tipo=perro
 * - q=sansa
 */
router.get('/', asyncHandler(async (req, res) => {
    const service = crearMascotaService();

    const mascotas = await service.listar({
        tipo: req.query.tipo,
        q: req.query.q
    });

    res.json({
        success: true,
        total: mascotas.length,
        mascotas
    });
}));

/**
 * GET /api/mascotas/resumen
 *
 * Para dashboard.
 */
router.get('/resumen', asyncHandler(async (req, res) => {
    const service = crearMascotaService();
    const resumen = await service.obtenerResumen();

    res.json({
        success: true,
        resumen
    });
}));

/**
 * GET /api/mascotas/principal
 *
 * Devuelve la mascota principal.
 */
router.get('/principal', asyncHandler(async (req, res) => {
    const service = crearMascotaService();
    const mascota = await service.obtenerPrincipal();

    res.json({
        success: true,
        mascota
    });
}));

/**
 * GET /api/mascotas/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const service = crearMascotaService();
    const mascota = await service.obtener(req.params.id);

    res.json({
        success: true,
        mascota
    });
}));

/**
 * POST /api/mascotas
 */
router.post('/', asyncHandler(async (req, res) => {
    const service = crearMascotaService();
    const mascota = await service.crear(req.body);

    res.status(201).json({
        success: true,
        message: 'Mascota registrada correctamente',
        mascota
    });
}));

/**
 * PUT /api/mascotas/:id
 *
 * Actualización completa o parcial.
 */
router.put('/:id', asyncHandler(async (req, res) => {
    const service = crearMascotaService();
    const mascota = await service.actualizar(req.params.id, req.body);

    res.json({
        success: true,
        message: 'Mascota actualizada correctamente',
        mascota
    });
}));

/**
 * PATCH /api/mascotas/:id
 *
 * Actualización parcial.
 */
router.patch('/:id', asyncHandler(async (req, res) => {
    const service = crearMascotaService();
    const mascota = await service.actualizar(req.params.id, req.body);

    res.json({
        success: true,
        message: 'Mascota actualizada correctamente',
        mascota
    });
}));

/**
 * PATCH /api/mascotas/:id/principal
 *
 * Marca una mascota como principal.
 */
router.patch('/:id/principal', asyncHandler(async (req, res) => {
    const service = crearMascotaService();
    const mascota = await service.marcarPrincipal(req.params.id);

    res.json({
        success: true,
        message: 'Mascota principal actualizada correctamente',
        mascota
    });
}));

/**
 * DELETE /api/mascotas/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const service = crearMascotaService();
    const mascota = await service.eliminar(req.params.id);

    res.json({
        success: true,
        message: 'Mascota eliminada correctamente',
        mascota
    });
}));

// ================================================================
// MANEJO DE ERRORES
// ================================================================

router.use((err, req, res, next) => {
    console.error('[mascotas.js]', err.message);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        error: err.message || 'Error interno en mascotas'
    });
});

module.exports = router;