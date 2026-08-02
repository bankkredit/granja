/**
 * app.js - Módulo principal
 * Inicializa Firebase, maneja autenticación, navegación, temas y carga de vistas.
 * Versión 2.1 - Corregida carga de módulos Ventas y Clientes
 */

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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentView = 'dashboard';
let configuraciones = {};
let theme = localStorage.getItem('theme') || 'light';
let charts = {};
let loginModalMostrado = false;
let modulosCargados = false;

const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const themeToggle = document.getElementById('themeToggle');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const pageTitle = document.getElementById('pageTitle');
const menuItems = document.querySelectorAll('.menu li[data-view]');
const menuConfig = document.getElementById('menuConfig');
const menuUsuarios = document.getElementById('menuUsuarios');
const menuVentas = document.getElementById('menuVentas');
const menuClientes = document.getElementById('menuClientes');
const views = {
    dashboard: document.getElementById('view-dashboard'),
    animales: document.getElementById('view-animales'),
    eventos: document.getElementById('view-eventos'),
    ventas: document.getElementById('view-ventas'),
    clientes: document.getElementById('view-clientes'),
    reportes: document.getElementById('view-reportes'),
    genealogia: document.getElementById('view-genealogia'),
    usuarios: document.getElementById('view-usuarios'),
    configuracion: document.getElementById('view-configuracion')
};

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

auth.onAuthStateChanged(async user => {
    console.log('[app.js] Auth state changed:', user ? 'Usuario autenticado' : 'No autenticado');
    
    if (user) {
        try {
            const snapshot = await db.ref(`users/${user.uid}`).once('value');
            let data = snapshot.val();
            
            if (!data) {
                await db.ref(`users/${user.uid}`).set({
                    email: user.email,
                    nombre: user.email.split('@')[0],
                    rol: 'empleado',
                    createdAt: Date.now()
                });
                const newSnap = await db.ref(`users/${user.uid}`).once('value');
                data = newSnap.val();
                mostrarToast('Perfil creado automáticamente', 'success');
            }
            
            currentUser = {
                uid: user.uid,
                email: user.email,
                rol: data.rol || 'empleado',
                nombre: data.nombre || user.email
            };
            
            // Actualizar window.currentUser para otros módulos
            window.currentUser = currentUser;
            
            userInfo.textContent = currentUser.nombre;
            if (userAvatar) {
                userAvatar.innerHTML = currentUser.nombre.charAt(0).toUpperCase();
            }
            
            const isAdmin = currentUser.rol === 'admin' || currentUser.email === 'vinicio@geomira.se';
            if (menuConfig) menuConfig.style.display = isAdmin ? 'flex' : 'none';
            if (menuUsuarios) menuUsuarios.style.display = isAdmin ? 'flex' : 'none';
            if (menuVentas) menuVentas.style.display = isAdmin ? 'flex' : 'none';
            if (menuClientes) menuClientes.style.display = isAdmin ? 'flex' : 'none';
            
            await cargarConfiguraciones();
            
            // ============================================================
            // CARGA DE MÓDULOS - Corregida
            // ============================================================
            
            // Verificar que los módulos estén disponibles
            console.log('[app.js] Verificando módulos...');
            console.log('[app.js] cargarClientes disponible:', typeof window.cargarClientes);
            console.log('[app.js] cargarVentas disponible:', typeof window.cargarVentas);
            
            // Cargar clientes primero (dependencia de ventas)
            if (typeof window.cargarClientes === 'function') {
                console.log('[app.js] Cargando módulo Clientes...');
                window.cargarClientes(() => {
                    console.log('[app.js] Clientes cargados correctamente');
                    // Después de cargar clientes, cargar ventas
                    if (typeof window.cargarVentas === 'function') {
                        console.log('[app.js] Cargando módulo Ventas...');
                        window.cargarVentas();
                    } else {
                        console.warn('[app.js] cargarVentas no está disponible');
                    }
                });
            } else {
                console.warn('[app.js] cargarClientes no está disponible');
                // Intentar cargar ventas directamente
                if (typeof window.cargarVentas === 'function') {
                    window.cargarVentas();
                }
            }
            
            // Cargar otros módulos en segundo plano
            setTimeout(() => {
                if (typeof window.cargarAnimales === 'function') {
                    window.cargarAnimales();
                }
                if (typeof window.cargarEventos === 'function') {
                    window.cargarEventos();
                }
                if (typeof window.cargarReportes === 'function') {
                    window.cargarReportes();
                }
                if (typeof window.cargarGenealogia === 'function') {
                    window.cargarGenealogia();
                }
                if (typeof window.cargarConfiguracion === 'function') {
                    window.cargarConfiguracion();
                }
            }, 1000);
            
            modulosCargados = true;
            
            mostrarVista('dashboard');
            
        } catch (error) {
            console.error('[app.js] Error al cargar perfil:', error);
            mostrarToast('Error al cargar perfil: ' + error.message, 'error');
        }
    } else {
        currentUser = null;
        window.currentUser = null;
        loginModalMostrado = false;
        console.log('[app.js] Usuario no autenticado, mostrando login');
        mostrarLoginModal();
    }
});

// ================================================================
// FUNCIONES DE AUTH Y NAVEGACIÓN
// ================================================================

function mostrarLoginModal() {
    console.log('[app.js] mostrarLoginModal() llamado');
    
    const container = document.getElementById('dashboardContent');
    if (!container) {
        console.error('[app.js] Contenedor dashboardContent no encontrado');
        return;
    }

    Object.keys(views).forEach(key => {
        if (views[key]) views[key].classList.remove('active');
    });

    const dashboardView = document.getElementById('view-dashboard');
    if (dashboardView) {
        dashboardView.classList.add('active');
    }
    currentView = 'dashboard';
    pageTitle.textContent = 'Dashboard';

    container.innerHTML = `
        <div class="login-container" style="display:flex;align-items:center;justify-content:center;min-height:70vh;padding:20px;">
            <div class="login-card" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:40px;max-width:420px;width:100%;box-shadow:var(--shadow-xl);border:1px solid var(--border-color);">
                <div style="text-align:center;margin-bottom:30px;">
                    <div style="font-size:3rem;display:block;margin-bottom:8px;">🐖</div>
                    <h2 style="font-size:1.5rem;font-weight:700;color:var(--text-primary);">Granja Porcina</h2>
                    <p style="color:var(--text-secondary);font-size:0.9rem;">Sistema de Gestión</p>
                </div>
                
                <form id="loginForm">
                    <div class="form-group">
                        <label>Correo electrónico</label>
                        <input type="email" id="loginEmail" class="form-control" placeholder="usuario@ejemplo.com" required>
                    </div>
                    <div class="form-group">
                        <label>Contraseña</label>
                        <input type="password" id="loginPassword" class="form-control" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:8px;width:100%;">
                        <i class="fas fa-sign-in-alt"></i> Iniciar sesión
                    </button>
                </form>
                
                <div style="margin-top:16px;text-align:center;">
                    <span style="color:var(--text-secondary);font-size:0.85rem;">¿No tienes cuenta? </span>
                    <a href="#" id="showRegisterLink" style="color:var(--color-primary);font-weight:500;text-decoration:none;">Regístrate</a>
                    <br>
                    <a href="#" id="showResetLink" style="color:var(--text-light);font-size:0.8rem;text-decoration:none;">¿Olvidaste tu contraseña?</a>
                </div>
                
                <div id="loginMessage" style="margin-top:12px;display:none;"></div>
            </div>
        </div>
    `;

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const msgDiv = document.getElementById('loginMessage');
            
            if (!email || !password) {
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:10px;border-radius:var(--radius-sm);">
                    <i class="fas fa-exclamation-circle"></i> Completa todos los campos
                </div>`;
                return;
            }
            
            try {
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = `<div style="background:var(--color-info);color:white;padding:10px;border-radius:var(--radius-sm);">
                    <i class="fas fa-spinner fa-spin"></i> Iniciando sesión...
                </div>`;
                
                await auth.signInWithEmailAndPassword(email, password);
                loginModalMostrado = false;
                mostrarToast('✅ Bienvenido', 'success');
                
            } catch (error) {
                console.error('[app.js] Error de login:', error);
                let mensaje = 'Error al iniciar sesión';
                if (error.code === 'auth/user-not-found') {
                    mensaje = 'Usuario no encontrado. ¿Necesitas registrarte?';
                } else if (error.code === 'auth/wrong-password') {
                    mensaje = 'Contraseña incorrecta. Intenta de nuevo.';
                } else if (error.code === 'auth/invalid-email') {
                    mensaje = 'Correo electrónico inválido.';
                } else if (error.code === 'auth/too-many-requests') {
                    mensaje = 'Demasiados intentos. Espera un momento.';
                }
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:10px;border-radius:var(--radius-sm);">
                    <i class="fas fa-exclamation-circle"></i> ${mensaje}
                </div>`;
            }
        });
    }

    const showRegisterLink = document.getElementById('showRegisterLink');
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarRegistroModal();
        });
    }

    const showResetLink = document.getElementById('showResetLink');
    if (showResetLink) {
        showResetLink.addEventListener('click', (e) => {
            e.preventDefault();
            const email = prompt('Ingresa tu correo electrónico para restablecer la contraseña:');
            if (email) {
                auth.sendPasswordResetEmail(email)
                    .then(() => {
                        mostrarToast('📧 Correo de restablecimiento enviado', 'success');
                    })
                    .catch(err => {
                        mostrarToast('Error: ' + err.message, 'error');
                    });
            }
        });
    }
}

function mostrarRegistroModal() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;padding:20px;">
            <div style="background:var(--bg-card);border-radius:var(--radius-lg);padding:40px;max-width:420px;width:100%;box-shadow:var(--shadow-xl);border:1px solid var(--border-color);">
                <div style="text-align:center;margin-bottom:30px;">
                    <div style="font-size:3rem;display:block;margin-bottom:8px;">🐖</div>
                    <h2 style="font-size:1.5rem;font-weight:700;color:var(--text-primary);">Crear cuenta</h2>
                    <p style="color:var(--text-secondary);font-size:0.9rem;">Regístrate para comenzar</p>
                </div>
                
                <form id="registerForm">
                    <div class="form-group">
                        <label>Nombre completo</label>
                        <input type="text" id="regName" class="form-control" placeholder="Tu nombre" required>
                    </div>
                    <div class="form-group">
                        <label>Correo electrónico</label>
                        <input type="email" id="regEmail" class="form-control" placeholder="usuario@ejemplo.com" required>
                    </div>
                    <div class="form-group">
                        <label>Contraseña (mínimo 6 caracteres)</label>
                        <input type="password" id="regPassword" class="form-control" placeholder="••••••••" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:8px;width:100%;">
                        <i class="fas fa-user-plus"></i> Registrarse
                    </button>
                </form>
                
                <div style="margin-top:16px;text-align:center;">
                    <span style="color:var(--text-secondary);font-size:0.85rem;">¿Ya tienes cuenta? </span>
                    <a href="#" id="showLoginLink" style="color:var(--color-primary);font-weight:500;text-decoration:none;">Inicia sesión</a>
                </div>
                
                <div id="registerMessage" style="margin-top:12px;display:none;"></div>
            </div>
        </div>
    `;
    
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const msgDiv = document.getElementById('registerMessage');
        
        if (!name || !email || !password) {
            msgDiv.style.display = 'block';
            msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:10px;border-radius:var(--radius-sm);">
                <i class="fas fa-exclamation-circle"></i> Completa todos los campos
            </div>`;
            return;
        }
        
        if (password.length < 6) {
            msgDiv.style.display = 'block';
            msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:10px;border-radius:var(--radius-sm);">
                <i class="fas fa-exclamation-circle"></i> La contraseña debe tener al menos 6 caracteres
            </div>`;
            return;
        }
        
        try {
            msgDiv.style.display = 'block';
            msgDiv.innerHTML = `<div style="background:var(--color-info);color:white;padding:10px;border-radius:var(--radius-sm);">
                <i class="fas fa-spinner fa-spin"></i> Registrando...
            </div>`;
            
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await db.ref(`users/${cred.user.uid}`).set({
                email: email,
                nombre: name,
                rol: 'empleado',
                createdAt: Date.now()
            });
            
            loginModalMostrado = false;
            mostrarToast('✅ Registro exitoso. Bienvenido!', 'success');
            
        } catch (error) {
            console.error('[app.js] Error de registro:', error);
            let mensaje = 'Error al registrarse';
            if (error.code === 'auth/email-already-in-use') {
                mensaje = 'Este correo ya está registrado. Inicia sesión.';
            }
            msgDiv.style.display = 'block';
            msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:10px;border-radius:var(--radius-sm);">
                <i class="fas fa-exclamation-circle"></i> ${mensaje}
            </div>`;
        }
    });
    
    document.getElementById('showLoginLink').addEventListener('click', (e) => {
        e.preventDefault();
        mostrarLoginModal();
    });
}

logoutBtn.addEventListener('click', () => {
    auth.signOut();
    loginModalMostrado = false;
    mostrarToast('Sesión cerrada', 'info');
});

// ================================================================
// CONFIGURACIONES
// ================================================================

async function cargarConfiguraciones() {
    try {
        console.log('[app.js] Cargando configuraciones...');
        const snapshot = await db.ref('configuraciones').once('value');
        let data = snapshot.val() || {};
        if (Object.keys(data).length === 0) {
            data = await crearConfiguracionesPorDefecto();
        }
        configuraciones = data;
        window.configuraciones = configuraciones;
        console.log('[app.js] Configuraciones cargadas:', Object.keys(configuraciones));
        
        db.ref('configuraciones').on('value', snap => {
            configuraciones = snap.val() || {};
            window.configuraciones = configuraciones;
        });
    } catch (error) {
        console.error('[app.js] Error cargando configuraciones:', error);
        try {
            configuraciones = await crearConfiguracionesPorDefecto();
            window.configuraciones = configuraciones;
        } catch (e) {
            console.error('[app.js] Error crítico:', e);
        }
    }
}

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
        console.log('[app.js] Configuraciones por defecto creadas');
        return defaultConfig;
    } catch (error) {
        console.error('[app.js] Error creando configuraciones:', error);
        throw error;
    }
}

// ================================================================
// NAVEGACIÓN - CORREGIDA
// ================================================================

function mostrarVista(viewName) {
    console.log('[app.js] mostrarVista() llamado para:', viewName);
    
    if (!currentUser) {
        console.log('[app.js] Usuario no autenticado, redirigiendo a login');
        mostrarLoginModal();
        return;
    }
    
    const isAdmin = currentUser.rol === 'admin' || currentUser.email === 'vinicio@geomira.se';
    
    // Verificar permisos para vistas administrativas
    if ((viewName === 'configuracion' || viewName === 'usuarios' || viewName === 'ventas' || viewName === 'clientes') && !isAdmin) {
        mostrarToast('Acceso restringido a administradores', 'warning');
        return;
    }
    
    Object.keys(views).forEach(key => {
        if (views[key]) views[key].classList.remove('active');
    });
    
    if (views[viewName]) {
        views[viewName].classList.add('active');
        currentView = viewName;
        
        const titles = {
            dashboard: 'Dashboard',
            animales: 'Animales',
            eventos: 'Eventos',
            ventas: 'Ventas',
            clientes: 'Clientes',
            reportes: 'Reportes',
            genealogia: 'Genealogía',
            usuarios: 'Usuarios',
            configuracion: 'Configuración'
        };
        pageTitle.textContent = titles[viewName] || viewName;
        
        menuItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });
        
        // ============================================================
        // CARGA DE VISTAS - CORREGIDA
        // ============================================================
        switch (viewName) {
            case 'dashboard': 
                cargarDashboard(); 
                break;
                
            case 'animales': 
                if (typeof window.cargarAnimales === 'function') {
                    window.cargarAnimales();
                } else {
                    mostrarToast('Módulo Animales no disponible', 'error');
                    console.error('[app.js] window.cargarAnimales no es una función');
                }
                break;
                
            case 'eventos':
                if (typeof window.cargarEventos === 'function') {
                    window.cargarEventos();
                } else {
                    mostrarToast('Módulo Eventos no disponible', 'error');
                    console.error('[app.js] window.cargarEventos no es una función');
                }
                break;
                
            case 'ventas':
                console.log('[app.js] Cargando vista Ventas...');
                if (typeof window.cargarVentas === 'function') {
                    window.cargarVentas();
                } else {
                    console.error('[app.js] window.cargarVentas NO es una función');
                    mostrarToast('Módulo Ventas no disponible', 'error');
                    // Intentar cargar el módulo nuevamente
                    setTimeout(() => {
                        if (typeof window.cargarVentas === 'function') {
                            window.cargarVentas();
                        }
                    }, 500);
                }
                break;
                
            case 'clientes':
                console.log('[app.js] Cargando vista Clientes...');
                if (typeof window.cargarClientes === 'function') {
                    window.cargarClientes();
                } else {
                    console.error('[app.js] window.cargarClientes NO es una función');
                    mostrarToast('Módulo Clientes no disponible', 'error');
                    setTimeout(() => {
                        if (typeof window.cargarClientes === 'function') {
                            window.cargarClientes();
                        }
                    }, 500);
                }
                break;
                
            case 'reportes':
                if (typeof window.cargarReportes === 'function') {
                    window.cargarReportes();
                } else {
                    mostrarToast('Módulo Reportes no disponible', 'error');
                }
                break;
                
            case 'genealogia':
                if (typeof window.cargarGenealogia === 'function') {
                    window.cargarGenealogia();
                } else {
                    mostrarToast('Módulo Genealogía no disponible', 'error');
                }
                break;
                
            case 'usuarios': 
                if (typeof window.cargarUsuarios === 'function') {
                    window.cargarUsuarios();
                } else {
                    mostrarToast('Módulo Usuarios no disponible', 'error');
                }
                break;
                
            case 'configuracion': 
                if (typeof window.cargarConfiguracion === 'function') {
                    window.cargarConfiguracion();
                } else {
                    mostrarToast('Módulo Configuración no disponible', 'error');
                }
                break;
                
            default:
                console.warn('[app.js] Vista no reconocida:', viewName);
        }
        
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
    } else {
        console.error('[app.js] Vista no encontrada:', viewName);
    }
}

// ================================================================
// EVENTOS DEL MENÚ
// ================================================================

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (!currentUser) {
            mostrarLoginModal();
            return;
        }
        const isAdmin = currentUser.rol === 'admin' || currentUser.email === 'vinicio@geomira.se';
        if ((view === 'configuracion' || view === 'usuarios' || view === 'ventas' || view === 'clientes') && !isAdmin) {
            mostrarToast('Acceso restringido a administradores', 'warning');
            return;
        }
        mostrarVista(view);
    });
});

menuToggle.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
});

// ================================================================
// TEMA
// ================================================================

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    theme = themeName;
    localStorage.setItem('theme', themeName);
    themeToggle.innerHTML = themeName === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}
themeToggle.addEventListener('click', () => setTheme(theme === 'light' ? 'dark' : 'light'));
setTheme(theme);

// ================================================================
// DASHBOARD
// ================================================================

async function cargarDashboard() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;
    
    if (!currentUser) {
        mostrarLoginModal();
        return;
    }
    
    container.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="loader"></div></div>';
    
    try {
        const animalesSnap = await db.ref('animales').once('value');
        const animales = animalesSnap.val() || {};
        const listaAnimales = Object.values(animales).filter(a => a.status !== 'inactivo');
        
        const eventosSnap = await db.ref('eventos').orderByChild('createdAt').limitToLast(10).once('value');
        const eventos = eventosSnap.val() || {};
        const listaEventos = Object.values(eventos).reverse();

        const ventasSnap = await db.ref('ventas').once('value');
        const ventas = ventasSnap.val() || {};
        const listaVentas = Object.values(ventas);
        const totalVentas = listaVentas.length;
        const totalIngresos = listaVentas.reduce((sum, v) => sum + (v.total || 0), 0);
        
        const clientesSnap = await db.ref('clientes').once('value');
        const clientes = clientesSnap.val() || {};
        const totalClientes = Object.keys(clientes).length;

        const total = listaAnimales.length;
        const activos = listaAnimales.filter(a => a.status === 'activo').length;
        const hembras = listaAnimales.filter(a => a.sexo === 'Hembra').length;
        const machos = listaAnimales.filter(a => a.sexo === 'Macho').length;
        const gestantes = listaAnimales.filter(a => a.estadoReproductivo === 'Gestante').length;
        const vendidos = listaAnimales.filter(a => a.status === 'vendido').length;
        const muertos = listaAnimales.filter(a => a.status === 'muerto').length;
        
        const categorias = {};
        listaAnimales.forEach(a => {
            const cat = a.categoria || 'Sin categoría';
            categorias[cat] = (categorias[cat] || 0) + 1;
        });
        const totalCategorias = Object.keys(categorias).length;

        const ultimosAnimales = [...listaAnimales]
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 5);

        const ultimosEventos = listaEventos.slice(0, 5);
        
        const isAdmin = currentUser.rol === 'admin' || currentUser.email === 'vinicio@geomira.se';

        const html = `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <div class="card-icon blue"><i class="fas fa-paw"></i></div>
                    <div class="card-value">${total}</div>
                    <div class="card-label">Total Animales</div>
                    <div class="card-change neutral"><i class="fas fa-database"></i> Registrados</div>
                </div>
                <div class="dashboard-card">
                    <div class="card-icon green"><i class="fas fa-check-circle"></i></div>
                    <div class="card-value">${activos}</div>
                    <div class="card-label">Activos</div>
                    <div class="card-change positive"><i class="fas fa-arrow-up"></i> ${total > 0 ? Math.round((activos/total)*100) : 0}%</div>
                </div>
                <div class="dashboard-card">
                    <div class="card-icon pink"><i class="fas fa-venus"></i></div>
                    <div class="card-value">${hembras}</div>
                    <div class="card-label">Hembras</div>
                    <div class="card-change neutral"><i class="fas fa-venus-mars"></i> ${total > 0 ? Math.round((hembras/total)*100) : 0}%</div>
                </div>
                <div class="dashboard-card">
                    <div class="card-icon blue"><i class="fas fa-mars"></i></div>
                    <div class="card-value">${machos}</div>
                    <div class="card-label">Machos</div>
                    <div class="card-change neutral"><i class="fas fa-venus-mars"></i> ${total > 0 ? Math.round((machos/total)*100) : 0}%</div>
                </div>
                <div class="dashboard-card">
                    <div class="card-icon purple"><i class="fas fa-baby"></i></div>
                    <div class="card-value">${gestantes}</div>
                    <div class="card-label">Gestantes</div>
                    <div class="card-change positive"><i class="fas fa-heart"></i> En gestación</div>
                </div>
                <div class="dashboard-card">
                    <div class="card-icon orange"><i class="fas fa-tags"></i></div>
                    <div class="card-value">${totalCategorias}</div>
                    <div class="card-label">Categorías</div>
                    <div class="card-change neutral"><i class="fas fa-layer-group"></i> Diferentes</div>
                </div>
                <div class="dashboard-card">
                    <div class="card-icon teal"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="card-value">${vendidos}</div>
                    <div class="card-label">Vendidos</div>
                    <div class="card-change negative"><i class="fas fa-arrow-down"></i> Salidas</div>
                </div>
                <div class="dashboard-card">
                    <div class="card-icon danger"><i class="fas fa-skull"></i></div>
                    <div class="card-value">${muertos}</div>
                    <div class="card-label">Muertos</div>
                    <div class="card-change negative"><i class="fas fa-arrow-down"></i> Bajas</div>
                </div>
                ${isAdmin ? `
                <div class="dashboard-card">
                    <div class="card-icon teal"><i class="fas fa-shopping-cart"></i></div>
                    <div class="card-value">${totalVentas}</div>
                    <div class="card-label">Ventas</div>
                    <div class="card-change positive"><i class="fas fa-arrow-up"></i> ${formatearMoneda(totalIngresos)}</div>
                </div>
                <div class="dashboard-card">
                    <div class="card-icon purple"><i class="fas fa-users"></i></div>
                    <div class="card-value">${totalClientes}</div>
                    <div class="card-label">Clientes</div>
                    <div class="card-change neutral"><i class="fas fa-user-plus"></i> Registrados</div>
                </div>
                ` : ''}
            </div>

            <div class="quick-modules">
                <div class="quick-module" onclick="mostrarVista('animales')">
                    <span class="module-icon">🐖</span>
                    <div class="module-name">Gestión Animal</div>
                    <div class="module-desc">Registrar y administrar animales</div>
                </div>
                <div class="quick-module" onclick="mostrarVista('eventos')">
                    <span class="module-icon">📋</span>
                    <div class="module-name">Eventos</div>
                    <div class="module-desc">Vacunas, pesajes, partos</div>
                </div>
                ${isAdmin ? `
                <div class="quick-module" onclick="mostrarVista('ventas')">
                    <span class="module-icon">💰</span>
                    <div class="module-name">Ventas</div>
                    <div class="module-desc">Gestionar ventas y facturas</div>
                </div>
                <div class="quick-module" onclick="mostrarVista('clientes')">
                    <span class="module-icon">👥</span>
                    <div class="module-name">Clientes</div>
                    <div class="module-desc">Administrar clientes</div>
                </div>
                ` : ''}
                <div class="quick-module" onclick="mostrarVista('reportes')">
                    <span class="module-icon">📊</span>
                    <div class="module-name">Reportes</div>
                    <div class="module-desc">Análisis y exportaciones</div>
                </div>
                <div class="quick-module" onclick="mostrarVista('genealogia')">
                    <span class="module-icon">🌳</span>
                    <div class="module-name">Genealogía</div>
                    <div class="module-desc">Árbol genealógico</div>
                </div>
                <div class="quick-module" onclick="mostrarVista('configuracion')" id="quickConfig" style="${isAdmin ? '' : 'display:none;'}">
                    <span class="module-icon">⚙️</span>
                    <div class="module-name">Configuración</div>
                    <div class="module-desc">Ajustes del sistema</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-clock"></i> Actividad Reciente</span>
                    <div>
                        ${ultimosAnimales.length > 0 ? `<span class="badge badge-purple">${ultimosAnimales.length} nuevos</span>` : ''}
                        ${ultimosEventos.length > 0 ? `<span class="badge badge-teal">${ultimosEventos.length} eventos</span>` : ''}
                    </div>
                </div>
                <div class="activity-list">
                    ${ultimosAnimales.length === 0 && ultimosEventos.length === 0 ? 
                        `<div class="empty-state">
                            <span class="empty-icon">📭</span>
                            <div class="empty-title">Sin actividad reciente</div>
                            <div class="empty-desc">Comienza registrando animales o eventos</div>
                        </div>` : ''
                    }
                    ${ultimosAnimales.map(a => `
                        <div class="activity-item">
                            <div class="activity-icon green"><i class="fas fa-plus"></i></div>
                            <div class="activity-content">
                                <div class="activity-text">
                                    <strong>Nuevo animal</strong> - ${a.numero} ${a.nombre ? `(${a.nombre})` : ''}
                                    <span class="badge badge-purple" style="margin-left:8px;">${a.categoria || 'Sin categoría'}</span>
                                </div>
                                <div class="activity-time">${formatearFechaHora(a.createdAt)}</div>
                            </div>
                        </div>
                    `).join('')}
                    ${ultimosEventos.map(e => {
                        const animal = animales[e.animalId];
                        const nombreAnimal = animal ? `${animal.numero} - ${animal.nombre || ''}` : e.animalId;
                        const iconosEventos = {
                            pesaje: '⚖️',
                            vacuna: '💉',
                            tratamiento: '💊',
                            inseminacion: '🧬',
                            parto: '🐷',
                            cambioCorral: '🏠',
                            venta: '💰',
                            muerte: '⚰️',
                            diagnostico: '🔬',
                            destete: '🐖'
                        };
                        return `
                            <div class="activity-item">
                                <div class="activity-icon purple"><i class="fas fa-calendar-alt"></i></div>
                                <div class="activity-content">
                                    <div class="activity-text">
                                        ${iconosEventos[e.tipoEvento] || '📌'} <strong>${e.tipoEvento}</strong> - ${nombreAnimal}
                                        <span class="badge badge-outline" style="margin-left:8px;">${Object.entries(e.datos || {}).filter(([k,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' | ') || 'Sin detalles'}</span>
                                    </div>
                                    <div class="activity-time">${formatearFechaHora(e.createdAt)}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;

        const badgeAnimales = document.getElementById('badgeAnimales');
        if (badgeAnimales) {
            badgeAnimales.textContent = total;
            badgeAnimales.className = `menu-badge ${total === 0 ? 'empty' : ''}`;
        }

        const quickConfig = document.getElementById('quickConfig');
        if (quickConfig) {
            quickConfig.style.display = isAdmin ? '' : 'none';
        }

    } catch (error) {
        console.error('[Dashboard] Error:', error);
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--color-danger);display:block;margin-bottom:12px;"></i>
                <h3>Error al cargar el dashboard</h3>
                <p style="color:var(--text-secondary);">${error.message}</p>
                <button class="btn btn-primary" onclick="cargarDashboard()" style="margin-top:12px;">
                    <i class="fas fa-sync"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// ================================================================
// USUARIOS
// ================================================================

async function cargarUsuarios() {
    const container = document.getElementById('usuariosContent');
    if (!container) return;
    
    const isAdmin = currentUser?.rol === 'admin' || currentUser?.email === 'vinicio@geomira.se';
    
    if (!isAdmin) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:40px;">
                <i class="fas fa-user" style="font-size:3rem;color:var(--color-primary);display:block;margin-bottom:16px;"></i>
                <h3>Mi Perfil</h3>
                <div style="background:var(--bg-primary);border-radius:8px;padding:16px;margin:16px 0;text-align:left;max-width:400px;margin:16px auto;">
                    <p><strong>Nombre:</strong> ${currentUser?.nombre || 'N/A'}</p>
                    <p><strong>Email:</strong> ${currentUser?.email || 'N/A'}</p>
                    <p><strong>Rol:</strong> ${currentUser?.rol || 'empleado'}</p>
                    <p><strong>UID:</strong> ${currentUser?.uid || 'N/A'}</p>
                </div>
                <p style="color:var(--text-secondary);">Para gestionar usuarios, necesitas permisos de administrador.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="loader"></div></div>';
    
    try {
        const snapshot = await db.ref('users').once('value');
        const usuarios = snapshot.val() || {};
        let html = `
            <div class="card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-users"></i> Usuarios del Sistema (${Object.keys(usuarios).length})</span>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Fecha Registro</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(usuarios).map(([uid, data]) => `
                                <tr>
                                    <td><strong>${data.nombre || 'Sin nombre'}</strong></td>
                                    <td>${data.email}</td>
                                    <td><span class="badge ${data.rol === 'admin' ? 'badge-warning' : 'badge-purple'}">${data.rol || 'empleado'}</span></td>
                                    <td>${data.createdAt ? formatearFecha(data.createdAt) : '-'}</td>
                                    <td class="actions">
                                        ${currentUser.uid !== uid ? `
                                            <button class="btn btn-sm btn-secondary" onclick="cambiarRolUsuario('${uid}')" title="Cambiar rol">
                                                <i class="fas fa-user-cog"></i>
                                            </button>
                                            <button class="btn btn-sm btn-danger" onclick="eliminarUsuario('${uid}')" title="Eliminar usuario">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : '<span class="badge badge-outline">Tú</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--color-danger);display:block;margin-bottom:12px;"></i>
                <h3>Error al cargar usuarios</h3>
                <p style="color:var(--text-secondary);">${error.message}</p>
            </div>
        `;
    }
}

// ================================================================
// FUNCIONES GLOBALES PARA USUARIOS
// ================================================================

window.cambiarRolUsuario = async function(uid) {
    if (currentUser?.rol !== 'admin' && currentUser?.email !== 'vinicio@geomira.se') {
        mostrarToast('⛔ No autorizado. Solo administradores.', 'error');
        return;
    }
    const nuevoRol = prompt('Ingresa el nuevo rol (admin o empleado):');
    if (!nuevoRol || !['admin','empleado'].includes(nuevoRol.toLowerCase())) {
        return mostrarToast('Rol inválido. Debe ser admin o empleado.', 'warning');
    }
    try {
        await db.ref(`users/${uid}/rol`).set(nuevoRol.toLowerCase());
        mostrarToast('✅ Rol actualizado', 'success');
        cargarUsuarios();
    } catch (error) {
        mostrarToast('❌ Error: ' + error.message, 'error');
    }
};

window.eliminarUsuario = async function(uid) {
    if (currentUser?.rol !== 'admin' && currentUser?.email !== 'vinicio@geomira.se') {
        mostrarToast('⛔ No autorizado. Solo administradores.', 'error');
        return;
    }
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    try {
        await db.ref(`users/${uid}`).remove();
        mostrarToast('✅ Usuario eliminado', 'success');
        cargarUsuarios();
    } catch (error) {
        mostrarToast('❌ Error: ' + error.message, 'error');
    }
};

// ================================================================
// EXPOSICIÓN GLOBAL
// ================================================================

window.db = db;
window.auth = auth;
window.currentUser = currentUser;
window.configuraciones = configuraciones;
window.mostrarVista = mostrarVista;
window.cargarConfiguraciones = cargarConfiguraciones;
window.cargarDashboard = cargarDashboard;
window.cargarUsuarios = cargarUsuarios;
window.crearConfiguracionesPorDefecto = crearConfiguracionesPorDefecto;

console.log('[app.js] Módulo cargado correctamente');