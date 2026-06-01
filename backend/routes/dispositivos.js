/**
 * dispositivos.js (ruta: backend/routes/dispositivos.js)
 * 
 *  JERARQUIA DE CLASES:
 * 
 *   Dispositivo (base)
 *   ├── Dispensador
 *   │   ├── DispensadorComida
 *   │   └── DispensadorAgua
 *   ├── Sensor
 *   │   ├── SensorTemperatura
 *   │   └── SensorMovimiento
 *   ├── Puerta
 *   └── Juego
 *       ├── JuegoPelotas
 *       └── JuegoBotones
 */

const express = require('express');
const router = express.Router();
const { enviarComandoArduino } = require('../arduino-connection');
const { leerJSON, escribirJSON } = require('../utils/fileUtils');
const e = require('express');

// ============== CLASE BASE ===============

class Dispositivo {
    constructor(id, nombre, tipo) {
        this.id = id;
        this.nombre = nombre;
        this.tipo = tipo;
    }

    async guardarEvento(datosExtra = {}) {
        const evento = {
            id: Date.now(),
            dispositivo: this.id,
            tipo: this.tipo,
            timestamp: new Date().toISOString(),
            ...datosExtra
        };
        const datos = await leerJSON('eventos.json') || { eventos: [] };
        datos.eventos.push(evento);
        await escribirJSON('eventos.json', datos);
        return evento;
    }

    obtenerEstado() {
        return {
            id: this.id,
            nombre: this.nombre,
            tipo: this.tipo,
            estado: 'desconocido',
            ultima_actualizacion: new Date().toISOString()
        };
    }

    responderError(res, mensaje, codigo = 500) {
        console.error(`[$this.id}] Error: ${mensaje}`);
        res.status(codigo).json({ success: false, message: mensaje });
    }
}

class Dispensador extends Dispositivo {
    constructor(id, nombre) {
        super(id, nombre, 'dispensador');
    }

    async manejarDispensacion(req, res) {
        try {
            const errorValidacion = this.validar(req.body);
            if (errorValidacion) return this.responderError(res, errorValidacion, 400);

            const comando = this.construirComando(req.body);
            console.log(`[$this.id] Enviando comando: ${comando}`);

            const exito = await enviarComandoArduino(comando);
            if (!exito) return this.responderError(res, 'Fallo al comunicarse con Arduino');

            const evento = await this.guardarEvento(this.datosEvento(req.body));
            res.json({ success: true, message: this.mensajeExito(req.body), evento });
        
        } catch (error) {
            this.responderError(res, `Error al manejar dispensación: ${error.message}`);
        }
    }
    
    validar(_body) {#TODO}
    construirComando(_body) {#TODO}
    datosEvento(_body) {#TODO}
    mensajeExito(_body) {#TODO}
}

