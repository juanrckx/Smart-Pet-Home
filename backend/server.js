/**
 * backend/server.js
 *
 * Punto de entrada principal del backend de Smart Pet Home.
 *
 * Responsabilidades:
 * - Crear el servidor Express.
 * - Configurar middlewares.
 * - Servir el frontend.
 * - Montar las rutas del backend.
 * - Inicializar archivos JSON base.
 * - Iniciar conexión con Arduino cuando no se use modo simulado.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const { iniciarConexionArduino, registrarManejadorLineaSerial } = require('./arduino-connection');
const { initJSONFile,
        leerJSON,
        escribirJSON,
        agregarElementoALista
 } = require('./utils/fileUtils');

const dispositivosRouter = require('./routes/dispositivos');
const eventosRouter = require('./routes/eventos');
const mascotasRouter = require('./routes/mascotas');
const { crearJuegoBotonesService } = require('./services/juego-botones-service');
const juegoBotonesRouter = require('./routes/juego-botones');
const { match } = require('assert');
const { access } = require('fs');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const FRONTEND_DIR = path.join(__dirname, '../frontend')
const UPLOADS_DIR = path.join(__dirname, 'uploads');

const EVENTOS_BASE = {
    eventos: []
};

const MASCOTAS_BASE = {
    mascotas: []
};

const DISPOSITIVOS_BASE = {
    dispositivos : [
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
            estado: 'pendiente',
            }
    ]
};

const JUEGO_BOTONES_BASE = {
    fecha: null,
    botoneGanador: null,
    premioEntrgado: false,
    totalIntentos: 0,
    intentos: []
};

const CONFIGURACION_BASE = {
    comida: {
        gramosPorDefecto: 100
    },
    agua: {
        duracionPorDefectoMs: 3000
    },
    temperatura: {
        minima: 18,
        maxima: 30
    }
};

async function inicializarArchivosJSON(){
    await initJSONFile('eventos.json', EVENTOS_BASE);
    await initJSONFile('mascotas.json', MASCOTAS_BASE);
    await initJSONFile('juego-botones.json', JUEGO_BOTONES_BASE);
    await initJSONFile('dispositivos.json', DISPOSITIVOS_BASE);
    await initJSONFile('configuracion.json', CONFIGURACION_BASE);

    console.log('[server] Archivos JSON verificados.');
}

function configurarMiddlewares() {
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type']
    }));

    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true}));

    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
        next();
    });

    app.use(express.static(FRONTEND_DIR));
    app.use('/uploads', express.static(UPLOADS_DIR));
}

function configurarRutas() {
        /**
         * Rutas principales.
         *
         * dispositivosRouter se monta en /api porque dentro tiene rutas como:
         * - /status
         * - /food/status
         * - /food/dispense
         * - /water/status
         * - /water/dispense
         * - /sensores/status
         */
        app.use('/api', dispositivosRouter);
    
        /**
         * Rutas separadas.
         *
         * eventosRouter queda en:
         * - /api/eventos
         *
         * mascotasRouter queda en:
         * - /api/mascotas
         */
        app.use('/api/eventos', eventosRouter);
        app.use('/api/mascotas', mascotasRouter);
        app.use('/api/juego-botones', juegoBotonesRouter);
    
        /**
         * Health check simple.
         * Esta ruta es útil para saber si Express está vivo,
         * aunque Arduino no esté conectado.
         */
        app.get('/api/health', (req, res) => {
            res.json({
                success: true,
                servidor: 'en línea',
                timestamp: new Date().toISOString()
            });
        });
    
        /**
         * Página principal.
         */
        app.get('/', (req, res) => {
            res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
        });
    
        /**
         * Si una ruta API no existe.
         */
        app.use('/api', (req, res) => {
            res.status(404).json({
                success: false,
                error: `Ruta API no encontrada: ${req.method} ${req.originalUrl}`
            });
        });
}

function configurarManejoErrores() {
    app.use((err, req, res, next) => {
        console.error('[server] Error:', err);

        if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
            return res.status(400).json({
                success: false,
                error: 'El JSON enviado no tiene un formato válido'
            });
        }

        const statusCode = err.statusCode || 500;

        res.status(statusCode).json({
            success: false,
            error: err.message || 'Error interno del servidor'
        });
    });
}

function configurarEventosArduino() {
    registrarManejadorLineaSerial(async (linea) => {
            await manejarLineaArduino(linea);
    });

    console.log('[server] Manejadores de eventos Arduino registrados.');   
}

async function manejarLineaArduino(linea) {
    const texto = String(linea || '').trim();

    if (!texto) {
        return;
    }

    const matchBoton = texto.match(/^GAME_BUTTON:(\d+)$/i);

    if (matchBoton) {
        const boton = Number(matchBoton[1]);
        await manejarBotonFisicoJuego(boton);
        return;
    }

    const matchTemperatura = texto.match(/^TEMP:([-+]?\d+(\.\d+)?)$/i);

    if (matchTemperatura) {
        const temperatura = Number(matchTemperatura[1]);
        await registrarTemperaturaDesdeArduino(temperatura);
        return;
    }

    if (/^TEMP:ERROR$/i.test(texto)) {
        console.warn('[server] Arduino reportó error leyendo temperatura.');
        return;
    }

    const matchPresencia = texto.match(/^PRESENCE:(0|1|true|false)$/i);

    if (matchPresencia) {
        const valor = String(matchPresencia[1]).toLowerCase();
        const presente = valor === '1' || valor === 'true';

        await registrarPresenciaDesdeArduino(presente);
        return
    }

    const matchPelota = texto.match(/^BALL:SHOT:(\d+)$/i);

    if (matchPelota) {
        const numeroPelota = Number(matchPelota[1]);
        await registrarEventoSistema({
            dispositivo: 'lanzador_pelotas',
            dispositivo_nombre: 'Lanzador de pelotas',
            tipo: 'juego',
            categoria: 'pelotas',
            accion: 'pelota_lanzada',
            numero_pelota: numeroPelota,
            mensaje: `Pelotalanzada #${numeroPelota}`
        });
        return;
    }

    if (/^BALL:OK$/i.test(texto)) {
        await registrarEventoSistema({
            dispositivo: 'lanzador_pelotas',
            dispositivo_nombre: 'Lanzador de pelotas',
            tipo: 'juego',
            categoria: 'pelotas',
            accion: 'lanzamiento_finalizado',
            mensaje: 'Lanzamiento de pelotas finalizado'
        });
        return;
    }

    /**
     * Si llega otra línea que no conocemos, no rompemos el servidor.
     */
    console.log(`[server] Línea Arduino sin manejador específico: ${texto}`);
}

async function manejarBotonFisicoJuego(boton) {
    console.log(`[server] Botón físico recibido desde Arduino: ${boton}`);

    const service = crearJuegoBotonesService();

    const resultado = await service.jugar({
        boton,
        origen: 'hardware'
    });

    console.log(`[server] Resultado juego físico: ${resultado.message}`);
}

async function registrarTemperaturaDesdeArduino(valor) {
    if (!Number.isFinite(valor)) {
        console.warn('[server] Temperatura inválida recibida desde Arduino');
        return;
    }

    const config = await leerJSON('configuracion.json', {
        temperatura: {
            minima: 18,
            maxima: 30
        }
    });

    const minima = Number(config?.temperatura?.minima ?? 18);
    const maxima = Number(config?.temperatura?.maxima ?? 30);

    let estadoTemperatura = 'normal';
    let alerta = false;
    let mensaje = `Temperatura normal: ${valor}°C`;

    if (valor < minima) {
        estadoTemperatura = 'baja';
        alerta = true;
        mensaje = `Temperatura baja: ${valor}°C`;
    }

    if (valor > maxima) {
        estadoTemperatura = 'alta';
        alerta = true;
        mensaje = `Temperatura alta: ${valor}°C`;
    }

    await actualizarDispositivo('sensor_temperatura', {
        estado: 'activo',
        ultima_lectura: valor
    });

    const evento = await registrarEventoSistema({
        dispositivo: 'sensor_temperatura',
        dispositivo_nombre: 'Sensor de temperatura',
        tipo: 'sensor',
        categoria: 'temperatura',
        accion: 'lectura_temperatura',
        valor,
        unidad: '°C',
        minima,
        maxima,
        estado_temperatura: estadoTemperatura,
        alerta,
        mensaje
    });

    console.log(`[server] ${evento.mensaje}`);
}

async function registrarPresenciaDesdeArduino(presente) {
    await actualizarDispositivo('sensor_movimiento', {
        estado: 'activo',
        ultima_lectura: presente
    });

    const evento = await registrarEventoSistema({
        dispositivo: 'sensor_movimiento',
        dispositivo_nombre: 'Sensor de presencia',
        tipo: 'sensor',
        categoria: 'presencia',
        accion: 'lectura_presencia',
        presente,
        detectado: presente,
        mensaje: presente
            ? 'Presencia detectada'
            : 'Sin presencia detectada'
    });

    console.log(`[server] ${evento.mensaje}`);
}

async function registrarEventoSistema(evento) {
    const eventoFinal = {
        id: generarIdEvento('evento'),
        timestamp: new Date().toISOString(),
        ...evento
    };

    await agregarElementoALista('eventos.json', 'eventos', eventoFinal);

    return eventoFinal;
}

async function actualizarDispositivo(id, cambios) {
    const data = await leerJSON('dispositivos.json', {
        dispositivos: []
    });

    if (!Array.isArray(data.dispositivos)) {
        data.dispositivos = [];
    }

    const indice = data.dispositivos.findIndex((dispositivo) => {
        return dispositivo.id === id;
    });

    if (indice === -1) {
        console.warn(`[server] No se encontró dispositivo ${id} para actualizar.`);
        return null;
    }

    data.dispositivos[indice] = {
        ...data.dispositivos[indice],
        ...cambios,
        ultima_actualizacion: new Date().toISOString()
    };

    await escribirJSON('dispositivos.json', data);

    return data.dispositivos[indice];
}

function generarIdEvento(prefix = 'evento') {
    return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

async function iniciarServidor() {
    try {
        await inicializarArchivosJSON();

        configurarMiddlewares();
        configurarRutas();
        configurarEventosArduino();
        configurarManejoErrores();
        

        iniciarConexionArduino();

        app.listen(PORT, () => {
            console.log('\n================================================');
            console.log(' Smart Pet Home Backend iniciado');
            console.log('================================================');
            console.log(`Servidor: http://localhost:${PORT}`);
            console.log(`Frontend: http://localhost:${PORT}/index.html`);
            console.log(`Health:   http://localhost:${PORT}/api/health`);
            console.log('================================================\n');
        });
    } catch (error) {
        console.error('[server] No se pudo iniciar el servidor:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\n[server] Servidor detenido manualmente.');
    process.exit(0);
});

iniciarServidor();

