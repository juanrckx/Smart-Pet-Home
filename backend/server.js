const express = require('express');
const cors = require('cors');
const path = require('path');
const { iniciarConexionArduino } = require('./arduino-connection');
const dispositivosRouter = require('./routes/dispositivos');

const app = express();
const PORT = 3000;

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));  // Servir archivos HTML/CSS/JS

// ==================== CONEXIÓN ARDUINO ====================
iniciarConexionArduino();

// ==================== RUTAS ====================
app.use('/api', dispositivosRouter);

// Ruta de prueba
app.get('/api/status', (req, res) => {
    res.json({ status: 'OK', servidor: 'en línea' });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
    console.log(`\nServidor ejecutándose en http://localhost:${PORT}`);
    console.log(`Abre en navegador: http://localhost:${PORT}`);
    console.log(`Ctrl+C para detener el servidor\n`);
});