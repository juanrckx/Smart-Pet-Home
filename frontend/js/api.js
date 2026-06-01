/**
 * api.js  (frontend/js/api.js)
 * 
 * PRINCIPIO OCP: Para agregar SensoresApi, creamos la clase sin modificar las existentes.
 * PRINCIPIO DIP: Los HTMLs dependen de esta abstracción, no de fetch() directamente.
 */

// ==================== CLASE BASE ====================

class ApiBase {
    static BASE_URL = 'http://localhost:3000/api';

    /**
     * Método HTTP genérico. Maneja errores de red y errores del servidor.
     * 
     * @param {string} endpoint   Ruta relativa, ej: '/food/dispense'
     * @param {string} method     'GET' | 'POST' | 'PUT' | 'DELETE'
     * @param {object} [body]     Cuerpo del request (solo para POST/PUT)
     * @returns {Promise<object>} Siempre retorna un objeto; en error retorna { success: false, error: '...' }
     */
    static async _request(endpoint, method = 'GET', body = null) {
        try {
            const opciones = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };

            if (body && (method === 'POST' || method === 'PUT')) {
                opciones.body = JSON.stringify(body);
            }

            const response = await fetch(`${this.BASE_URL}${endpoint}`, opciones);
            const data     = await response.json();

            // Si el servidor retornó un código de error HTTP
            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || `Error del servidor (${response.status})`
                };
            }

            return data;

        } catch (err) {
            // Error de red (servidor apagado, CORS, etc.)
            console.error(`[API] Error en ${method} ${endpoint}:`, err.message);
            return {
                success: false,
                error: 'No se pudo conectar al servidor. ¿Está corriendo Node.js?'
            };
        }
    }

    static async _get(endpoint)         { return this._request(endpoint, 'GET'); }
    static async _post(endpoint, body)  { return this._request(endpoint, 'POST', body); }
}

// ==================== COMIDA API ====================

class ComidaApi extends ApiBase {
    /**
     * Solicitar dispensación de comida.
     * @param {number} gramos  Entre 10 y 500
     */
    static async dispensar(gramos) {
        return this._post('/food/dispense', { grams: parseInt(gramos) });
    }

    /** Estado actual del dispensador (nivel, online/offline) */
    static async obtenerEstado() {
        return this._get('/food/status');
    }
}

// ==================== AGUA API ====================

class AguaApi extends ApiBase {
    /**
     * Solicitar apertura de la compuerta de agua.
     * @param {number} segundos  Entre 1 y 10
     */
    static async dispensar(segundos) {
        // Convertimos a ms aquí para que el HTML no tenga que saberlo
        return this._post('/water/dispense', { duracion: parseInt(segundos) * 1000 });
    }

    /** Estado actual del dispensador de agua */
    static async obtenerEstado() {
        return this._get('/water/status');
    }
}

// ==================== EVENTOS API ====================

class EventosApi extends ApiBase {
    /**
     * Obtener historial de eventos del JSON real.
     * @param {object} opciones  { tipo: 'comida'|'agua', limite: 20 }
     */
    static async obtener({ tipo = null, limite = 20 } = {}) {
        let url = `/eventos?limite=${limite}`;
        if (tipo) url += `&tipo=${tipo}`;
        return this._get(url);
    }
}

// ==================== SERVIDOR API ====================

class ServidorApi extends ApiBase {
    /** Verifica si el servidor Node.js y el Arduino están en línea */
    static async obtenerEstado() {
        return this._get('/status');
    }
}

