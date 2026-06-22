const express = require('express');
const router = express.Router();

const {
    enviarComandoArduino
} = require('../arduino-connection');

let estadoLanzador = {
    activo: false,
    ultimaCantidad: 0,
    potencia: 220,
    ultimoLanzamiento: null,
    ultimoDetenido: null
};

function validarCantidad(cantidad) {
    const numero = Number(cantidad);

    if (!Number.isFinite(numero)) {
        return 5;
    }

    return Math.max(1, Math.min(5, Math.round(numero)));
}

function validarPotencia(potencia) {
    const numero = Number(potencia);

    if (!Number.isFinite(numero)) {
        return 220;
    }

    return Math.max(0, Math.min(255, Math.round(numero)));
}

router.get('/status', (req, res) => {
    res.json({
        success: true,
        dispositivo: 'lanzador_pelotas',
        ...estadoLanzador
    });
});

router.post('/lanzar', async (req, res) => {
    try {
        const cantidad = validarCantidad(req.body.cantidad ?? 5);
        const potencia = validarPotencia(req.body.potencia ?? estadoLanzador.potencia);

        await enviarComandoArduino(`BALL_POWER:${potencia}`, 'BALL:POWER:');
        const resultadoArduino = await enviarComandoArduino(
            `BALL_LAUNCH:${cantidad}`,
            'BALL:LAUNCH:OK'
        );

        estadoLanzador = {
            ...estadoLanzador,
            activo: true,
            ultimaCantidad: cantidad,
            potencia,
            ultimoLanzamiento: new Date().toISOString()
        };

        res.json({
            success: true,
            message: `Lanzador iniciado para ${cantidad} pelota(s).`,
            cantidad,
            potencia,
            arduino: resultadoArduino
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Error al iniciar el lanzador'
        });
    }
});

router.post('/detener', async (req, res) => {
    try {
        const resultadoArduino = await enviarComandoArduino('BALL_STOP', 'BALL:STOP:OK');

        estadoLanzador = {
            ...estadoLanzador,
            activo: false,
            ultimoDetenido: new Date().toISOString()
        };

        res.json({
            success: true,
            message: 'Lanzador detenido correctamente.',
            arduino: resultadoArduino
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Error al detener el lanzador'
        });
    }
});

router.post('/potencia', async (req, res) => {
    try {
        const potencia = validarPotencia(req.body.potencia);

        const resultadoArduino = await enviarComandoArduino(
            `BALL_POWER:${potencia}`,
            'BALL:POWER:'
        );

        estadoLanzador = {
            ...estadoLanzador,
            potencia
        };

        res.json({
            success: true,
            message: `Potencia configurada en ${potencia}.`,
            potencia,
            arduino: resultadoArduino
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Error al cambiar potencia'
        });
    }
});

router.post('/test', async (req, res) => {
    try {
        const resultadoArduino = await enviarComandoArduino('BALL_TEST', 'BALL:TEST:OK');

        res.json({
            success: true,
            message: 'Prueba de motores completada.',
            arduino: resultadoArduino
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Error al probar motores'
        });
    }
});

module.exports = router;