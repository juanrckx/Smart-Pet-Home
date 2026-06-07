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
 */

async function asegurarDirectorioData() {
    await fs.mkdir(DATA_DIR, { recursive: true });
}

function rutaArchivo(fileName) {
    return path.join(DATA_DIR, fileName);
}

async function leerJSON(fileName, defaultData = null) {
    try {
        await asegurarDirectorioData();
        const raw = await fs.readFile(rutaArchivo(fileName), 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        if (err.code !== 'ENOENT') return defaultData;
        console.error(`[fileUtils] Error leyendo ${fileName}`, err.message);
        return defaultData;
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
        await asegurarDirectorioData();
        await fs.writeFile(rutaArchivo(fileName), JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error(`[fileUtils] Error al escribir ${fileName}:`, err.message);
        return false;
    }
}

/**
 * Inicializar un archivo JSON con un valor por defecto si aun no existe
 * @param {string} fileName - El nombre del archivo
 * @param {object} defaultData - El valor por defecto a escribir si el archivo no existe.
 */

async function initJSONFile(fileName, defaultData) {
    const actual = await leerJSON(fileName, null);
    if (actual === null) {
        console.log(`[fileUtils] El archivo ${fileName} no existe. Creando con datos por defecto...`);
        await escribirJSON(fileName, defaultData);
    }
}

async function agregarElementoALista(fileName, listKey, item) {
    const data = await leerJSON(fileName, { [listKey]: [] });
    if (!Array.isArray(data[listKey])) data[listKey] = [];
        data[listKey].push(item);
        await escribirJSON(fileName, data);
        return item;
    }

module.exports = {
    leerJSON,
    escribirJSON,
    initJSONFile,
    agregarElementoALista
};
