/**
 * backend/routes/juego-botones.js
 */

const express = require('express');

const router = express.Router();

const {
    crearJuegoBotonesService
} = require('../services/juego-botones-service');

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

router.get('/status', asyncHandler(async (req, res) => {
    const service = crearJuegoBotonesService();
    const estado = await service.obtenerEstadoPublico();

    res.json(estado);
}));

router.get('/historial', asyncHandler(async (req, res) => {
    const service = crearJuegoBotonesService();
    const limite = Number(req.query.limite || 20);

    const historial = await service.obtenerHistorial(
        Number.isFinite(limite) ? Math.min(Math.max(limite, 1), 100) : 20
    );

    res.json(historial);
}));

router.post('/jugar', asyncHandler(async (req, res) => {
    const service = crearJuegoBotonesService();

    const resultado = await service.jugar({
        ...req.body,
        origen: 'web'
    });

    res.json(resultado);
}));

router.post('/premio', asyncHandler(async (req, res) => {
    const service = crearJuegoBotonesService();
    const resultado = await service.entregarPremioManual();

    res.json(resultado);
}));

router.post('/reiniciar-dia', asyncHandler(async (req, res) => {
    const service = crearJuegoBotonesService();
    const resultado = await service.reiniciarDia();

    res.json(resultado);
}));

router.use((err, req, res, next) => {
    console.error('[juego-botones.js]', err.message);

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Error interno en juego de botones'
    });
});

module.exports = router;