/**
 * backend/routes/mascotas.js
 *
 * Historia 15:
 * Gestionar perfiles de mascotas.
 *
 * Permite:
 * - Crear mascotas.
 * - Listar mascotas.
 * - Obtener mascota por id.
 * - Actualizar mascotas.
 * - Eliminar mascotas.
 * - Marcar una mascota como principal.
 * - Obtener resumen para dashboard.
 */

const express = require('express');
const { randomUUID } = require('crypto');

const router = express.Router();

const {
    leerJSON,
    escribirJSON,
    agregarElementoALista
} = require('../utils/fileUtils');

const ARCHIVO_MASCOTAS = 'mascotas.json';
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
        super(message);
        this.statusCode = statusCode;
    }
}

function generarId(prefix = 'mascota') {
    if (typeof randomUUID === 'function') {
        return `${prefix}_${randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

function obtenerTimestamp() {
    return new Date().toISOString();
}

function limpiarTexto(valor) {
    if (valor === undefined || valor === null) return '';
    return String(valor).trim();
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

function validarTextoOpcional(valor, nombreCampo, max = 300) {
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

function validarBooleano(valor, valorPorDefecto = false) {
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

async function listarMascotas() {
    const data = await leerJSON(ARCHIVO_MASCOTAS, MASCOTAS_BASE);

    if (!data || !Array.isArray(data.mascotas)) {
        return [];
    }

    return data.mascotas;
}

async function guardarMascotas(mascotas) {
    await escribirJSON(ARCHIVO_MASCOTAS, {
        mascotas
    });
}

async function registrarEvento(evento) {
    const eventoFinal = {
        id: generarId('evento'),
        timestamp: obtenerTimestamp(),
        dispositivo: 'sistema',
        dispositivo_nombre: 'Gestión de mascotas',
        tipo: 'sistema',
        categoria: 'mascotas',
        ...evento
    };

    await agregarElementoALista(ARCHIVO_EVENTOS, 'eventos', eventoFinal);

    return eventoFinal;
}

function validarDatosCreacion(payload) {
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

function validarDatosActualizacion(payload) {
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
        cambios.principal = validarBooleano(payload.principal, false);
    }

    return cambios;
}

async function obtenerMascotaPorId(id) {
    const mascotas = await listarMascotas();
    const mascota = mascotas.find((item) => String(item.id) === String(id));

    if (!mascota) {
        throw new AppError(`No existe una mascota con id "${id}"`, 404);
    }

    return mascota;
}

// ================================================================
// RUTAS
// ================================================================

router.get('/', asyncHandler(async (req, res) => {
    let mascotas = await listarMascotas();

    if (req.query.tipo) {
        const tipo = String(req.query.tipo).toLowerCase();
        mascotas = mascotas.filter((mascota) => {
            return String(mascota.tipo || '').toLowerCase() === tipo;
        });
    }

    if (req.query.q) {
        const q = String(req.query.q).toLowerCase();
        mascotas = mascotas.filter((mascota) => {
            return JSON.stringify(mascota).toLowerCase().includes(q);
        });
    }

    res.json({
        success: true,
        total: mascotas.length,
        mascotas
    });
}));

router.get('/resumen', asyncHandler(async (req, res) => {
    const mascotas = await listarMascotas();

    const porTipo = {};

    mascotas.forEach((mascota) => {
        const tipo = mascota.tipo || 'sin_tipo';
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    });

    res.json({
        success: true,
        resumen: {
            total: mascotas.length,
            principal: mascotas.find((mascota) => mascota.principal) || mascotas[0] || null,
            por_tipo: porTipo
        }
    });
}));

router.get('/principal', asyncHandler(async (req, res) => {
    const mascotas = await listarMascotas();

    res.json({
        success: true,
        mascota: mascotas.find((mascota) => mascota.principal) || mascotas[0] || null
    });
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const mascota = await obtenerMascotaPorId(req.params.id);

    res.json({
        success: true,
        mascota
    });
}));

router.post('/', asyncHandler(async (req, res) => {
    const mascotas = await listarMascotas();
    const datos = validarDatosCreacion(req.body);

    const seraPrincipal = mascotas.length === 0
        ? true
        : validarBooleano(req.body.principal, false);

    const mascotasActualizadas = seraPrincipal
        ? mascotas.map((mascota) => ({ ...mascota, principal: false }))
        : mascotas;

    const nuevaMascota = {
        id: generarId('mascota'),
        ...datos,
        principal: seraPrincipal,
        creada_en: obtenerTimestamp(),
        actualizada_en: null
    };

    mascotasActualizadas.push(nuevaMascota);

    await guardarMascotas(mascotasActualizadas);

    const evento = await registrarEvento({
        accion: 'crear_mascota',
        mascota_id: nuevaMascota.id,
        mascota_nombre: nuevaMascota.nombre,
        mensaje: `Mascota registrada: ${nuevaMascota.nombre}`
    });

    res.status(201).json({
        success: true,
        message: 'Mascota registrada correctamente',
        mascota: nuevaMascota,
        evento
    });
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const mascotas = await listarMascotas();
    const indice = mascotas.findIndex((mascota) => String(mascota.id) === String(req.params.id));

    if (indice === -1) {
        throw new AppError(`No existe una mascota con id "${req.params.id}"`, 404);
    }

    const cambios = validarDatosActualizacion(req.body);

    if (Object.keys(cambios).length === 0) {
        throw new AppError('No se enviaron datos para actualizar', 400);
    }

    let mascotasActualizadas = [...mascotas];

    if (cambios.principal === true) {
        mascotasActualizadas = mascotasActualizadas.map((mascota) => ({
            ...mascota,
            principal: false
        }));
    }

    mascotasActualizadas[indice] = {
        ...mascotasActualizadas[indice],
        ...cambios,
        actualizada_en: obtenerTimestamp()
    };

    await guardarMascotas(mascotasActualizadas);

    const evento = await registrarEvento({
        accion: 'actualizar_mascota',
        mascota_id: mascotasActualizadas[indice].id,
        mascota_nombre: mascotasActualizadas[indice].nombre,
        mensaje: `Mascota actualizada: ${mascotasActualizadas[indice].nombre}`
    });

    res.json({
        success: true,
        message: 'Mascota actualizada correctamente',
        mascota: mascotasActualizadas[indice],
        evento
    });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
    const mascotas = await listarMascotas();
    const indice = mascotas.findIndex((mascota) => String(mascota.id) === String(req.params.id));

    if (indice === -1) {
        throw new AppError(`No existe una mascota con id "${req.params.id}"`, 404);
    }

    const cambios = validarDatosActualizacion(req.body);

    if (Object.keys(cambios).length === 0) {
        throw new AppError('No se enviaron datos para actualizar', 400);
    }

    let mascotasActualizadas = [...mascotas];

    if (cambios.principal === true) {
        mascotasActualizadas = mascotasActualizadas.map((mascota) => ({
            ...mascota,
            principal: false
        }));
    }

    mascotasActualizadas[indice] = {
        ...mascotasActualizadas[indice],
        ...cambios,
        actualizada_en: obtenerTimestamp()
    };

    await guardarMascotas(mascotasActualizadas);

    const evento = await registrarEvento({
        accion: 'actualizar_mascota',
        mascota_id: mascotasActualizadas[indice].id,
        mascota_nombre: mascotasActualizadas[indice].nombre,
        mensaje: `Mascota actualizada: ${mascotasActualizadas[indice].nombre}`
    });

    res.json({
        success: true,
        message: 'Mascota actualizada correctamente',
        mascota: mascotasActualizadas[indice],
        evento
    });
}));

router.patch('/:id/principal', asyncHandler(async (req, res) => {
    const mascotas = await listarMascotas();
    const existe = mascotas.some((mascota) => String(mascota.id) === String(req.params.id));

    if (!existe) {
        throw new AppError(`No existe una mascota con id "${req.params.id}"`, 404);
    }

    const mascotasActualizadas = mascotas.map((mascota) => ({
        ...mascota,
        principal: String(mascota.id) === String(req.params.id),
        actualizada_en: String(mascota.id) === String(req.params.id)
            ? obtenerTimestamp()
            : mascota.actualizada_en
    }));

    await guardarMascotas(mascotasActualizadas);

    const mascotaPrincipal = mascotasActualizadas.find((mascota) => mascota.principal);

    const evento = await registrarEvento({
        accion: 'seleccionar_mascota_principal',
        mascota_id: mascotaPrincipal.id,
        mascota_nombre: mascotaPrincipal.nombre,
        mensaje: `Mascota principal seleccionada: ${mascotaPrincipal.nombre}`
    });

    res.json({
        success: true,
        message: 'Mascota principal actualizada correctamente',
        mascota: mascotaPrincipal,
        evento
    });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const mascotas = await listarMascotas();
    const mascotaEliminada = mascotas.find((mascota) => String(mascota.id) === String(req.params.id));

    if (!mascotaEliminada) {
        throw new AppError(`No existe una mascota con id "${req.params.id}"`, 404);
    }

    let mascotasActualizadas = mascotas.filter((mascota) => String(mascota.id) !== String(req.params.id));

    if (mascotaEliminada.principal && mascotasActualizadas.length > 0) {
        mascotasActualizadas[0] = {
            ...mascotasActualizadas[0],
            principal: true,
            actualizada_en: obtenerTimestamp()
        };
    }

    await guardarMascotas(mascotasActualizadas);

    const evento = await registrarEvento({
        accion: 'eliminar_mascota',
        mascota_id: mascotaEliminada.id,
        mascota_nombre: mascotaEliminada.nombre,
        mensaje: `Mascota eliminada: ${mascotaEliminada.nombre}`
    });

    res.json({
        success: true,
        message: 'Mascota eliminada correctamente',
        mascota: mascotaEliminada,
        evento
    });
}));

router.use((err, req, res, next) => {
    console.error('[mascotas.js]', err.message);

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Error interno en mascotas'
    });
});

module.exports = router;