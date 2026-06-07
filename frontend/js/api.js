class ApiBase {
    static BASE_URL = '/api';

    static construirQuery(params = {}) {
        const query = new URLSearchParams();

        Object.entries(params).forEach(([clave, valor]) => {
            if (valor !== undefined && valor !== null && valor !== '') {
                query.append(clave, valor)
            }
        });

        const queryString = query.toString();
        return queryString ? `?${queryString}`: '';
    }

    static async request(endpoint, opciones = {}) {
        try {
            const respuesta = await fetch(`${this.BASE_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(opciones.headers || {})
                },
                ...opciones
            });

            let data;

            try {
                data = await respuesta.json();
            } catch (error) {
                data = {
                    success: false,
                    error: 'El servidor no respondió con JSON válido'
                };
            }

            if (!respuesta.ok) {
                return {
                    success: false,
                    status: respuesta.status,
                    error: data.error || `Error HTTP ${respuesta.status}`,
                    ...data
                };
            }

            return data;
        } catch (error) {
            console.error('[ApiBase]', error);

            return {
                success: false,
                error: 'No se pudo conectar con el servidor'
            };
        }
    }

    static get(endpoint, params = {}) {
        const query = this.construirQuery(params);
        return this.request(`${endpoint}${query}`, {
            method: 'GET'
        });
    }

    static post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    static put(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    static patch(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
    }

    static delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }
}

class SistemaApi extends ApiBase {
    static obtenerHealth() {
        return this.get('/health');
    }

    static obtenerStatus() {
        return this.get('/status');
    }
}

class ComidaApi extends ApiBase {
    static obtenerEstado() {
        return this.get('/food/status');
    }

    static dispensar(gramos) {
        const cantidad = Number(gramos);

        return this.post('/food/dispense', {
            grams: cantidad,
            gramos: cantidad
        });
    }
}

class AguaApi extends ApiBase {
    static obtenerEstado() {
        return this.get('/water/status');
    }

    static dispensar(segundos) {
        const segundosNumericos = Number(segundos);
        const duracionMs = Math.round(segundosNumericos * 1000);


        return this.post('/water/dispense', {
            duracion: duracionMs,
            duracionMs,
            segundos: segundosNumericos
        });
    }
}

class EventosApi extends ApiBase {
    static obtener(filtros = {}) {
        return this.get('/eventos', filtros);
    }

    static obtenerResumen() {
        return this.get('/eventos/resumen');
    }

    static obtenerPorId(id) {
        return this.get(`/eventos/${encodeURIComponent(id)}`);
    }

    static crear(evento) {
        return this.post('/eventos', evento);
    }

    static eliminarTodos() {
        return this.delete('/eventos');
    }

    static eliminarPorId(id) {
        return this.delete(`/eventos/${encodeURIComponent(id)}`);
    }
}

class DispositivosApi extends ApiBase {
    static listar() {
        return this.get('/dispositivos');
    }

    static listarAlias() {
        return this.get('/devices');
    }

    static obtenerEstado(id) {
        return this.get(`/dispositivos/${encodeURIComponent(id)}/status`);
    }
}
class SensoresApi extends ApiBase {
    static obtenerEstado() {
        return this.get('/sensores/status');
    }

    static registrarTemperatura(valor) {
        return this.post('/sensores/temperatura', {
            valor: Number(valor),
            temperatura: Number(valor)
        });
    }

    static registrarPresencia(presente) {
        return this.post('/sensores/presencia', {
            presente: Boolean(presente),
            detectado: Boolean(presente)
        });
    }
}

class MascotasApi extends ApiBase {
    static listar(filtros = {}) {
        return this.get('/mascotas', filtros);
    }

    static obtenerResumen() {
        return this.get('/mascotas/resumen');
    }

    static obtenerPrincipal() {
        return this.get('/mascotas/principal');
    }

    static obtenerPorId(id) {
        return this.get(`/mascotas/${encodeURIComponent(id)}`);
    }

    static crear(mascota) {
        return this.post('/mascotas', mascota);
    }

    static actualizar(id, mascota) {
        return this.put(`/mascotas/${encodeURIComponent(id)}`, mascota);
    }

    static actualizarParcial(id, cambios) {
        return this.patch(`/mascotas/${encodeURIComponent(id)}`, cambios);
    }

    static marcarPrincipal(id) {
        return this.patch(`/mascotas/${encodeURIComponent(id)}/principal`);
    }

    static eliminar(id) {
        return this.delete(`/mascotas/${encodeURIComponent(id)}`);
    }
}

/**
 * Futuro juego de botones.
 *
 * Todavía no activamos estas rutas hasta crear el backend del juego,
 * pero dejamos la clase pensada para expansión.
 */
class JuegoBotonesApi extends ApiBase {
    static obtenerEstado() {
        return this.get('/juego-botones/status');
    }

    static obtenerHistorial(limite = 20) {
        return this.get('/juego-botones/historial',  { limite });
    }

    static jugar(boton) {
        return this.post('/juego-botones/jugar', {
            boton: Number(boton)
        });
    }

    static entregarPremioManual() {
        return this.post('/juego-botones/premio');
    }

    static reiniciarDia() {
        return this.post('/juego-botones/reiniciar-dia');
    }
}

class PuertaApi extends ApiBase {
    static obtenerEstado() {
        return this.get('/puerta/status');
    }

    static abrir() {
        return this.post('/puerta/abrir');
    }

    static cerrar() {
        return this.post('/puerta/cerrar');
    }

    static abrirTemporal(segundos) {
        return this.post('/puerta/abrir-temporal', {
            segundos: Number(segundos)
        });
    }

    static programar(intervaloMinutos, duracionSegundos) {
        return this.post('/puerta/programar', {
            intervaloMinutos: Number(intervaloMinutos),
            duracionSegundos: Number(duracionSegundos)
        });
    }

    static detenerProgramacion() {
        return this.post('/puerta/detener-programacion');
    }
}

class ComunicacionApi extends ApiBase {
    static obtenerEstado() {
        return this.get('/comunicacion/status');
    }

    static hablar(duracionMs = 1500) {
        return this.post('/comunicacion/hablar', {
            duracionMs: Number(duracionMs)
        });
    }

    static encenderVideo(
        linea1 = 'SMART PET HOME',
        linea2 = 'VIDEO EN VIVO',
        linea3 = 'Mascota online :)',
        linea4 = 'Sistema activo'
    ) {
        return this.post('/comunicacion/video/encender', {
            linea1,
            linea2,
            linea3,
            linea4
        });
    }

    static apagarVideo() {
        return this.post('/comunicacion/video/apagar');
    }

    static enviarTextoLCD(linea1, linea2, linea3, linea4) {
        return this.post('/comunicacion/lcd/texto', {
            linea1,
            linea2,
            linea3,
            linea4
        });
    }
}

class LanzadorPelotasApi extends ApiBase {
    static obtenerEstado() {
        return this.get('/lanzador-pelotas/status');
    }

    static lanzar(cantidad = 5) {
        return this.post('/lanzador-pelotas/lanzar', {
            cantidad: Number(cantidad)
        });
    }

    static detener() {
        return this.post('/lanzador-pelotas/detener');
    }
}

/**
 * Exponer clases globalmente.
 * Esto permite que comida.html, agua.html, sensores.html y app.js
 * puedan usar ComidaApi, AguaApi, EventosApi, etc.
 */
window.ApiBase = ApiBase;
window.SistemaApi = SistemaApi;
window.ComidaApi = ComidaApi;
window.AguaApi = AguaApi;
window.EventosApi = EventosApi;
window.DispositivosApi = DispositivosApi;
window.SensoresApi = SensoresApi;
window.JuegoBotonesApi = JuegoBotonesApi;
window.PuertaApi = PuertaApi;
window.ComunicacionApi = ComunicacionApi;
window.LanzadorPelotasApi = LanzadorPelotasApi;

window.MascotasApi = MascotasApi;
window.MascotaApi = MascotasApi;
