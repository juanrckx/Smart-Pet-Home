const { time } = require("node:console");

document.addEventListener('DOMContentLoades', () => {
    iniciarDashboard();
});

function iniciarDashboard() {
    actualizarReloj();
    cargarDashboard();

    setInterval(actualizarReloj, 1000);
    setInterval(cargarDashboard, 15000);
}

function actualizarReloj() {
    const timestamp = document.getElementById('timestamp');

    if (!timestamp) return;

    const ahora = new Date();

    timestamp.textContent = ahora.toLocaleString('es-CR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

async function cargarDashboard() {
    await Promise.allSettled([
        cargarEstadoComida(),
        cargarEstadoAgua(),
        cargarSensores(),
        cargarEstadoJuego(),
        cargarUltimosEventos()
    ]);
}

async function cargarEstadoComida() {
    const data = await ComidaApi.obtenerEstado()

    const estadoEl = document.getElementById('food-status');
    const ultimaEl = document.getElementById('food-last');

    if (!estadoEl || !ultimaEl) return;

    if (!data.success) {
        pintarEstadoPunto(estadoEl, false);
        ultimaEl.textContent = 'Error al conectar';
        return;
    }

    pintarEstadoPunto(estadoEl, data.online !== false);

    const eventos = await EventosApi.obtener({
        dispositivo: 'dispensador_comida',
        limite: 1
    });

    const ultimo = eventos.success && eventos.eventos.length > 0
        ? eventos.eventos[0]
        : null;

    ultimaEl.textContent = ultimo
        ? formatearHora(ultimo.timestamp)
        : 'Sin actividad';
}

async function cargarEstadoAgua() {
    const data = await AguaApi.obtenerEstado();

    const estadoEl = document.getElementById('water-status');
    const nivelEl = document.getElementById('water-level');

    if (!estadoEl || !nivelEl) return;

    if (!data.success) {
        pintarEstadoPunto(estadoEl, false);
        nivelEl.textContent = 'Error';
        return;
    }

    pintarEstadoPunto(estadoEl, data.online !== false);

    if (data.nivel !== null && data.nivel !== undefined) {
        nivelEl.textContent = `${data.nivel}%`;
    } else {
        nivelEl.textContent = 'No disponible';
    }
}

async function cargarEstadoJuego() {
    const premioEl = document.getElementById('game-prize');
    const intentosEl = document.getElementById('game-attempts');
    const estadoEl = document.getElementById('game-status');

    if (!premioEl || !intentosEl || !estadoEl) return;

    const data = await JuegoBotonesApi.obtenerEstado();

    if (!data.success) {
        premioEl.textContent = 'Error';
        intentosEl.textContent = '--';
        estadoEl.textContent = 'No disponible';
        estadoEl.style.color = '#dc3545';
        return;
    }

    premioEl.textContent = data.premio_disponible ? 'Sí' : 'No';
    premioEl.style.color = data.premio_disponible ? '#28a745' : '#dc3545';

    intentosEl.textContent = data.total_intentos ?? 0;

    estadoEl.textContent = data.arduino_conectado ? 'Activo' : 'Simulado / sin Arduino';
    estadoEl.style.color = data.arduino_conectado ? '#28a745' : '#F57C00';
}

async function cargarSensores() {
    const tempEl = document.getElementById('temp');
    const motionEl = document.getElementById('motion');

    if (!tempEl || !motionEl) return;

    const temperatura = await EventosApi.obtener({
        accion: 'lectura_temperatura',
        limite: 1
    });

    if (temperatura.success && temperatura.eventos.length > 0) {
        const eventoTemp = temperatura.eventos[0];
        tempEl.textContent = `${eventoTemp.valor}°C`;22
        
        if (eventoTemp.alerta) {
            tempEl.style.color = '#dc3545';
            tempEl.style.fontWeight = 'bold';
        } else {
            tempEl.style.color = '';
            tempEl.style.fontWeight = '';
        }
    } else {
        tempEl.textContent = '--°C';
    }

    const presencia = await EventosApi.obtener({
        accion: 'lectura_presencia',
        limite: 1
    });

    if (presencia.success && presencia.eventos.length > 0) {
        const eventoPresencia = presencia.eventos[0];
        motionEl.textContent = eventoPresencia.detectado
            ? 'Detectado'
            : 'No detectado';
    } else {
        motionEl.textContent = 'No detectado';
    }
}

async function cargarUltimosEventos() {
    const contenedor = document.getElementById('eventos-list');

    if (!contenedor) return;

    const data = await EventosApi.obtener({
        limite: 5,
        orden: 'desc'
    });

    if (!data.success) {
        contenedor.innerHTML = `
            <p style="color: #dc3545;">
                No se pudieron cargar los eventos.
            </p>
            `;
            return;
    }

    if (!data.eventos || data.eventos.length == 0) {
        contenedor.innerHTML = `
            <p style="color: #9E9E9E;">
                Aún no hay eventos registrados.
            </p>
            `;
            return;
    }

    contenedor.innerHTML = data.eventos.map((evento) => {
            return `
            <div style="border-left: 3px solid #2E86AB; paddin-left: 12px; margin: 10px 0;">
                <p style="margin: 0;">
                    <strong>${formatearHora(evento.timestamp)}</strong>
                    - ${escaparHTML(obtenerTextoEvento(evento))}
                </p>
                </div>
            `;
    }).join('');
}

function obtenerTextoEvento(evento) {
    if (evento.mensaje) return evento.mensaje;

    if (evento.accion === 'dispensar comida') {
        return `Comida dispensada: ${evento.gramos || 0}g`;
    }

    if (evento.accion === 'dispensar_comida') {
        return `Comida dispensada: ${evento.gramos || 0}g`;
    }

    if (evento.accion === 'dispensar_agua') {
        return `Agua abierta: ${evento.duracion_s || 0}s`;
    }

    if (evento.accion === 'lectura_temperatura') {
        return `Temperatura: ${evento.valor}°C`;
    }
    
    if (evento.accion === 'lectura_presencia') {
        return evento.detectado
            ? 'Presencia detectada'
            : 'Sin presencia detectada';
    }

    if (evento.accion) {
        return evento.accion.replaceAll('_', ' ');
    }

    return 'Evento registrado';
}

function pintarEstadoPunto(elemento, online) {
    elemento.textContent = '●';
    elemento.style.color = online ? '#28a745' : '#dc3545';
}

function formatearHora(timestamp) {
    if (!timestamp) return '--';

    const fecha = new Date(timestamp);

    if (Number.isNaN(fecha.getTime())) {
        return '--';
    }

    return fecha.toLocaleTimeString('es-CR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escaparHTML(texto) {
    return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}