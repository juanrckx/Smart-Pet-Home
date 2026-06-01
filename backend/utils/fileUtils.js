/**
 * fileUtils.js
 * Maneja la lectura y escritura de archivos JSON en el directorio /data.
 */

const fs = require('fs').promises;
const path = require('path');

//Directorio base donde viven todos los JSON de datos
const DATA_DIR = path.join(__dirname, '../data');

/**
 * Leer un archivo JSON del directorio /data.
 * Retorna el objeto parseado o null si hubo un error o no existe.
 * 
 * @param {string} fileName - El nombre del archivo a leer
 * @returns {Promise<object|null>} - El objeto parseado o null si hubo un error.
 */
async function leerJSON(fileName) {
    try {
        const filePath = path.join(DATA_DIR, fileName);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[fileUtils] Error al leer $ {fileName}:', err.message);
        return null;
    }
}

/**
 * Escribir un objeto como JSON en el directorio /data.
 * @param {string} fileName - El nombre del archivo
 * @param {object} data - El objeto a escribir como JSON.
 * @returns {Promise<boolean>} - true si se guardó bien, false si hubo un error.
 */
async function escribirJSON(fileName, data) {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });

        const filePath = path.join(DATA_DIR, fileName);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;

    } catch (err) {
        console.error('[fileUtils] Error al escribir $ {fileName}:', err.message);
        return false;
    }
}

/**
 * Inicializar un archivo JSON con un valor por defecto si aun no existe
 * @param {string} fileName - El nombre del archivo
 * @param {object} defaultData - El valor por defecto a escribir si el archivo no existe.
 */

async function initJSONFile(fileName, defaultData) {
    const exists = await leerJSON(fileName);
    if (exists === null) {
        console.log(`[fileUtils] El archivo ${fileName} no existe. Creando con datos por defecto...`);
        await escribirJSON(fileName, defaultData);
    }
}

module.exports = {
    leerJSON,
    escribirJSON,
    initJSONFile
};
