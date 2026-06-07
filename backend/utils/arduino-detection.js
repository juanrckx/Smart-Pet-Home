/**
 * detectArduino.js
 * Solo detecta en qué puerto está conectado el Arduino
 */

let SerialPort;
try {
    ({ SerialPort } = require('serialport'));
} catch (err) {
    console.error('[arduino-detection] No se pudo cargar el módulo serialport. Asegúrate de tenerlo instalado.', err.message);
    SerialPort = null;
}

/**
 * Busca automáticamente el puerto donde está conectado el Arduino.
 * 
 * @return {Promise<string|null>} La ruta del puerto o null si no se encuentra.
 */

async function obtenerPuertoArduino() {
    if (!SerialPort) {
        console.warn('[arduino-detection] SerialPort no disponible. No se puede detectar Arduino.');
        return null;
    }

    try {
        const puertos = await SerialPort.list();

        if (puertos.length === 0) {
            console.warn('[arduino-detection] No se encontraron puertos seriales disponibles.');
            return null;
        }

        console.log('[arduino-detection] Puertos seriales encontrados:');
        puertos.forEach(p => console.log(`- ${p.path} (${p.manufacturer || 'Desconocido'})`));

        const arduino = puertos.find(p => {
            const manufacturer = (p.manufacturer || '').toLowerCase();
            return manufacturer.includes('arduino') || 
            manufacturer.includes('ch340') ||
            manufacturer.includes('wch') ||
            p.path.includes('ttyUSB') ||
            p.path.includes('ttyACM') ||
            p.path.includes('COM');
        });

        if (!arduino) return null;
        return arduino.path;
    } catch (err) {
        console.error('[arduino-detection] Error al listar puertos seriales:', err.message);
        return null;
    }
}

module.exports = {
    obtenerPuertoArduino };