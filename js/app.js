/**
 * app.js - Módulo principal
 * Inicializa Firebase, maneja autenticación, navegación, temas y carga de vistas.
 */

// ===== CONFIGURACIÓN DE FIREBASE (DATOS REALES) =====
const firebaseConfig = {
    apiKey: "AIzaSyBI4O0d_Mec38FDiuhirujCnX99PFKiXW4",
    authDomain: "projekt-pc.firebaseapp.com",
    databaseURL: "https://projekt-pc-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "projekt-pc",
    storageBucket: "projekt-pc.appspot.com",
    messagingSenderId: "90098431634",
    appId: "1:90098431634:web:7cb61800d03533c2a6984b",
    measurementId: "G-59YH8W8W1L"
};

// ===== INICIALIZACIÓN =====
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Variables globales
let currentUser = null;
let currentView = 'dashboard';
let configuraciones = {};
let theme = localStorage.getItem('theme') || 'light';
let charts = {};

// ===== REFERENCIAS DOM =====
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const themeToggle = document.getElementById('themeToggle');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const pageTitle = document.getElementById('pageTitle');
const menuItems = document.querySelectorAll('.menu li[data-view]');
const menuConfig = document.getElementById('menuConfig');
const views = {
    dashboard: document.getElementById('view-dashboard'),
    animales: document.getElementById('view-animales'),
    eventos: document.getElementById('view-eventos'),
    reportes: document.getElementById('view-reportes'),
    configuracion: document.getElementById('view-configuracion')
};

// ===== AUTENTICACIÓN =====
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

auth.onAuthStateChanged(async user => {
    if (user) {
        try {
            const snapshot = await db.ref(`usuarios/${user.uid}`).once('value');
            const data = snapshot.val();
            if (data) {
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    rol: data.rol || 'empleado',
                    nombre: data.nombre || user.email
                };
                userInfo.textContent = currentUser.nombre;
                menuConfig.style.display = currentUser.rol === 'admin' ? 'flex' : 'none';
                await cargarConfiguraciones();
                mostrarVista('dashboard');
            } else {
                await auth.signOut();
                mostrarToast('Usuario sin perfil asignado.', 'error');
            }
        } catch (error) {
            mostrarToast('Error al cargar perfil: ' + error.message, 'error');
        }
    } else {
        mostrarLoginModal();
    }
});

// ===== LOGIN MODAL =====
function mostrarLoginModal() {
    const html = `
        <form id="loginForm">
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="loginEmail" required placeholder="admin@ejemplo.com">
            </div>
            <div class="form-group">
                <label>Contraseña</label>
                <input type="password" id="loginPassword" required placeholder="••••••••">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Iniciar sesión</button>
        </form>
    `;
    mostrarModal('Iniciar sesión', html, 'Aceptar', null, 'Cancelar', () => {});
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try {
            await auth.signInWithEmailAndPassword(email, password);
            cerrarModal();
            mostrarToast('Bienvenido', 'success');
        } catch (error) {
            mostrarToast(error.message, 'error');
        }
    });
}

// ===== LOGOUT =====
logoutBtn.addEventListener('click', () => {
    auth.signOut();
    mostrarToast('Sesión cerrada', 'info');
});

// ===== CARGA DE CONFIGURACIONES =====
async function cargarConfiguraciones() {
    try {
        const snapshot = await db.ref('configuraciones').once('value');
        let data = snapshot.val() || {};
        if (Object.keys(data).length === 0) {
            data = await crearConfiguracionesPorDefecto();
        }
        configuraciones = data;
        db.ref('configuraciones').on('value', snap => {
            configuraciones = snap.val() || {};
            if (currentView === 'configuracion') cargarConfiguracion();
            if (currentView === 'animales' && typeof window.renderizarListaAnimales === 'function') {
                window.renderizarListaAnimales();
            }
        });
    } catch (error) {
        mostrarToast('Error cargando configuraciones: ' + error.message, 'error');
        try {
            configuraciones = await crearConfiguracionesPorDefecto();
        } catch (e) {
            console.error('Fatal error:', e);
        }
    }
}

// ===== CREAR CONFIGURACIONES POR DEFECTO =====
async function crearConfiguracionesPorDefecto() {
    const defaultConfig = {
        categorias: [
            { id: 'cat1', nombre: 'Madre' },
            { id: 'cat2', nombre: 'Reproductor' },
            { id: 'cat3', nombre: 'Lechón' },
            { id: 'cat4', nombre: 'Engorde' },
            { id: 'cat5', nombre: 'Cebo' }
        ],
        razas: [
            { id: 'raza1', nombre: 'Landrace' },
            { id: 'raza2', nombre: 'Duroc' },
            { id: 'raza3', nombre: 'Pietrain' },
            { id: 'raza4', nombre: 'Large White' }
        ],
        colores: [
            { id: 'col1', nombre: 'Blanco' },
            { id: 'col2', nombre: 'Negro' },
            { id: 'col3', nombre: 'Rojizo' },
            { id: 'col4', nombre: 'Pinto' }
        ],
        corrales: [
            { id: 'cor1', nombre: 'Corral 1' },
            { id: 'cor2', nombre: 'Corral 2' },
            { id: 'cor3', nombre: 'Corral 3' },
            { id: 'cor4', nombre: 'Corral 4' }
        ],
        tiposVacunas: [
            { id: 'vac1', nombre: 'Fiebre Aftosa' },
            { id: 'vac2', nombre: 'Peste Porcina' },
            { id: 'vac3', nombre: 'Parvovirus' }
        ],
        medicamentos: [
            { id: 'med1', nombre: 'Oxitetraciclina' },
            { id: 'med2', nombre: 'Penicilina' },
            { id: 'med3', nombre: 'Ivermectina' }
        ]
    };
    try {
        await db.ref('configuraciones').set(defaultConfig);
        mostrarToast('Configuraciones por defecto creadas', 'success');
        return defaultConfig;
    } catch (error) {
        console.error('Error creando configuraciones por defecto:', error);
        throw error;
    }
}

// ===== NAVEGACIÓN =====
function mostrarVista(viewName) {
    Object.keys(views).forEach(key => views[key].classList.remove('active'));
    if (views[viewName]) {
        views[viewName].classList.add('active');
        currentView = viewName;
        const titles = {
            dashboard: 'Dashboard',
            animales: 'Animales',
            eventos: 'Eventos',
            reportes: 'Reportes',
            configuracion: 'Configuración'
        };
        pageTitle.textContent = titles[viewName] || viewName;
        menuItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });
        switch (viewName) {
            case 'dashboard': cargarDashboard(); break;
            case 'animales':
                if (typeof window.cargarAnimales === 'function') window.cargarAnimales();
                else mostrarToast('Módulo Animales no disponible', 'error');
                break;
            case 'eventos':
                if (typeof window.cargarEventos === 'function') window.cargarEventos();
                else mostrarToast('Módulo Eventos no disponible', 'error');
                break;
            case 'reportes': cargarReportes(); break;
            case 'configuracion': cargarConfiguracion(); break;
        }
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
    }
}

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        mostrarVista(item.dataset.view);
    });
});

// ===== MENÚ TOGGLE =====
menuToggle.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
});

// ===== TEMA =====
function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    theme = themeName;
    localStorage.setItem('theme', themeName);
    themeToggle.innerHTML = themeName === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}
themeToggle.addEventListener('click', () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
});
setTheme(theme);

// ===== DASHBOARD =====
async function cargarDashboard() {
    const container = document.getElementById('dashboardContent');
    container.innerHTML = '<div class="loader"></div> Cargando dashboard...';
    try {
        const animalesSnap = await db.ref('animales').once('value');
        const animales = animalesSnap.val() || {};
        const total = Object.keys(animales).length;
        const activos = Object.values(animales).filter(a => a.status === 'activo').length;
        const eventosSnap = await db.ref('eventos').orderByChild('createdAt').limitToLast(10).once('value');
        const eventos = eventosSnap.val() || {};
        const listaEventos = Object.values(eventos).reverse();

        const categorias = {};
        Object.values(animales).forEach(a => {
            const cat = a.categoria || 'Sin categoría';
            categorias[cat] = (categorias[cat] || 0) + 1;
        });

        let html = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:16px; margin-bottom:24px;">
                <div class="card"><h3>Total animales</h3><p style="font-size:2rem;font-weight:700;">${total}</p></div>
                <div class="card"><h3>Activos</h3><p style="font-size:2rem;font-weight:700;color:var(--color-success);">${activos}</p></div>
                <div class="card"><h3>Eventos recientes</h3><p style="font-size:2rem;font-weight:700;">${listaEventos.length}</p></div>
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">Distribución por categoría</span></div>
                <canvas id="chartCategorias" height="200"></canvas>
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">Últimos eventos</span></div>
                <div class="table-responsive">
                    <table>
                        <thead><tr><th>Fecha</th><th>Tipo</th><th>Animal</th></tr></thead>
                        <tbody>
                            ${listaEventos.map(e => `
                                <tr>
                                    <td>${formatearFecha(e.fecha || e.createdAt)}</td>
                                    <td><span class="badge">${e.tipoEvento}</span></td>
                                    <td>${e.animalId ? '#' + (animales[e.animalId]?.numero || e.animalId) : 'N/A'}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="3">No hay eventos recientes</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;

        setTimeout(() => {
            const ctx = document.getElementById('chartCategorias')?.getContext('2d');
            if (ctx) {
                if (charts.categorias) charts.categorias.destroy();
                charts.categorias = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(categorias),
                        datasets: [{
                            label: 'Cantidad',
                            data: Object.values(categorias),
                            backgroundColor: '#3b82f6'
                        }]
                    },
                    options: { responsive: true, plugins: { legend: { display: false } } }
                });
            }
        }, 100);
    } catch (error) {
        container.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
    }
}

// ===== REPORTES =====
async function cargarReportes() {
    const container = document.getElementById('reportesContent');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span class="card-title">Reportes</span>
                <div>
                    <button class="btn btn-success btn-sm" onclick="exportarExcelReporte()"><i class="fas fa-file-excel"></i> Excel</button>
                    <button class="btn btn-danger btn-sm" onclick="exportarPDFReporte()"><i class="fas fa-file-pdf"></i> PDF</button>
                </div>
            </div>
            <div id="reporteTabla"></div>
        </div>
    `;
    try {
        const animalesSnap = await db.ref('animales').once('value');
        const animales = animalesSnap.val() || {};
        const eventosSnap = await db.ref('eventos').once('value');
        const eventos = eventosSnap.val() || {};
        const conteoEventos = {};
        Object.values(eventos).forEach(e => {
            if (e.animalId) conteoEventos[e.animalId] = (conteoEventos[e.animalId] || 0) + 1;
        });

        let html = `
            <div class="table-responsive">
                <table>
                    <thead><tr><th>ID</th><th>Nombre</th><th>Categoría</th><th>Peso actual (kg)</th><th>Eventos</th></tr></thead>
                    <tbody>
                        ${Object.values(animales).filter(a => a.status !== 'inactivo').map(a => `
                            <tr>
                                <td>${a.numero || 'N/A'}</td>
                                <td>${a.nombre || ''}</td>
                                <td>${a.categoria || ''}</td>
                                <td>${a.pesoActual || '?'}</td>
                                <td>${conteoEventos[a.id] || 0}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="5">No hay animales activos</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        document.getElementById('reporteTabla').innerHTML = html;
    } catch (error) {
        document.getElementById('reporteTabla').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

window.exportarExcelReporte = function() {
    const tabla = document.querySelector('#reporteTabla table');
    if (tabla) exportarExcel(tabla, 'Reporte_Granja');
};
window.exportarPDFReporte = function() {
    const elemento = document.getElementById('reporteTabla');
    if (elemento) exportarPDF(elemento, 'Reporte_Granja');
};

// ===== CONFIGURACIÓN =====
async function cargarConfiguracion() {
    if (currentUser?.rol !== 'admin') {
        document.getElementById('configuracionContent').innerHTML = '<p>Acceso restringido a administradores.</p>';
        return;
    }
    const container = document.getElementById('configuracionContent');
    const listas = ['categorias', 'razas', 'colores', 'corrales', 'tiposVacunas', 'medicamentos'];
    let html = `<div class="card"><h3>Gestión de listas</h3><p>Modifique las opciones que aparecen en los formularios.</p>`;
    for (const key of listas) {
        const items = configuraciones[key] || [];
        html += `
            <div style="margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                <h4 style="text-transform:capitalize;">${key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                    ${items.length === 0 ? '<span class="badge" style="background:var(--text-light);">Sin opciones</span>' :
                        items.map(item => `<span class="badge" style="display:inline-flex;align-items:center;gap:4px;">${item.nombre} <button class="btn btn-danger btn-sm" onclick="eliminarItemConfig('${key}','${item.id}')" style="background:none;border:none;color:white;cursor:pointer;font-size:0.8rem;padding:0 4px;">&times;</button></span>`).join('')
                    }
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <input type="text" id="input_${key}" placeholder="Nuevo valor" style="flex:1;min-width:150px;padding:6px 12px;border-radius:var(--radius);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);">
                    <button class="btn btn-primary btn-sm" onclick="agregarItemConfig('${key}')">Agregar</button>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

window.agregarItemConfig = async function(key) {
    const input = document.getElementById(`input_${key}`);
    const valor = input.value.trim();
    if (!valor) return mostrarToast('Ingrese un valor', 'warning');
    const lista = configuraciones[key] || [];
    const nuevo = { id: Date.now().toString(36) + Math.random().toString(36).substring(2,5), nombre: valor };
    lista.push(nuevo);
    await db.ref(`configuraciones/${key}`).set(lista);
    input.value = '';
    mostrarToast('Agregado', 'success');
};
window.eliminarItemConfig = async function(key, id) {
    if (!confirm('¿Eliminar este ítem?')) return;
    let lista = configuraciones[key] || [];
    lista = lista.filter(item => item.id !== id);
    await db.ref(`configuraciones/${key}`).set(lista);
    mostrarToast('Eliminado', 'success');
};

// ===== EXPOSICIÓN GLOBAL =====
window.db = db;
window.auth = auth;
window.currentUser = currentUser;
window.configuraciones = configuraciones;
window.mostrarVista = mostrarVista;
window.cargarConfiguraciones = cargarConfiguraciones;
window.crearConfiguracionesPorDefecto = crearConfiguracionesPorDefecto;
window.cargarDashboard = cargarDashboard;
window.cargarReportes = cargarReportes;
window.cargarConfiguracion = cargarConfiguracion;