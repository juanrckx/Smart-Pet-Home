const express = require('express');
const { randomUUID } = require ('crypto');

const router = express.Router();

const {
    enviarComandoArduino,
    estaConectado
} = require('../arduino-connection');

const {
    leerJSON,
    escribirJSON,
    agregarElementoALista
} = require('../utils/fileUtils');

// ========================================
// CONFIGURACION INICIAL
// ========================================

const ARCHIVO_DISPOSITIVOS = 'dispositivos.json';
const ARHCIVO_EVENTOS = 'eventos.json';
const ARCHIVO_CONFIGURACION = 'configuracion.json';

const DISPOSITIVO_BASE = {
    dispositivos: [
        {
            id: 'dispensador_comida',
            nombre: 'Dispensador de comida',
            tipo: 'dispensador',
            categoria: 'comida',
            estado: 'activo',
            nivel: 100
        },
        {
            id: 'dispensador_agua',
            nombre: 'Dispensador de agua',
            tipo: 'dispensador',
            categoria: 'agua',
            estado: 'activo',
            nivel: 100
        },
        {
            id: 'sensor_temperatura',
            nombre: 'Sensor de temperatura',
            tipo: 'sensor',
            categoria: 'temperatura',
            estado: 'pendiente'
        },
        {
            id: 'sensor_movimiento',
            nombre: 'Sensor de presencia',
            tipo: 'sensor',
            categoria: 'presencia',
            estado: 'pendiente'
        }
    ]
};

const CONFIGURACION_BASE = {
    comida: { gramosPorDefecto: 100 },
    agua: { duracionPorDefectoMs: 3000 },
    temperatura: { minima: 18, maxima: 30 }
};

// ========================================
// UTILIDADES
// ========================================

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.status = status;
    }
}

function validarNumeroEnRango(valor, nombre, min, max) {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        throw new AppError(`${nombre} debe ser un número válido`, 400);
    }

    if (numero < min || numero > max) {
        throw new AppError(`${nombre} debe estar entre ${min} y ${max}`, 400);
    }

    return numero;
}

function generarIdEvento() {
    if (typeof randomUUID === 'function') {
        return randomUUID();
    }

    return `${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function obtenerTimestamp() {
    return new Date().toISOString();
}

// ========================================
// REPOSITORIOS
// ========================================

class DispositivoRepository {
    async listar() {
        const data = await leerJSON(ARCHIVO_DISPOSITIVOS, DISPOSITIVO_BASE);

        if (!data || !Array.isArray(data.dispositivos)) {
            return DISPOSITIVO_BASE.dispositivos;
        }
        
        return data.dispositivos;
    }

    async obtenerPorId(id) {
        const dispositivos = await this.listar();
        return dispositivos.find((dispositivo) => dispositivo.id === id) || null;
    }

    async actualizar(id, cambios) {
        const data = await leerJSON(ARCHIVO_DISPOSITIVOS, DISPOSITIVO_BASE);

        if (!Array.isArray(data.dispositivos)) {
            data.dispositivos = [];
        }

        const index = data.dispositivos.findIndex(d => d.id === id);

        if (index === -1) {
            throw new AppError(`Dispositivo con id ${id} no encontrado`, 404);
        }

        data.dispositivos[index] = { ...data.dispositivos[index], ...cambios };
        await escribirJSON(ARCHIVO_DISPOSITIVOS, data);
        return data.dispositivos[index];
    }
}

class EventoRepository {
    async registrar(evento) {
        const eventoFinal = {
            id: generarIdEvento(),
            timestamp: obtenerTimestamp(),
            ...evento
        };

        await agregarElementoALista(ARHCIVO_EVENTOS, 'eventos', eventoFinal);
        return eventoFinal;
    }
}

class ConfiguracionRepository {
    async obtener() {
        const config = await leerJSON(ARCHIVO_CONFIGURACION, CONFIGURACION_BASE);
        return {
            ...ARCHIVO_CONFIGURACION, 
            ...config, 
            comida: {
                ...CONFIGURACION_BASE.comida,
                ...(config?.comida || {})
            },
            agua: {
                ...CONFIGURACION_BASE.agua,
                ...(config?.agua || {})
            },
            temperatura: {
                ...CONFIGURACION_BASE.temperatura,
                ...(config?.temperatura || {})
            }
        };
    }
}

// ========================================
// GATEWAY DE ARDUINO
// ========================================

class ArduinoGateway {
    estaDisponible() {
        return estaConectado();
    }

    async enviar(comando, respuestaEsperada = null) {
        const enviado = await enviarComandoArduino(comando, respuestaEsperada);

        if (!enviado) {
            throw new AppError('No se pudo enviar el comando al Arduino', 500);
        }

        return { success: true };
    }
}

// ========================================
// CLASE BASE: DISPOSITIVO
// ========================================

class Dispositivo {
    constructor({id, nombre, tipo, categoria }, dependencias) {
        this.id = id;
        this.nombre = nombre;
        this.tipo = tipo;
        this.categoria = categoria;

        this.dispositivoRepo = dependencias.dispositivoRepo;
        this.eventoRepo = dependencias.eventoRepo;
        this.configRepo = dependencias.configRepo;
        this.arduino = dependencias.arduino;
    }

    async obtenerEstado() {
        const dispositivoGuardado = await this.dispositivoRepo.obtenerPorId(this.id);

        return {
            id: this.id,
            nombre: this.nombre,
            tipo: this.tipo,
            categoria: this.categoria,
            estado: dispositivoGuardado?.estado || 'desconocido',
            nivel: dispositivoGuardado?.nivel ?? null,
            online: this.arduino.estaDisponible(),
            ultima_actualizacion: dispositivoGuardado?.ultima_actualizacion || null
        };
    }

    async registrarEvento(datos) {
        return this.eventoRepo.registrar({
            dispositivo: this.id,
            dispositivo_nombre: this.nombre,
            tipo: this.tipo,
            categoria: this.categoria,
            ...datos
        });
    }

    async marcarActivo() {
        return this.dispositivoRepo.actualizar(this.id, {
            estado: 'activo'
        });
    }
}

// ========================================
// DISPENSADOR
// ========================================

class Dispensador extends Dispositivo {
    async dispensar(payload) {
        const datosValidados = this.validar(payload);
        const comando = this.construirComando(datosValidados);
        const respuestaEsperada = this.obtenerRespuestaEsperada();

        const resultadoArduino = await this.arduino.enviar(comando, respuestaEsperada);

        await this.marcarActivo();
        await this.actualizarNivelDespuesDeDispensar(datosValidados);

        const evento = await this.registrarEvento({
            accion: this.obtenerAccion(),
            comando,
            ...this.construirDatosEvento(datosValidados),
            resultadoArduino
        });

        return {
            success: true,
            message: this.consruirMensajeExito(datosValidados),
            evento,
            arduino: resultadoArduino
        };
    }

    validar() {
        throw new AppError('El método validar() debe ser implementado en la subclase', 500);
    }

    construirComando() {
        throw new AppError('El método construirComando() debe ser implementado en la subclase', 500);
    }

    construirDatosEvento() {
        throw new AppError('El método construirDatosEvento() debe ser implementado en la subclase', 500);
    }

    construirMensajeExito() {
        throw new AppError('El método construirMensajeExito() debe ser implementado en la subclase', 500);
    }

    obtenerAccion() {
        return 'dispensar';
    }

    obtenerRespuestaEsperada() {
        return null;
    }

    async actualizarNivelDespuesDeDispensar() {}
}

class DispensadorComida extends Dispensador {
    validar(payload) {
        const gramos = validarNumeroEnRango(payload.gramos ?? payload.gramos, 'Gramos a dispensar', 10, 500);

        return { gramos: Math.round(gramos) };
    }

    construirComando({ gramos }) {
        const duracionMs = this.calcularDuracion(gramos);
        return `DISPENSE:${duracionMs}`;
    }

    calcularDuracion(gramos) {
        return Math.round(gramos * 50);
    }

    construirDatosEvento({ gramos }) {
        const duracionMs = this.calcularDuracion(gramos);

        return {
            gramos,
            duracion_ms: duracionMs,
            duracion_s: (duracionMs / 1000).toFixed(2)
        };
    }

    consruirMensajeExito({ gramos }) {
        return `Se han dispensado ${gramos} gramos de comida.`;
     }

    obtenerAccion() {
        return 'dispensar_comida';
     }

    obtenerRespuestaEsperada() {
        return 'DISPENSE:OK';
     }

     async actualizarNivelDespuesDeDispensar({ gramos }) {
        const dispositivo = await this.dispositivoRepo.obtenerPorId(this.id);
        const nivelActual = Number(dispositivo?.nivel ?? 100);

        const reduccion = gramos / 10;
        const nuevoNivel = Math.max(0, nivelActual - reduccion);

        await this.dispositivoRepo.actualizar(this.id, {
            nivel: nuevoNivel,
            estado: 'activo'
        });
    }
}
class DispensadorAgua extends Dispensador {
    validar(payload) {
        const duracionMs = validarNumeroEnRango(
            payload.duracion ?? payload.duracionMs ?? payload.duration,
            'Duración de apertura en milisegundos',
            1000,
            10000
        );

        return { duracionMs: Math.round(duracionMs),
                duracionS: Math.round(duracionMs / 1000)
         };
    }

    construirComando({ duracionMs }) {
        return `WATER:${duracionMs}`;
    }

    construirDatosEvento({ duracionMs, duracionS }) {
        return {
            duracion_ms: duracionMs,
            duracion_s: duracionS
        };
    }

    consruirMensajeExito({ duracionS }) {
        return `Se ha abierto el dispensador de agua durante ${duracionS} segundos.`;
    }

    obtenerAccion() {
        return 'dispensar_agua';
    }

    obtenerRespuestaEsperada() {
        return 'WATER:OK';
    }

    async actualizarNivelDespuesDeDispensar({ duracionS }) {
        const dispositivo = await this.dispositivoRepo.obtenerPorId(this.id);
        const nivelActual = Number(dispositivo?.nivel ?? 100);

        const reduccion = duracionS * 2;
        const nuevoNivel = Math.max(0, Math.round(nivelActual - reduccion));

        await this.dispositivoRepo.actualizar(this.id, {
            nivel: nuevoNivel,
            estado: 'activo'
        });
    }
}

// ========================================
// SENSORES
// ========================================

class Sensor extends Dispositivo {
    async registrarLectura() {
        throw new AppError('El método registrarLectura() debe ser implementado en la subclase', 500);
    }
}

class SensorTemperatura extends Sensor {
    async registrarLectura(payload) {
        const valor = validarNumeroEnRango(
            payload.valor ?? payload.temperatura,
            'La temperatura',
            -20,
            80
        );

        const config = await this.configRepo.obtener();
        const minima = Number(config.temperatura.minima);
        const maxima = Number(config.temperatura.maxima);

        let estado = 'normal';
        let alerta = false;
        let mensaje = `Temperatura registrada: ${valor}°C.`;

        if (valor < minima) {
            estado = ' baja';
            alerta = true;
            mensaje = `Alerta: Temperatura baja (${valor}°C).`;
        } else if (valor > maxima) {
            estado = 'alta';
            alerta = true;
            mensaje = `Alerta: Temperatura alta (${valor}°C).`;
        }

        await this.dispositivoRepo.actualizar(this.id, {
            estado: 'activo',
            ultima_lectura: valor
        });

        const evento = await this.registrarEvento({
            accion: 'lectura_temperatura',
            valor,
            unidad: '°C',
            minima,
            maxima,
            estado_temperatura: estado,
            alerta,
            mensaje
        });

        return {
            success: true,
            message: mensaje,
            temperatura: valor,
            estado: estado,
            alerta,
            evento
        };
    }
}

class SensorMovimiento extends Sensor {
    async registrarLectura(payload) {
        const presente = this.validarPresencia(payload);

        await this.dispositivoRepo.actualizar(this.id, {
            estado: 'activo',
            ultima_lectura: presente
        });

        const evento = await this.registrarEvento({
            accion: 'lectura_presencia',
            presente,
            detectado: presente,
            mensaje: presente ? 'Movimiento detectado' : 'No se detecta movimiento'
        });

        return {
            success: true,
            message: presente ? 'Movimiento detectado' : 'No se detecta movimiento',
            presente,
            detectado: presente,
            evento
        };
    }

    validarPresencia(payload) {
        const valor = payload.presente ?? payload.detectado ?? payload.presencia;

        if (typeof valor === 'boolean') {
            return valor;
        }

        if (typeof valor == 'number') {
            if (valor === 1) return true;
            if (valor === 0) return false;
        }

        if (typeof valor === 'string') {
            const texto = valor.toLowerCase().trim();
            const valorLower = valor.toLowerCase();
            if (['true', '1', 'si', 'sí', 'detectado'].includes(texto)) {
                return true;
            }
            if (['false', '0', 'no', 'not', 'sin_presencia'].includes(texto)) {
                return false;
            }
        }

        throw new AppError('Valor de presencia no válido. Debe ser booleano, numérico (1/0) o texto (true/false/si/no)', 400);
    }
}

// ========================================
// FACTORY DE DISPOSITIVOS
// ========================================

function crearDependencias() {
    return {
        dispositivoRepo: new DispositivoRepository(),
        eventoRepo: new EventoRepository(),
        configRepo: new ConfiguracionRepository(),
        arduino: new ArduinoGateway()
    };
}

function crearDispositivo(id) {
    const dependencias = crearDependencias();

    return {
        comida: new DispensadorComida({
            id: 'dispensador_comida',
            nombre: 'Dispensador de comida',
            tipo: 'dispensador',
            categoria: 'comida'
        }, dependencias),
        agua: new DispensadorAgua({
            id: 'dispensador_agua',
            nombre: 'Dispensador de agua',
            tipo: 'dispensador',
            categoria: 'agua'
        }, dependencias),
        temperatura: new SensorTemperatura({
            id: 'sensor_temperatura',
            nombre: 'Sensor de temperatura',
            tipo: 'sensor',
            categoria: 'temperatura'
        }, dependencias),
        presencia: new SensorMovimiento({
            id: 'sensor_movimiento',
            nombre: 'Sensor de presencia',
            tipo: 'sensor',
            categoria: 'presencia'
        }, dependencias),

        repositorio: dependencias.dispositivoRepo,
        arduino: dependencias.arduino
        };
}

// ========================================
// RUTAS
// ========================================

router.get('/status', asyncHandler(async (req, res) => {
    const { arduino } = crearDispositivo();

    res.json({
        success: true,
        servidor: 'en línea',
        arduinoConectado: arduino.estaDisponible(),
        timestamp: obtenerTimestamp()
    });
}));

router.get('/dispositivos', asyncHandler(async (req, res) => {
    const { repositorio } = crearDispositivo();
    const dispositivos = await repositorio.listar();
    res.json({ success: true, dispositivos });
}));

router.get('/devices', asyncHandler(async (req, res) => {
    const { repositorio } = crearDispositivo();
    const dispositivos = await repositorio.listar();
    res.json({ success: true, dispositivos });
}));

router.get('/dispositivos/:id/status', asyncHandler(async (req, res) => {
    const { repositorio, arduino } = crearDispositivo();
    const dispositivo = await repositorio.obtenerPorId(req.params.id);

    if (!dispositivo) {
        throw new AppError(`Dispositivo con id ${req.params.id} no encontrado`, 404);
    }

    res.json({
        success: true,
        ...dispositivo,
        online: arduino.estaDisponible(),
        timestamp: obtenerTimestamp()
    });
}));

// ========================================
// RUTAS DE COMIDA
// ========================================

async function obtenerEstadoComida(req, res) {
    const { comida } = crearDispositivo();
    const estado = await comida.obtenerEstado();

    res.json({
        success: true,
        ...estado
    });
}

async function dispensarComida(req, res) {
    const { comida } = crearDispositivo();
    const resultado = await comida.dispensar(req.body);

    res.json(resultado);
}

// Ruta oficial usada por frontend/js/api.js
router.get('/food/status', asyncHandler(obtenerEstadoComida));
router.post('/food/dispense', asyncHandler(dispensarComida));

// Alias en español por compatibilidad
router.get('/comida/status', asyncHandler(obtenerEstadoComida));
router.post('/comida/dispense', asyncHandler(dispensarComida));


// ========================================
// RUTAS DE AGUA
// ========================================

async function obtenerEstadoAgua(req, res) {
    const { agua } = crearDispositivo();
    const estado = await agua.obtenerEstado();

    res.json({
        success: true,
        ...estado
    });
}

async function dispensarAgua(req, res) {
    const { agua } = crearDispositivo();
    const resultado = await agua.dispensar(req.body);

    res.json(resultado);
}

// Ruta oficial usada por frontend/js/api.js
router.get('/water/status', asyncHandler(obtenerEstadoAgua));
router.post('/water/dispense', asyncHandler(dispensarAgua));

// Alias en español por compatibilidad
router.get('/agua/status', asyncHandler(obtenerEstadoAgua));
router.post('/agua/dispense', asyncHandler(dispensarAgua));

// ========================================
// RUTAS DE SENSORES
// ========================================

router.get('/sensores/status', asyncHandler(async (req, res) => {
    const { temperatura, presencia } = crearDispositivo();

    const estadoTemperatura = await temperatura.obtenerEstado();
    const estadoPresencia = await presencia.obtenerEstado();

    res.json({
        success: true,
        sensores: [
            estadoTemperatura,
            estadoPresencia
        ]
    });
}));

router.post('/sensores/temperatura', asyncHandler(async (req, res) => {
    const { temperatura } = crearDispositivo();
    const resultado = await temperatura.registrarLectura(req.body);
    res.json(resultado);
}));

router.post('/sensores/presencia', asyncHandler(async (req, res) => {
    const { presencia } = crearDispositivo();
    const resultado = await presencia.registrarLectura(req.body);
    res.json(resultado);
}));

// ========================================
// RUTA DE PRUEBA DE SERVO
// ========================================

router.post('/test/servo', asyncHandler(async (req, res) => {
    const { arduino } = crearDispositivo();
    const resultadoArduino = await arduino.enviar('TEST_SERVO', 'SERVO:COMPLETADO');
    
    const eventoRepo = new EventoRepository();
    const evento = await eventoRepo.registrar({
        dispositivo: 'dispensador_comida',
        dispositivo_nombre: 'Dispensador de comida',
        tipo: 'dispensador',
        categoria: 'comida',
        accion: 'test_servo',
        comando: 'TEST_SERVO'
    });
    
    res.json({
        success: true,
        message: 'Prueba de servo completada',
        evento,
        arduino: resultadoArduino
    });
}));

// ========================================
// MANEJO DE ERRORES
// ========================================

router.use((err, req, res, next) => {
    console.error('[dispositivos.js]', err.message);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        error: err.message || 'Error interno del servidor'
    });
});

module.exports = router;