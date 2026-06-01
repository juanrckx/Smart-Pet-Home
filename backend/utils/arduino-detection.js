/**
 * detectArduino.js
 * Solo detecta en qué puerto está conectado el Arduino
 */

const { SerialPort } = require('serialport');

/**
 * Busca automáticamente el puerto donde está conectado el Arduino.
 * 
 * @return {Promise<string|null>} La ruta del puerto o null si no se encuentra.
 */

async function obtenerPuertoArduino() {
    try {
        const puertos = await SerialPort.list();

        if (puertos.length === 0) {
            console.warn('[arduino-detection] No se encontraron puertos seriales.');
            return null;
        }

        // Log de todos los puertos para ayudar a depurar
        console.log('[arduino-detection] Puertos seriales encontrados:');
        puertos.forEach(p => console.log(`- ${p.path} (${p.manufacturer || 'Desconocido'})`));

        // Buscar coincidencias
        const arduino = puertos.find(p => 
            p.manufacturer?.toLowerCase().includes('arduino') ||
            p.manufacturer?.toLowerCase().includes('ch340') ||
            p.manufacturer?.toLowerCase().includes('wch') ||
            p.path?.includes('ttyUSB') ||
            p.path?.includes('ttyACM') ||
            p.path?.includes('COM')
        );

        if (arduino) {
            console.log(`[arduino-detection] Arduino encontrado en el puerto: ${arduino.path}`);
            return arduino.path;
        }

        console.warn('[arduino-detection] No se encontró el puerto del Arduino.');
        return null;
    } catch (error) {
        console.error('[arduino-detection] Error al intentar detectar el puerto del Arduino:', error);
        return null;
    }
}

module.exports = {
    obtenerPuertoArduino
};