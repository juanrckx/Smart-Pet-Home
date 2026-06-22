/**
 * frontend/js/ui.js
 *
 * Utilidades visuales globales para Smart Pet Home.
 *
 * Objetivo:
 * - Evitar repetir funciones de alertas en cada página.
 * - Centralizar formato de fechas, badges, loading y sidebar.
 * - Mantener una interfaz más profesional y consistente.
 */

class UI {
    static paginas = [
        {
            id: 'dashboard',
            texto: '📊 Dashboard',
            indexHref: 'index.html',
            pageHref: '../index.html'
        },
        {
            id: 'mascotas',
            texto: '🐶 Mascotas',
            indexHref: 'pages/mascotas.html',
            pageHref: 'mascotas.html'
        },
        {
            id: 'comida',
            texto: '🍖 Comida',
            indexHref: 'pages/comida.html',
            pageHref: 'comida.html'
        },
        {
            id: 'agua',
            texto: '💧 Agua',
            indexHref: 'pages/agua.html',
            pageHref: 'agua.html'
        },
        {
            id: 'sensores',
            texto: '📡 Sensores',
            indexHref: 'pages/sensores.html',
            pageHref: 'sensores.html'
        },
        {
            id: 'puerta',
            texto: '🚪 Puerta',
            indexHref: 'pages/puerta.html',
            pageHref: 'puerta.html'
        },
        {
            id: 'comunicacion',
            texto: '📢 Comunicación',
            indexHref: 'pages/comunicacion.html',
            pageHref: 'comunicacion.html'
        },
        {
            id: 'juego',
            texto: '🎮 Juego',
            indexHref: 'pages/juego-botones.html',
            pageHref: 'juego-botones.html'
        },
        {
            id: 'pelotas',
            texto: '🎾 Pelotas',
            indexHref: 'pages/lanzador-pelotas.html',
            pageHref: 'lanzador-pelotas.html'
        },
        {
            id: 'configuracion',
            texto: '⚙️ Configuración',
            indexHref: 'pages/configuracion.html',
            pageHref: 'configuracion.html'
        }
    ];

    static inicializarPagina(opciones = {}) {
        this.crearSidebar(opciones);
        this.asegurarAlertContainer();
    }

    static crearSidebar(opciones = {}) {
        const {
            paginaActiva = '',
            enIndex = false,
            logoSrc = enIndex ? 'assets/logo.png' : '../assets/logo.png'
        } = opciones;

        let sidebar = document.querySelector('.sidebar');

        if (!sidebar) {
            sidebar = document.createElement('aside');
            sidebar.className = 'sidebar';
            document.body.prepend(sidebar);
        }

        const links = this.paginas.map((pagina) => {
            const href = enIndex ? pagina.indexHref : pagina.pageHref;
            const active = pagina.id === paginaActiva ? ' class="active"' : '';

            return `<a href="${href}"${active}>${pagina.texto}</a>`;
        }).join('');

        sidebar.innerHTML = `
            <div class="brand">
                <img src="${logoSrc}" alt="Smart Pet Home" class="brand-logo">
                <div class="brand-text">
                    <h1>Smart Pet Home</h1>
                    <p>Keeping pets happy</p>
                </div>
            </div>

            <nav>
                ${links}
            </nav>
        `;
    }

    static asegurarAlertContainer(id = 'alertContainer') {
        let container = document.getElementById(id);

        if (!container) {
            container = document.createElement('div');
            container.id = id;
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.maxWidth = '340px';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }

        return container;
    }

    static mostrarAlerta(mensaje, tipo = 'info', opciones = {}) {
        const {
            containerId = 'alertContainer',
            duracion = 4000
        } = opciones;

        const container = this.asegurarAlertContainer(containerId);

        const clases = {
            success: 'alert-success',
            error: 'alert-error',
            warning: 'alert-warning',
            info: 'alert-info'
        };

        const iconos = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const alerta = document.createElement('div');
        alerta.className = `alert ${clases[tipo] || clases.info}`;
        alerta.textContent = `${iconos[tipo] || iconos.info} ${mensaje}`;

        container.appendChild(alerta);

        if (duracion > 0) {
            setTimeout(() => {
                alerta.remove();
            }, duracion);
        }

        return alerta;
    }

    static mostrarResultado(elementoId, mensaje, tipo = 'info') {
        const elemento = document.getElementById(elementoId);

        if (!elemento) {
            return;
        }

        const clases = {
            success: 'alert alert-success',
            error: 'alert alert-error',
            warning: 'alert alert-warning',
            info: 'alert alert-info'
        };

        elemento.className = clases[tipo] || clases.info;
        elemento.textContent = mensaje;
        elemento.style.display = 'block';
    }

    static ocultarResultado(elementoId) {
        const elemento = document.getElementById(elementoId);

        if (!elemento) {
            return;
        }

        elemento.style.display = 'none';
        elemento.textContent = '';
    }

    static setLoading(boton, cargando, textoCargando = 'Procesando...', textoNormal = null) {
        if (!boton) {
            return;
        }

        if (cargando) {
            boton.dataset.textoOriginal = boton.textContent;
            boton.disabled = true;
            boton.textContent = textoCargando;
            return;
        }

        boton.disabled = false;
        boton.textContent = textoNormal || boton.dataset.textoOriginal || boton.textContent;
    }

    static escaparHTML(texto) {
        return String(texto ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    static formatearFechaHora(timestamp) {
        if (!timestamp) {
            return '--';
        }

        const fecha = new Date(timestamp);

        if (Number.isNaN(fecha.getTime())) {
            return '--';
        }

        return fecha.toLocaleString('es-CR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static formatearHora(timestamp) {
        if (!timestamp) {
            return '--';
        }

        const fecha = new Date(timestamp);

        if (Number.isNaN(fecha.getTime())) {
            return '--';
        }

        return fecha.toLocaleTimeString('es-CR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static obtenerNumero(id, valorDefecto = 0) {
        const elemento = document.getElementById(id);

        if (!elemento) {
            return valorDefecto;
        }

        const numero = Number(elemento.value);

        return Number.isFinite(numero) ? numero : valorDefecto;
    }

    static obtenerTexto(id, valorDefecto = '') {
        const elemento = document.getElementById(id);

        if (!elemento) {
            return valorDefecto;
        }

        return String(elemento.value ?? '').trim();
    }

    static setValor(id, valor) {
        const elemento = document.getElementById(id);

        if (!elemento) {
            return;
        }

        elemento.value = valor ?? '';
    }

    static setTexto(id, texto) {
        const elemento = document.getElementById(id);

        if (!elemento) {
            return;
        }

        elemento.textContent = texto ?? '--';
    }

    static setChecked(id, valor) {
        const elemento = document.getElementById(id);

        if (!elemento) {
            return;
        }

        elemento.checked = Boolean(valor);
    }

    static getChecked(id) {
        const elemento = document.getElementById(id);

        return Boolean(elemento && elemento.checked);
    }

    static crearBadge(texto, tipo = 'info') {
        const clases = {
            success: 'badge badge-success',
            error: 'badge badge-danger',
            danger: 'badge badge-danger',
            warning: 'badge badge-warning',
            info: 'badge badge-info'
        };

        return `<span class="${clases[tipo] || clases.info}">${this.escaparHTML(texto)}</span>`;
    }

    static pintarJSON(elementoId, data) {
        const elemento = document.getElementById(elementoId);

        if (!elemento) {
            return;
        }

        elemento.textContent = JSON.stringify(data, null, 2);
    }
}

window.UI = UI;