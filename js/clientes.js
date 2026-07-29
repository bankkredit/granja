/**
 * clientes.js - Módulo de Gestión de Clientes (Versión Avanzada 4.0)
 * Sistema completo para registrar y administrar clientes
 * Integración con base de datos de contribuyentes (RUC) del SRI Ecuador
 * Búsqueda mejorada, indexación, caché y rendimiento optimizado
 * 
 * Características avanzadas:
 * - Búsqueda por RUC exacto o parcial (10/13 dígitos, últimos 4 dígitos)
 * - Búsqueda por nombre, teléfono, email con relevancia
 * - Filtros por tipo de cliente, estado, ciudad
 * - Paginación y ordenamiento dinámico
 * - Indexación en memoria para búsquedas instantáneas
 * - Carga asíncrona y caché de contribuyentes SRI
 * - Validaciones avanzadas de RUC ecuatoriano (algoritmo de módulo 11)
 * - Manejo de duplicados y sugerencias
 * - Exportación de datos a Excel y CSV
 * - Historial de ventas asociadas al cliente
 * - Modo oscuro y diseño responsive
 * - Internacionalización básica (ES)
 */

// ================================================================
// 1. CONFIGURACIÓN Y CONSTANTES
// ================================================================

const CLIENTES_CONFIG = {
    VERSION: '4.0.0',
    PAGE_SIZE: 15,               // Clientes por página en la tabla
    MAX_RESULTS: 100,            // Máximo de resultados en búsquedas por nombre
    CACHE_DURATION: 3600000,     // 1 hora de caché para contribuyentes
    MIN_RUC_LENGTH: 10,
    MAX_RUC_LENGTH: 13,
    DEBOUNCE_DELAY: 300,         // ms para búsqueda en tiempo real
    SUGGESTIONS_LIMIT: 5,        // Sugerencias automáticas
};

const TIPOS_CLIENTE = {
    PERSONA: 'persona',
    EMPRESA: 'empresa',
    GANADERO: 'ganadero',
    INTERMEDIARIO: 'intermediario'
};

const COLORES_TIPO = {
    persona: '#3b82f6',
    empresa: '#8b5cf6',
    ganadero: '#22c55e',
    intermediario: '#f59e0b'
};

const ICONOS_TIPO = {
    persona: '👤',
    empresa: '🏢',
    ganadero: '🐄',
    intermediario: '🔄'
};

const ESTADOS_CONTRIBUYENTE = {
    ACTIVO: 'ACTIVO',
    SUSPENDIDO: 'SUSPENDIDO',
    PASIVO: 'PASIVO',
    CERRADO: 'CERRADO'
};

// Mapeo de estados a colores y badges
const ESTADO_BADGE = {
    ACTIVO: 'badge-success',
    SUSPENDIDO: 'badge-warning',
    PASIVO: 'badge-danger',
    CERRADO: 'badge-secondary'
};

// ================================================================
// 2. VARIABLES DE ESTADO
// ================================================================

let clientesCache = {};                     // { id: cliente }
let clientesIndex = null;                  // Índice de búsqueda
let clientesListener = null;
let clienteEnEdicion = null;
let modoEdicionCliente = false;

// Datos de contribuyentes SRI
let contribuyentesData = [];
let contribuyentesCargados = false;
let contribuyentesIndex = null;             // Índice invertido para búsqueda rápida
let contribuyentesCargaTimestamp = 0;

// Estado de la UI
let filtroActual = {
    busqueda: '',
    tipo: '',
    estado: '',
    ciudad: '',
    campoOrden: 'nombre',
    ordenAsc: true,
    pagina: 1
};

// ================================================================
// 3. FUNCIONES DE UTILIDAD AVANZADAS
// ================================================================

/**
 * Capitaliza la primera letra de cada palabra
 */
function capitalize(texto) {
    if (!texto) return '';
    return texto.toLowerCase().split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/**
 * Normaliza texto para búsqueda: elimina acentos, espacios extras, y convierte a minúsculas
 */
function normalizarTexto(texto) {
    if (!texto) return '';
    // Eliminar acentos
    const sinAcentos = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Eliminar caracteres especiales y espacios múltiples
    return sinAcentos.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Verifica si un RUC es válido según el algoritmo de Ecuador (módulo 11)
 * Para cédulas y RUC de personas naturales (10 dígitos) y sociedades (13 dígitos)
 */
function validarRUC(ruc) {
    if (!ruc) return false;
    const rucLimpio = ruc.replace(/[^0-9]/g, '');
    if (rucLimpio.length < 10 || rucLimpio.length > 13) return false;
    
    // Algoritmo de módulo 11 para cédula/RUC
    // Para cédulas (10 dígitos) y RUC de persona natural (10 dígitos)
    if (rucLimpio.length === 10) {
        const digitoVerificador = parseInt(rucLimpio.charAt(9));
        const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        let suma = 0;
        for (let i = 0; i < 9; i++) {
            let valor = parseInt(rucLimpio.charAt(i)) * coeficientes[i];
            if (valor >= 10) valor -= 9;
            suma += valor;
        }
        const residuo = suma % 10;
        const digitoCalculado = (residuo === 0) ? 0 : (10 - residuo);
        return digitoCalculado === digitoVerificador;
    }
    
    // Para RUC de sociedades (13 dígitos)
    if (rucLimpio.length === 13) {
        // Verificar que los primeros 3 dígitos sean válidos según el tipo de contribuyente
        const tipo = rucLimpio.substring(0, 3);
        // Tipos válidos: 001-009 (públicos), 010-099 (privados), 100-999 (otros)
        const tipoNum = parseInt(tipo);
        if (tipoNum < 1 || tipoNum > 999) return false;
        
        // Algoritmo de módulo 11 para los últimos 10 dígitos (similar a cédula)
        const base = rucLimpio.substring(0, 10);
        const digitoVerificador = parseInt(rucLimpio.charAt(12));
        const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        for (let i = 0; i < 9; i++) {
            suma += parseInt(base.charAt(i)) * coeficientes[i];
        }
        const residuo = suma % 11;
        const digitoCalculado = (residuo === 0) ? 0 : (11 - residuo);
        return digitoCalculado === digitoVerificador;
    }
    
    return false;
}

/**
 * Formatea un RUC con separadores para mejor legibilidad
 */
function formatearRUC(ruc) {
    if (!ruc) return '';
    const limpio = ruc.replace(/[^0-9]/g, '');
    if (limpio.length === 10) {
        return limpio.substring(0, 3) + '-' + limpio.substring(3, 6) + '-' + limpio.substring(6, 10);
    } else if (limpio.length === 13) {
        return limpio.substring(0, 3) + '-' + limpio.substring(3, 6) + '-' + limpio.substring(6, 10) + '-' + limpio.substring(10, 13);
    }
    return limpio;
}

/**
 * Escapa caracteres especiales para HTML
 */
function escapeHTML(texto) {
    if (!texto) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return texto.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Formatea una fecha en formato local
 */
function formatearFecha(timestamp) {
    if (!timestamp) return 'N/A';
    const fecha = new Date(timestamp);
    return fecha.toLocaleDateString('es-EC', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/**
 * Formatea moneda en USD
 */
function formatearMoneda(cantidad, moneda = 'USD') {
    if (cantidad === undefined || cantidad === null) return '$0.00';
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 2
    }).format(cantidad);
}

/**
 * Genera un ID único con prefijo y contador
 */
async function generarId(prefijo) {
    const snapshot = await db.ref('contadores').child(prefijo).once('value');
    let contador = snapshot.val() || 0;
    contador++;
    await db.ref('contadores').child(prefijo).set(contador);
    return prefijo + contador.toString().padStart(6, '0');
}

/**
 * Verifica si el usuario actual es administrador
 */
function esAdmin() {
    return currentUser?.rol === 'admin' || currentUser?.email === 'vinicio@geomira.se';
}

/**
 * Obtiene un cliente por ID, RUC o número
 */
function obtenerClientePorId(id) {
    if (!id) return null;
    if (clientesCache[id]) return clientesCache[id];
    const cliente = Object.values(clientesCache).find(c => 
        c.id === id || c.cedula === id || c.numero === id || c.ruc === id
    );
    return cliente || null;
}

function obtenerNombreCliente(id) {
    if (!id) return 'N/A';
    const cliente = obtenerClientePorId(id);
    return cliente ? cliente.nombre : id;
}

// ================================================================
// 4. ÍNDICE DE BÚSQUEDA PARA CLIENTES (In-Memory)
// ================================================================

class IndiceClientes {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.porId = {};
        this.porRUC = {};
        this.porNombre = {};
        this.porTelefono = {};
        this.porEmail = {};
        this.porNumero = {};
        this.todosIds = [];
    }
    
    indexar(cliente) {
        if (!cliente || !cliente.id) return;
        this.porId[cliente.id] = cliente;
        this.todosIds.push(cliente.id);
        
        // Indexar RUC/cedula
        if (cliente.ruc) {
            const rucLimpio = cliente.ruc.replace(/[^0-9]/g, '');
            if (rucLimpio) {
                this.porRUC[rucLimpio] = cliente;
                // También indexar por últimos 4 dígitos para búsqueda parcial
                if (rucLimpio.length >= 4) {
                    const ultimos = rucLimpio.slice(-4);
                    if (!this.porRUC[ultimos]) this.porRUC[ultimos] = [];
                    this.porRUC[ultimos] = Array.isArray(this.porRUC[ultimos]) ? this.porRUC[ultimos].push(cliente) : [cliente];
                }
            }
        }
        if (cliente.cedula && cliente.cedula !== cliente.ruc) {
            const cedulaLimpia = cliente.cedula.replace(/[^0-9]/g, '');
            if (cedulaLimpia) {
                this.porRUC[cedulaLimpia] = cliente;
            }
        }
        
        // Indexar nombre normalizado
        if (cliente.nombre) {
            const nombreNorm = normalizarTexto(cliente.nombre);
            if (nombreNorm) {
                const palabras = nombreNorm.split(/\s+/);
                for (const palabra of palabras) {
                    if (palabra.length > 2) {
                        if (!this.porNombre[palabra]) this.porNombre[palabra] = new Set();
                        this.porNombre[palabra].add(cliente.id);
                    }
                }
            }
        }
        
        // Indexar nombre comercial
        if (cliente.nombreComercial) {
            const nombreComNorm = normalizarTexto(cliente.nombreComercial);
            if (nombreComNorm) {
                const palabras = nombreComNorm.split(/\s+/);
                for (const palabra of palabras) {
                    if (palabra.length > 2) {
                        if (!this.porNombre[palabra]) this.porNombre[palabra] = new Set();
                        this.porNombre[palabra].add(cliente.id);
                    }
                }
            }
        }
        
        // Indexar teléfono
        if (cliente.telefono) {
            const telefonoLimpio = cliente.telefono.replace(/[^0-9]/g, '');
            if (telefonoLimpio) {
                this.porTelefono[telefonoLimpio] = cliente;
                if (telefonoLimpio.length >= 4) {
                    const ultimos = telefonoLimpio.slice(-4);
                    if (!this.porTelefono[ultimos]) this.porTelefono[ultimos] = [];
                    this.porTelefono[ultimos] = Array.isArray(this.porTelefono[ultimos]) ? this.porTelefono[ultimos].push(cliente) : [cliente];
                }
            }
        }
        
        // Indexar email
        if (cliente.email) {
            const emailNormalizado = normalizarTexto(cliente.email);
            if (emailNormalizado) {
                this.porEmail[emailNormalizado] = cliente;
            }
        }
        
        // Indexar número de cliente
        if (cliente.numero) {
            this.porNumero[cliente.numero] = cliente;
        }
    }
    
    indexarTodos(lista) {
        this.reset();
        for (const cliente of lista) {
            this.indexar(cliente);
        }
    }
    
    buscar(query, campo = null) {
        const queryNorm = normalizarTexto(query);
        if (!queryNorm) return [];
        
        const resultados = new Set();
        const palabras = queryNorm.split(/\s+/);
        
        // Búsqueda por RUC exacto o parcial
        if (campo === 'ruc' || !campo) {
            const rucLimpio = query.replace(/[^0-9]/g, '');
            if (rucLimpio) {
                // Buscar exacto
                if (this.porRUC[rucLimpio]) {
                    const cliente = this.porRUC[rucLimpio];
                    if (!Array.isArray(cliente)) {
                        resultados.add(cliente.id);
                    } else {
                        for (const c of cliente) resultados.add(c.id);
                    }
                }
                // Buscar por últimos dígitos si tiene al menos 4
                if (rucLimpio.length >= 4) {
                    const ultimos = rucLimpio.slice(-4);
                    if (this.porRUC[ultimos]) {
                        const clientes = Array.isArray(this.porRUC[ultimos]) ? this.porRUC[ultimos] : [this.porRUC[ultimos]];
                        for (const c of clientes) resultados.add(c.id);
                    }
                }
            }
        }
        
        // Búsqueda por nombre (todas las palabras)
        if (campo === 'nombre' || !campo) {
            for (const palabra of palabras) {
                if (palabra.length > 2 && this.porNombre[palabra]) {
                    for (const id of this.porNombre[palabra]) {
                        resultados.add(id);
                    }
                }
            }
        }
        
        // Búsqueda por teléfono
        if (campo === 'telefono' || !campo) {
            const telefonoLimpio = query.replace(/[^0-9]/g, '');
            if (telefonoLimpio) {
                if (this.porTelefono[telefonoLimpio]) {
                    const cliente = this.porTelefono[telefonoLimpio];
                    if (!Array.isArray(cliente)) {
                        resultados.add(cliente.id);
                    } else {
                        for (const c of cliente) resultados.add(c.id);
                    }
                }
                if (telefonoLimpio.length >= 4) {
                    const ultimos = telefonoLimpio.slice(-4);
                    if (this.porTelefono[ultimos]) {
                        const clientes = Array.isArray(this.porTelefono[ultimos]) ? this.porTelefono[ultimos] : [this.porTelefono[ultimos]];
                        for (const c of clientes) resultados.add(c.id);
                    }
                }
            }
        }
        
        // Búsqueda por email
        if (campo === 'email' || !campo) {
            const emailNorm = normalizarTexto(query);
            if (emailNorm && this.porEmail[emailNorm]) {
                resultados.add(this.porEmail[emailNorm].id);
            }
        }
        
        // Búsqueda por número de cliente
        if (campo === 'numero' || !campo) {
            const num = query.replace(/[^0-9]/g, '');
            if (num && this.porNumero[num]) {
                resultados.add(this.porNumero[num].id);
            }
        }
        
        return Array.from(resultados).map(id => this.porId[id]).filter(Boolean);
    }
}

// Inicializar índice
clientesIndex = new IndiceClientes();

// ================================================================
// 5. CARGA DE BASE DE DATOS DE CONTRIBUYENTES (SRI)
// ================================================================

/**
 * Carga la base de datos de contribuyentes desde el archivo CSV
 * Implementa caché y revalidación periódica
 */
async function cargarContribuyentes(forzar = false) {
    const ahora = Date.now();
    if (contribuyentesCargados && !forzar && (ahora - contribuyentesCargaTimestamp) < CLIENTES_CONFIG.CACHE_DURATION) {
        console.log('[clientes.js] Usando caché de contribuyentes');
        return;
    }
    
    try {
        console.log('[clientes.js] Cargando base de datos de contribuyentes SRI...');
        const response = await fetch('database.csv');
        if (!response.ok) {
            throw new Error(`Error al cargar database.csv: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        if (!text || text.trim().length === 0) {
            throw new Error('El archivo CSV está vacío');
        }
        
        // Parsear CSV con delimitador '|', manejar campos entre comillas
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error('El archivo CSV no contiene datos suficientes');
        }
        
        // Obtener encabezados
        const headers = lines[0].split('|').map(h => h.trim());
        console.log(`[clientes.js] Encabezados (${headers.length}):`, headers);
        
        // Validar encabezados mínimos
        const requiredHeaders = ['NUMERO_RUC', 'RAZON_SOCIAL'];
        const missing = requiredHeaders.filter(h => !headers.includes(h));
        if (missing.length > 0) {
            throw new Error(`Faltan encabezados obligatorios: ${missing.join(', ')}`);
        }
        
        contribuyentesData = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('|').map(v => v.trim());
            const obj = {};
            headers.forEach((h, idx) => {
                obj[h] = values[idx] || '';
            });
            contribuyentesData.push(obj);
        }
        
        // Construir índice de búsqueda para contribuyentes
        construirIndiceContribuyentes(contribuyentesData);
        
        contribuyentesCargados = true;
        contribuyentesCargaTimestamp = Date.now();
        console.log(`[clientes.js] Contribuyentes cargados: ${contribuyentesData.length}`);
        
        return true;
    } catch (error) {
        console.error('[clientes.js] Error cargando contribuyentes:', error);
        mostrarToast('⚠️ No se pudo cargar la base de datos de contribuyentes: ' + error.message, 'warning');
        return false;
    }
}

/**
 * Construye un índice invertido para búsqueda rápida de contribuyentes
 */
function construirIndiceContribuyentes(data) {
    contribuyentesIndex = {
        porRUC: {},
        porNombre: {},
        porNombreComercial: {},
        porCIIU: {}
    };
    
    for (const c of data) {
        const ruc = c.NUMERO_RUC || '';
        if (ruc) {
            const rucLimpio = ruc.replace(/[^0-9]/g, '');
            contribuyentesIndex.porRUC[rucLimpio] = c;
            if (rucLimpio.length >= 4) {
                const ultimos = rucLimpio.slice(-4);
                if (!contribuyentesIndex.porRUC[ultimos]) contribuyentesIndex.porRUC[ultimos] = [];
                if (!Array.isArray(contribuyentesIndex.porRUC[ultimos])) {
                    contribuyentesIndex.porRUC[ultimos] = [contribuyentesIndex.porRUC[ultimos], c];
                } else {
                    contribuyentesIndex.porRUC[ultimos].push(c);
                }
            }
        }
        
        const nombre = c.RAZON_SOCIAL || '';
        if (nombre) {
            const nombreNorm = normalizarTexto(nombre);
            if (nombreNorm) {
                const palabras = nombreNorm.split(/\s+/);
                for (const p of palabras) {
                    if (p.length > 2) {
                        if (!contribuyentesIndex.porNombre[p]) contribuyentesIndex.porNombre[p] = [];
                        contribuyentesIndex.porNombre[p].push(c);
                    }
                }
            }
        }
        
        const nombreCom = c.NOMBRE_FANTASIA_COMERCIAL || '';
        if (nombreCom) {
            const nombreComNorm = normalizarTexto(nombreCom);
            if (nombreComNorm) {
                const palabras = nombreComNorm.split(/\s+/);
                for (const p of palabras) {
                    if (p.length > 2) {
                        if (!contribuyentesIndex.porNombreComercial[p]) contribuyentesIndex.porNombreComercial[p] = [];
                        contribuyentesIndex.porNombreComercial[p].push(c);
                    }
                }
            }
        }
        
        const ciuu = c.CODIGO_CIIU || '';
        if (ciuu) {
            const ciiuNorm = normalizarTexto(ciuu);
            if (ciiuNorm) {
                if (!contribuyentesIndex.porCIIU[ciiuNorm]) contribuyentesIndex.porCIIU[ciiuNorm] = [];
                contribuyentesIndex.porCIIU[ciiuNorm].push(c);
            }
        }
    }
    console.log(`[clientes.js] Índice de contribuyentes construido: ${Object.keys(contribuyentesIndex.porRUC).length} RUCs indexados`);
}

// ================================================================
// 6. BÚSQUEDA DE CONTRIBUYENTES (SRI)
// ================================================================

/**
 * Busca un contribuyente por RUC (exacto o parcial)
 */
function buscarContribuyentePorRUC(ruc) {
    if (!ruc || !contribuyentesCargados || !contribuyentesIndex) {
        console.log('[clientes.js] No se puede buscar: ruc=', ruc, 'cargados=', contribuyentesCargados);
        return null;
    }
    
    const rucLimpio = ruc.replace(/[^0-9]/g, '');
    console.log('[clientes.js] Buscando contribuyente por RUC:', rucLimpio);
    
    // 1. Búsqueda exacta
    if (contribuyentesIndex.porRUC[rucLimpio]) {
        const resultado = contribuyentesIndex.porRUC[rucLimpio];
        if (!Array.isArray(resultado)) {
            console.log('[clientes.js] Encontrado exacto:', resultado.RAZON_SOCIAL);
            return resultado;
        }
    }
    
    // 2. Búsqueda por últimos 4 dígitos (para RUC parcial)
    if (rucLimpio.length >= 4) {
        const ultimos = rucLimpio.slice(-4);
        if (contribuyentesIndex.porRUC[ultimos]) {
            const resultados = Array.isArray(contribuyentesIndex.porRUC[ultimos]) ? 
                contribuyentesIndex.porRUC[ultimos] : [contribuyentesIndex.porRUC[ultimos]];
            if (resultados.length > 0) {
                console.log(`[clientes.js] Encontrados ${resultados.length} por últimos 4 dígitos`);
                return resultados[0]; // Retorna el primero como coincidencia parcial
            }
        }
    }
    
    console.log('[clientes.js] No se encontró contribuyente con RUC:', rucLimpio);
    return null;
}

/**
 * Busca contribuyentes por nombre o razón social
 */
function buscarContribuyentesPorNombre(nombre, limite = 10) {
    if (!nombre || !contribuyentesCargados || !contribuyentesIndex) return [];
    
    const busqueda = normalizarTexto(nombre);
    if (!busqueda) return [];
    
    console.log('[clientes.js] Buscando contribuyentes por nombre:', busqueda);
    const resultadosSet = new Set();
    const palabras = busqueda.split(/\s+/);
    
    // Buscar por cada palabra en el índice de nombre
    for (const p of palabras) {
        if (p.length > 2 && contribuyentesIndex.porNombre[p]) {
            for (const c of contribuyentesIndex.porNombre[p]) {
                resultadosSet.add(c);
            }
        }
        // También en nombre comercial
        if (p.length > 2 && contribuyentesIndex.porNombreComercial[p]) {
            for (const c of contribuyentesIndex.porNombreComercial[p]) {
                resultadosSet.add(c);
            }
        }
    }
    
    // Si no hay resultados con búsqueda por palabras, intentar búsqueda parcial en strings completos
    if (resultadosSet.size === 0) {
        const busquedaLower = busqueda.toLowerCase();
        // Recorrer todos los contribuyentes (limitado para no bloquear)
        const maxSearch = Math.min(contribuyentesData.length, 5000);
        for (let i = 0; i < maxSearch; i++) {
            const c = contribuyentesData[i];
            if (!c) continue;
            const nombreC = (c.RAZON_SOCIAL || '').toLowerCase();
            const nombreComC = (c.NOMBRE_FANTASIA_COMERCIAL || '').toLowerCase();
            if (nombreC.includes(busquedaLower) || nombreComC.includes(busquedaLower)) {
                resultadosSet.add(c);
                if (resultadosSet.size >= limite) break;
            }
        }
    }
    
    const resultados = Array.from(resultadosSet).slice(0, limite);
    console.log(`[clientes.js] Resultados encontrados: ${resultados.length}`);
    return resultados;
}

// ================================================================
// 7. INICIALIZAR MÓDULO
// ================================================================

function cargarClientes(callback = null) {
    console.log('[clientes.js] Inicializando módulo de clientes...');

    // Cargar contribuyentes en segundo plano
    cargarContribuyentes();

    // Si ya existe listener, no recrear
    if (clientesListener) {
        if (callback) callback();
        return;
    }

    clientesListener = db.ref('clientes').on('value', snapshot => {
        clientesCache = snapshot.val() || {};
        const lista = Object.values(clientesCache);
        clientesIndex.indexarTodos(lista);
        console.log(`[clientes.js] Clientes cargados: ${Object.keys(clientesCache).length}`);
        if (callback) callback();
        if (document.getElementById('clientesContent')) {
            renderizarClientes();
        }
    }, error => {
        console.error('[clientes.js] Error en listener de clientes:', error);
        mostrarToast('Error al cargar clientes: ' + error.message, 'error');
    });

    if (!callback) {
        setTimeout(() => {
            if (document.getElementById('clientesContent')) {
                renderizarClientes();
            }
        }, 500);
    }
}

// ================================================================
// 8. RENDERIZAR CLIENTES (Con paginación, filtros y ordenamiento)
// ================================================================

function renderizarClientes() {
    const container = document.getElementById('clientesContent');
    if (!container) return;

    const isAdmin = esAdmin();
    const clientesLista = Object.values(clientesCache);
    
    // Aplicar filtros
    let filtrados = clientesLista;
    
    // Filtro por búsqueda
    if (filtroActual.busqueda) {
        const resultados = clientesIndex.buscar(filtroActual.busqueda);
        const ids = new Set(resultados.map(c => c.id));
        filtrados = filtrados.filter(c => ids.has(c.id));
    }
    
    // Filtro por tipo
    if (filtroActual.tipo) {
        filtrados = filtrados.filter(c => c.tipo === filtroActual.tipo);
    }
    
    // Filtro por estado (activo/inactivo)
    if (filtroActual.estado) {
        filtrados = filtrados.filter(c => c.status === filtroActual.estado);
    }
    
    // Filtro por ciudad
    if (filtroActual.ciudad) {
        filtrados = filtrados.filter(c => (c.ciudad || '').toLowerCase().includes(filtroActual.ciudad.toLowerCase()));
    }
    
    // Ordenar
    const campo = filtroActual.campoOrden || 'nombre';
    const asc = filtroActual.ordenAsc !== false;
    filtrados.sort((a, b) => {
        let va = a[campo] || '';
        let vb = b[campo] || '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
    });
    
    // Paginación
    const pageSize = CLIENTES_CONFIG.PAGE_SIZE;
    const totalPages = Math.ceil(filtrados.length / pageSize) || 1;
    const page = Math.min(filtroActual.pagina || 1, totalPages);
    const start = (page - 1) * pageSize;
    const paginados = filtrados.slice(start, start + pageSize);
    
    // Estadísticas
    const total = clientesLista.length;
    const personas = clientesLista.filter(c => c.tipo === 'persona').length;
    const empresas = clientesLista.filter(c => c.tipo === 'empresa').length;
    const ganaderos = clientesLista.filter(c => c.tipo === 'ganadero').length;
    const intermediarios = clientesLista.filter(c => c.tipo === 'intermediario').length;

    // HTML de estadísticas
    let html = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px;">
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-primary);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-primary);">${total}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Total Clientes</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid ${COLORES_TIPO.persona};">
                <div style="font-size:1.8rem;font-weight:700;color:${COLORES_TIPO.persona};">${personas}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">${ICONOS_TIPO.persona} Personas</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid ${COLORES_TIPO.empresa};">
                <div style="font-size:1.8rem;font-weight:700;color:${COLORES_TIPO.empresa};">${empresas}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">${ICONOS_TIPO.empresa} Empresas</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid ${COLORES_TIPO.ganadero};">
                <div style="font-size:1.8rem;font-weight:700;color:${COLORES_TIPO.ganadero};">${ganaderos}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">${ICONOS_TIPO.ganadero} Ganaderos</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid ${COLORES_TIPO.intermediario};">
                <div style="font-size:1.8rem;font-weight:700;color:${COLORES_TIPO.intermediario};">${intermediarios}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">${ICONOS_TIPO.intermediario} Intermediarios</div>
            </div>
        </div>
    `;

    // Barra de herramientas
    html += `
        <div class="card">
            <div class="card-header" style="flex-wrap:wrap;gap:8px;">
                <span class="card-title"><i class="fas fa-users"></i> Lista de Clientes (${filtrados.length})</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <div style="position:relative;display:flex;align-items:center;gap:4px;">
                        <input type="text" id="buscarCliente" placeholder="🔍 Buscar..." 
                               style="padding:6px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);min-width:200px;font-size:0.9rem;">
                        <span id="buscarClienteClear" style="cursor:pointer;display:none;padding:4px;color:var(--text-light);" onclick="limpiarBusquedaCliente()">✕</span>
                    </div>
                    <select id="filtroTipoCliente" style="padding:6px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem;">
                        <option value="">Todos los tipos</option>
                        ${Object.entries(TIPOS_CLIENTE).map(([key, val]) => 
                            `<option value="${val}">${ICONOS_TIPO[val]} ${capitalize(val)}</option>`
                        ).join('')}
                    </select>
                    <select id="filtroEstadoCliente" style="padding:6px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem;">
                        <option value="">Todos los estados</option>
                        <option value="activo">✅ Activo</option>
                        <option value="inactivo">❌ Inactivo</option>
                    </select>
                    ${isAdmin ? `
                        <button class="btn btn-success" onclick="abrirFormularioCliente()">
                            <i class="fas fa-user-plus"></i> Nuevo Cliente
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="exportarClientesExcel()">
                            <i class="fas fa-file-excel"></i> Excel
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th class="sortable" data-campo="numero" onclick="ordenarClientes('numero')">ID <i class="fas fa-sort"></i></th>
                            <th class="sortable" data-campo="tipo" onclick="ordenarClientes('tipo')">Tipo <i class="fas fa-sort"></i></th>
                            <th class="sortable" data-campo="nombre" onclick="ordenarClientes('nombre')">Nombre / Razón Social <i class="fas fa-sort"></i></th>
                            <th class="sortable" data-campo="ruc" onclick="ordenarClientes('ruc')">RUC/Cédula <i class="fas fa-sort"></i></th>
                            <th>Teléfono</th>
                            <th>Email</th>
                            <th>Ciudad</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="clientesTableBody">
    `;

    if (paginados.length === 0) {
        html += `
            <tr>
                <td colspan="8" style="text-align:center;padding:40px;color:var(--text-light);">
                    <i class="fas fa-users" style="font-size:2rem;display:block;margin-bottom:10px;"></i>
                    ${filtroActual.busqueda ? 'No se encontraron clientes con la búsqueda.' : 'No hay clientes registrados.'}
                </td>
            </tr>
        `;
    } else {
        for (const c of paginados) {
            const estadoBadge = c.status === 'activo' ? 'badge-success' : 'badge-danger';
            const estadoTexto = c.status === 'activo' ? 'Activo' : 'Inactivo';
            html += `
                <tr>
                    <td><strong style="color:var(--color-primary);">${c.numero || c.id?.slice(0,8) || 'N/A'}</strong></td>
                    <td>
                        <span style="font-size:0.9rem;">
                            ${ICONOS_TIPO[c.tipo] || '📋'} ${capitalize(c.tipo || 'persona')}
                        </span>
                    </td>
                    <td>
                        <strong>${escapeHTML(c.nombre || 'Sin nombre')}</strong>
                        ${c.nombreComercial ? `<br><span style="font-size:0.7rem;color:var(--text-secondary);">${escapeHTML(c.nombreComercial)}</span>` : ''}
                    </td>
                    <td>${c.ruc || c.cedula || 'N/A'}</td>
                    <td>${c.telefono || 'N/A'}</td>
                    <td>${c.email || 'N/A'}</td>
                    <td>${c.ciudad || c.canton || 'N/A'}</td>
                    <td class="actions" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;">
                        <button class="btn btn-sm btn-primary" onclick="verDetalleCliente('${c.id}')" title="Ver detalle">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${isAdmin ? `
                            <button class="btn btn-sm btn-secondary" onclick="abrirFormularioCliente('${c.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="eliminarCliente('${c.id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }
    }

    html += `
                    </tbody>
                </table>
            </div>
            ${filtrados.length > pageSize ? `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border-color);font-size:0.9rem;flex-wrap:wrap;gap:8px;">
                    <span>Mostrando ${start + 1} - ${Math.min(start + pageSize, filtrados.length)} de ${filtrados.length}</span>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-sm ${page <= 1 ? 'btn-disabled' : 'btn-secondary'}" onclick="cambiarPaginaClientes('prev')" ${page <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span style="padding:4px 12px;background:var(--bg-primary);border-radius:var(--radius-sm);">${page} / ${totalPages}</span>
                        <button class="btn btn-sm ${page >= totalPages ? 'btn-disabled' : 'btn-secondary'}" onclick="cambiarPaginaClientes('next')" ${page >= totalPages ? 'disabled' : ''}>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    container.innerHTML = html;

    // Configurar eventos de filtros
    const searchInput = document.getElementById('buscarCliente');
    const clearBtn = document.getElementById('buscarClienteClear');
    if (searchInput) {
        searchInput.value = filtroActual.busqueda || '';
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                filtroActual.busqueda = e.target.value.trim();
                filtroActual.pagina = 1;
                renderizarClientes();
            }, CLIENTES_CONFIG.DEBOUNCE_DELAY);
        });
    }
    
    const tipoSelect = document.getElementById('filtroTipoCliente');
    if (tipoSelect) {
        tipoSelect.value = filtroActual.tipo || '';
        tipoSelect.addEventListener('change', (e) => {
            filtroActual.tipo = e.target.value;
            filtroActual.pagina = 1;
            renderizarClientes();
        });
    }
    
    const estadoSelect = document.getElementById('filtroEstadoCliente');
    if (estadoSelect) {
        estadoSelect.value = filtroActual.estado || '';
        estadoSelect.addEventListener('change', (e) => {
            filtroActual.estado = e.target.value;
            filtroActual.pagina = 1;
            renderizarClientes();
        });
    }
}

function ordenarClientes(campo) {
    if (filtroActual.campoOrden === campo) {
        filtroActual.ordenAsc = !filtroActual.ordenAsc;
    } else {
        filtroActual.campoOrden = campo;
        filtroActual.ordenAsc = true;
    }
    renderizarClientes();
}

function cambiarPaginaClientes(direccion) {
    if (direccion === 'prev' && filtroActual.pagina > 1) {
        filtroActual.pagina--;
    } else if (direccion === 'next') {
        filtroActual.pagina++;
    }
    renderizarClientes();
}

function limpiarBusquedaCliente() {
    const input = document.getElementById('buscarCliente');
    if (input) {
        input.value = '';
        filtroActual.busqueda = '';
        filtroActual.pagina = 1;
        renderizarClientes();
    }
}

// ================================================================
// 9. BUSCADOR DE CONTRIBUYENTES (Modal Avanzado)
// ================================================================

function mostrarBuscadorRUC() {
    const html = `
        <div style="padding:10px;">
            <div style="margin-bottom:16px;background:var(--bg-primary);padding:12px;border-radius:var(--radius-sm);border-left:4px solid var(--color-warning);">
                <p style="font-size:0.9rem;margin:0;">
                    <i class="fas fa-info-circle"></i> 
                    <strong>Datos para facturación según SRI Ecuador</strong>
                </p>
                <p style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0 0 0;">
                    La búsqueda se realiza en la base de datos de contribuyentes del SRI.
                    Para personas naturales ingresa los 10 dígitos, para sociedades los 13 dígitos.
                </p>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group">
                    <label>Buscar por RUC / Cédula</label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="buscarRUCInput" placeholder="Ej: 1712886751 o 1712886751001" 
                            style="flex:1;padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-size:1rem;">
                        <button class="btn btn-primary" onclick="buscarContribuyentePorRUCUI()">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                    <small style="color:var(--text-light);">10 dígitos (persona natural) o 13 dígitos (sociedad)</small>
                </div>
                <div class="form-group">
                    <label>Buscar por nombre</label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="buscarNombreInput" placeholder="Nombre o razón social" 
                            style="flex:1;padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-size:1rem;">
                        <button class="btn btn-primary" onclick="buscarContribuyentePorNombreUI()">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                    <small style="color:var(--text-light);">Busca por razón social o nombre comercial</small>
                </div>
            </div>
            
            <div id="resultadosBusquedaRUC" style="max-height:350px;overflow-y:auto;margin-top:12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:12px;background:var(--bg-secondary);">
                <p style="color:var(--text-light);text-align:center;padding:20px;margin:0;">
                    <i class="fas fa-info-circle"></i> Ingresa un RUC o nombre para buscar en la base del SRI
                </p>
            </div>
            
            <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border-color);padding-top:12px;">
                <button class="btn btn-secondary" onclick="cerrarModal()">Cerrar</button>
            </div>
        </div>
    `;

    mostrarModal('🔍 Buscar Contribuyente - SRI Ecuador', html, {
        confirmText: 'Cerrar',
        showConfirm: true,
        showCancel: false
    });

    if (!contribuyentesCargados) {
        mostrarToast('📥 Cargando base de datos del SRI...', 'info');
        cargarContribuyentes().then(() => {
            if (contribuyentesCargados) {
                mostrarToast('✅ Base de datos del SRI cargada (' + contribuyentesData.length + ' registros)', 'success');
            } else {
                mostrarToast('⚠️ No se pudo cargar la base de datos del SRI', 'warning');
            }
        });
    }

    setTimeout(() => {
        const inputRUC = document.getElementById('buscarRUCInput');
        const inputNombre = document.getElementById('buscarNombreInput');
        if (inputRUC) {
            inputRUC.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') buscarContribuyentePorRUCUI();
            });
            inputRUC.focus();
        }
        if (inputNombre) {
            inputNombre.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') buscarContribuyentePorNombreUI();
            });
        }
    }, 100);
}

function buscarContribuyentePorRUCUI() {
    const input = document.getElementById('buscarRUCInput');
    const ruc = input?.value?.trim();
    if (!ruc) {
        mostrarToast('⚠️ Ingresa un RUC para buscar', 'warning');
        return;
    }

    const container = document.getElementById('resultadosBusquedaRUC');
    if (!container) return;

    container.innerHTML = `<p style="text-align:center;padding:20px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Buscando...</p>`;

    if (!contribuyentesCargados) {
        cargarContribuyentes().then(() => {
            realizarBusquedaRUC(ruc, container);
        });
        return;
    }

    realizarBusquedaRUC(ruc, container);
}

function realizarBusquedaRUC(ruc, container) {
    const resultado = buscarContribuyentePorRUC(ruc);
    
    if (!resultado) {
        container.innerHTML = `
            <div style="text-align:center;padding:20px;color:var(--text-light);">
                <i class="fas fa-exclamation-circle" style="font-size:2rem;display:block;margin-bottom:10px;color:var(--color-warning);"></i>
                <p><strong>No se encontró ningún contribuyente</strong></p>
                <p style="font-size:0.9rem;">RUC: ${ruc}</p>
                <p style="font-size:0.8rem;color:var(--text-secondary);">Verifica que el RUC sea correcto (10 o 13 dígitos)</p>
                <br>
                <button class="btn btn-success" onclick="usarResultadoRUC(null, '${ruc}')">
                    <i class="fas fa-user-plus"></i> Registrar como nuevo cliente manualmente
                </button>
            </div>
        `;
        return;
    }

    const datosFacturacion = {
        ruc: resultado.NUMERO_RUC || '',
        razonSocial: resultado.RAZON_SOCIAL || '',
        nombreComercial: resultado.NOMBRE_FANTASIA_COMERCIAL || '',
        estadoContribuyente: resultado.ESTADO_CONTRIBUYENTE || '',
        tipoContribuyente: resultado.TIPO_CONTRIBUYENTE || '',
        obligadoContabilidad: resultado.OBLIGADO || 'N',
        agenteRetencion: resultado.AGENTE_RETENCION || 'N',
        especial: resultado.ESPECIAL || 'N',
        provincia: resultado.DESCRIPCION_PROVINCIA_EST || '',
        canton: resultado.DESCRIPCION_CANTON_EST || '',
        parroquia: resultado.DESCRIPCION_PARROQUIA_EST || '',
        actividadEconomica: resultado.ACTIVIDAD_ECONOMICA || '',
        codigoCIIU: resultado.CODIGO_CIIU || '',
        fechaInicioActividades: resultado.FECHA_INICIO_ACTIVIDADES || '',
        fechaActualizacion: resultado.FECHA_ACTUALIZACION || ''
    };

    container.innerHTML = `
        <div style="background:#d1fae5;border-radius:8px;padding:16px;border:2px solid var(--color-success);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                <div>
                    <h4 style="margin:0;color:var(--color-success);">
                        <i class="fas fa-check-circle"></i> Contribuyente encontrado
                    </h4>
                    <span class="badge ${ESTADO_BADGE[resultado.ESTADO_CONTRIBUYENTE] || 'badge-secondary'}" style="font-size:0.7rem;">
                        ${resultado.ESTADO_CONTRIBUYENTE || 'N/A'}
                    </span>
                </div>
                <button class="btn btn-success" onclick="usarResultadoRUC('${resultado.NUMERO_RUC}')">
                    <i class="fas fa-check"></i> Usar para facturación
                </button>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.9rem;background:white;padding:12px;border-radius:var(--radius-sm);">
                <div style="grid-column:span 2;"><strong>Razón Social:</strong> ${escapeHTML(resultado.RAZON_SOCIAL)}</div>
                ${resultado.NOMBRE_FANTASIA_COMERCIAL ? `<div style="grid-column:span 2;"><strong>Nombre Comercial:</strong> ${escapeHTML(resultado.NOMBRE_FANTASIA_COMERCIAL)}</div>` : ''}
                <div><strong>RUC:</strong> ${resultado.NUMERO_RUC}</div>
                <div><strong>Tipo:</strong> ${resultado.TIPO_CONTRIBUYENTE || 'N/A'}</div>
                <div><strong>Obligado Contabilidad:</strong> ${resultado.OBLIGADO === 'S' ? '✅ Sí' : '❌ No'}</div>
                <div><strong>Agente Retención:</strong> ${resultado.AGENTE_RETENCION === 'S' ? '✅ Sí' : '❌ No'}</div>
                <div style="grid-column:span 2;"><strong>Actividad Económica:</strong> ${escapeHTML(resultado.ACTIVIDAD_ECONOMICA || 'N/A')}</div>
                <div><strong>Código CIIU:</strong> ${resultado.CODIGO_CIIU || 'N/A'}</div>
                <div><strong>Provincia:</strong> ${resultado.DESCRIPCION_PROVINCIA_EST || 'N/A'}</div>
                <div><strong>Cantón:</strong> ${resultado.DESCRIPCION_CANTON_EST || 'N/A'}</div>
                <div><strong>Parroquia:</strong> ${resultado.DESCRIPCION_PARROQUIA_EST || 'N/A'}</div>
                <div><strong>Fecha Inicio:</strong> ${resultado.FECHA_INICIO_ACTIVIDADES || 'N/A'}</div>
                <div><strong>Última Actualización:</strong> ${resultado.FECHA_ACTUALIZACION || 'N/A'}</div>
            </div>
        </div>
    `;
}

function buscarContribuyentePorNombreUI() {
    const input = document.getElementById('buscarNombreInput');
    const nombre = input?.value?.trim();
    if (!nombre) {
        mostrarToast('⚠️ Ingresa un nombre para buscar', 'warning');
        return;
    }

    const container = document.getElementById('resultadosBusquedaRUC');
    if (!container) return;

    container.innerHTML = `<p style="text-align:center;padding:20px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Buscando...</p>`;

    if (!contribuyentesCargados) {
        cargarContribuyentes().then(() => {
            realizarBusquedaNombre(nombre, container);
        });
        return;
    }

    realizarBusquedaNombre(nombre, container);
}

function realizarBusquedaNombre(nombre, container) {
    const resultados = buscarContribuyentesPorNombre(nombre, CLIENTES_CONFIG.MAX_RESULTS);
    
    if (resultados.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:20px;color:var(--text-light);">
                <i class="fas fa-exclamation-circle" style="font-size:2rem;display:block;margin-bottom:10px;color:var(--color-warning);"></i>
                <p><strong>No se encontraron contribuyentes</strong></p>
                <p style="font-size:0.9rem;">Búsqueda: "${escapeHTML(nombre)}"</p>
                <br>
                <button class="btn btn-success" onclick="usarResultadoRUC(null, '')">
                    <i class="fas fa-user-plus"></i> Registrar como nuevo cliente
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom:12px;">
            <p><strong>${resultados.length}</strong> resultados encontrados para "${escapeHTML(nombre)}"</p>
        </div>
        ${resultados.map((r, index) => `
            <div style="background:var(--bg-primary);border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid var(--border-color);cursor:pointer;transition:all 0.2s;"
                onclick="usarResultadoRUC('${r.NUMERO_RUC}')"
                onmouseover="this.style.borderColor='var(--color-primary)';this.style.boxShadow='var(--shadow-sm)';"
                onmouseout="this.style.borderColor='var(--border-color)';this.style.boxShadow='none';">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
                    <div style="flex:1;">
                        <strong>${escapeHTML(r.RAZON_SOCIAL)}</strong>
                        ${r.NOMBRE_FANTASIA_COMERCIAL ? `<br><span style="font-size:0.8rem;color:var(--text-secondary);">${escapeHTML(r.NOMBRE_FANTASIA_COMERCIAL)}</span>` : ''}
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">
                            ${escapeHTML(r.ACTIVIDAD_ECONOMICA || 'Sin actividad')}
                        </div>
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                        <span style="font-size:0.9rem;font-weight:bold;color:var(--color-primary);">${r.NUMERO_RUC}</span>
                        <br>
                        <span class="badge ${ESTADO_BADGE[r.ESTADO_CONTRIBUYENTE] || 'badge-secondary'}" style="font-size:0.6rem;">
                            ${r.ESTADO_CONTRIBUYENTE || 'N/A'}
                        </span>
                        <br>
                        <span style="font-size:0.6rem;color:var(--text-light);">${r.TIPO_CONTRIBUYENTE || ''}</span>
                    </div>
                </div>
            </div>
        `).join('')}
    `;
}

function usarResultadoRUC(ruc, rucManual = '') {
    let contribuyente = null;
    let rucUsar = ruc || rucManual;
    
    if (ruc) {
        contribuyente = buscarContribuyentePorRUC(ruc);
    }
    
    cerrarModal();
    
    setTimeout(() => {
        abrirFormularioClienteConDatos(contribuyente, rucUsar);
    }, 300);
}

// ================================================================
// 10. FORMULARIO CON DATOS PRECARGADOS
// ================================================================

async function abrirFormularioClienteConDatos(contribuyente, rucManual = '') {
    if (!esAdmin()) {
        mostrarToast('⛔ Solo administradores pueden gestionar clientes', 'error');
        return;
    }

    const datosPrecargados = {};
    
    if (contribuyente) {
        datosPrecargados.ruc = contribuyente.NUMERO_RUC || '';
        datosPrecargados.cedula = contribuyente.NUMERO_RUC || '';
        datosPrecargados.nombre = contribuyente.RAZON_SOCIAL || '';
        datosPrecargados.nombreComercial = contribuyente.NOMBRE_FANTASIA_COMERCIAL || '';
        datosPrecargados.razonSocial = contribuyente.RAZON_SOCIAL || '';
        datosPrecargados.estadoContribuyente = contribuyente.ESTADO_CONTRIBUYENTE || '';
        datosPrecargados.tipoContribuyente = contribuyente.TIPO_CONTRIBUYENTE || '';
        datosPrecargados.obligadoContabilidad = contribuyente.OBLIGADO || 'N';
        datosPrecargados.agenteRetencion = contribuyente.AGENTE_RETENCION || 'N';
        datosPrecargados.especial = contribuyente.ESPECIAL || 'N';
        datosPrecargados.provincia = contribuyente.DESCRIPCION_PROVINCIA_EST || '';
        datosPrecargados.canton = contribuyente.DESCRIPCION_CANTON_EST || '';
        datosPrecargados.parroquia = contribuyente.DESCRIPCION_PARROQUIA_EST || '';
        datosPrecargados.actividadEconomica = contribuyente.ACTIVIDAD_ECONOMICA || '';
        datosPrecargados.codigoCIIU = contribuyente.CODIGO_CIIU || '';
        datosPrecargados.fechaInicioActividades = contribuyente.FECHA_INICIO_ACTIVIDADES || '';
        datosPrecargados.fechaActualizacion = contribuyente.FECHA_ACTUALIZACION || '';
        
        if (contribuyente.TIPO_CONTRIBUYENTE?.toLowerCase().includes('sociedad')) {
            datosPrecargados.tipo = 'empresa';
        } else {
            datosPrecargados.tipo = 'persona';
        }
        
        mostrarToast('✅ Datos del contribuyente precargados para facturación', 'success');
    } else if (rucManual) {
        datosPrecargados.ruc = rucManual;
        datosPrecargados.cedula = rucManual;
        mostrarToast('ℹ️ RUC ingresado manualmente', 'info');
    }

    await abrirFormularioCliente(null, datosPrecargados);
}

// ================================================================
// 11. CREAR/EDITAR CLIENTE (Formulario Mejorado)
// ================================================================

async function abrirFormularioCliente(clienteId = null, datosPrecargados = null) {
    console.log('[clientes.js] abrirFormularioCliente() llamado:', clienteId);

    if (!esAdmin()) {
        mostrarToast('⛔ Solo administradores pueden gestionar clientes', 'error');
        return;
    }

    let cliente = null;
    if (clienteId) {
        cliente = clientesCache[clienteId];
        if (!cliente) {
            mostrarToast('❌ Cliente no encontrado', 'error');
            return;
        }
        clienteEnEdicion = { id: clienteId, ...cliente };
        modoEdicionCliente = true;
    } else {
        clienteEnEdicion = null;
        modoEdicionCliente = false;
    }

    const getVal = (campo, defaultValue = '') => {
        if (datosPrecargados && datosPrecargados[campo] !== undefined && datosPrecargados[campo] !== null) {
            return datosPrecargados[campo];
        }
        if (cliente && cliente[campo] !== undefined && cliente[campo] !== null) {
            return cliente[campo];
        }
        return defaultValue;
    };

    const titulo = modoEdicionCliente ? '✏️ Editar Cliente' : '👤 Nuevo Cliente';
    const isEdit = modoEdicionCliente;

    const html = `
        <form id="formCliente" novalidate>
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;background:var(--bg-primary);padding:12px;border-radius:var(--radius-sm);border-left:4px solid var(--color-primary);">
                <button type="button" class="btn btn-primary btn-sm" onclick="mostrarBuscadorRUC()">
                    <i class="fas fa-search"></i> Buscar por RUC (SRI)
                </button>
                ${!isEdit ? `<span style="font-size:0.8rem;color:var(--text-secondary);align-self:center;">Busca en la base de datos del SRI Ecuador para facturación</span>` : ''}
                ${datosPrecargados?.ruc ? `<span class="badge badge-success" style="font-size:0.8rem;">✅ RUC: ${datosPrecargados.ruc}</span>` : ''}
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group">
                    <label>Tipo de Cliente <span style="color:var(--color-danger);">*</span></label>
                    <select id="cTipo" class="form-control" required>
                        <option value="">Seleccionar</option>
                        ${Object.entries(TIPOS_CLIENTE).map(([key, value]) => `
                            <option value="${value}" ${getVal('tipo') === value ? 'selected' : ''}>
                                ${ICONOS_TIPO[value] || '📋'} ${capitalize(value)}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>RUC / Cédula <span style="color:var(--color-danger);">*</span></label>
                    <input type="text" id="cRUC" value="${getVal('ruc', getVal('cedula', ''))}" class="form-control" required placeholder="10 o 13 dígitos">
                    <small style="color:var(--text-light);">${getVal('estadoContribuyente') ? `Estado SRI: ${getVal('estadoContribuyente')}` : 'Ingresa el RUC para facturación'}</small>
                </div>
                <div class="form-group" style="grid-column:span 2;">
                    <label>Razón Social / Nombre Completo <span style="color:var(--color-danger);">*</span></label>
                    <input type="text" id="cNombre" value="${getVal('nombre', '')}" class="form-control" required placeholder="Razón social o nombre completo">
                    <small style="color:var(--text-light);">Para personas naturales: Nombres y apellidos completos</small>
                </div>
                <div class="form-group" style="grid-column:span 2;">
                    <label>Nombre Comercial</label>
                    <input type="text" id="cNombreComercial" value="${getVal('nombreComercial', '')}" class="form-control" placeholder="Nombre comercial o fantasía">
                </div>
                <div class="form-group">
                    <label>Teléfono <span style="color:var(--color-danger);">*</span></label>
                    <input type="tel" id="cTelefono" value="${getVal('telefono', '')}" class="form-control" required placeholder="Número de contacto">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="cEmail" value="${getVal('email', '')}" class="form-control" placeholder="correo@ejemplo.com">
                </div>
                <div class="form-group">
                    <label>Provincia</label>
                    <input type="text" id="cProvincia" value="${getVal('provincia', '')}" class="form-control" placeholder="Provincia">
                </div>
                <div class="form-group">
                    <label>Cantón</label>
                    <input type="text" id="cCanton" value="${getVal('canton', '')}" class="form-control" placeholder="Cantón">
                </div>
                <div class="form-group" style="grid-column:span 2;">
                    <label>Dirección</label>
                    <input type="text" id="cDireccion" value="${getVal('direccion', '')}" class="form-control" placeholder="Dirección completa">
                </div>
                <div class="form-group" style="grid-column:span 2;">
                    <label>Actividad Económica</label>
                    <input type="text" id="cActividad" value="${getVal('actividadEconomica', getVal('actividad', ''))}" class="form-control" placeholder="Actividad económica principal">
                    <small style="color:var(--text-light);">${getVal('codigoCIIU') ? `Código CIIU: ${getVal('codigoCIIU')}` : 'Información del SRI si está disponible'}</small>
                </div>
                <div class="form-group">
                    <label>Obligado a Llevar Contabilidad</label>
                    <select id="cObligadoContabilidad" class="form-control">
                        <option value="N" ${getVal('obligadoContabilidad') === 'S' ? '' : 'selected'}>No</option>
                        <option value="S" ${getVal('obligadoContabilidad') === 'S' ? 'selected' : ''}>Sí</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Agente de Retención</label>
                    <select id="cAgenteRetencion" class="form-control">
                        <option value="N" ${getVal('agenteRetencion') === 'S' ? '' : 'selected'}>No</option>
                        <option value="S" ${getVal('agenteRetencion') === 'S' ? 'selected' : ''}>Sí</option>
                    </select>
                </div>
                <div class="form-group" style="grid-column:span 2;">
                    <label>Observaciones</label>
                    <textarea id="cObservaciones" rows="2" class="form-control">${getVal('observaciones', '')}</textarea>
                </div>
            </div>
            <div id="formMessageCliente" style="margin-top:12px;display:none;"></div>
            ${isEdit ? `<input type="hidden" id="clienteIdEdit" value="${clienteId}">` : ''}
        </form>
    `;

    await mostrarModal(titulo, html, {
        confirmText: isEdit ? '💾 Actualizar Cliente' : '💾 Registrar Cliente',
        cancelText: '❌ Cancelar',
        showConfirm: true,
        showCancel: true,
        onConfirm: async function() {
            if (isEdit) {
                await actualizarClienteDesdeFormulario();
            } else {
                await guardarClienteDesdeFormulario();
            }
        }
    });
}

// ================================================================
// 12. GUARDAR CLIENTE (con validaciones avanzadas)
// ================================================================

async function guardarClienteDesdeFormulario() {
    console.log('[clientes.js] guardarClienteDesdeFormulario() iniciado');

    if (!currentUser) {
        mostrarToast('⛔ Debes iniciar sesión para registrar clientes.', 'error');
        return false;
    }

    try {
        const tipo = document.getElementById('cTipo')?.value;
        const ruc = document.getElementById('cRUC')?.value.trim();
        const nombre = document.getElementById('cNombre')?.value.trim();
        const nombreComercial = document.getElementById('cNombreComercial')?.value.trim();
        const telefono = document.getElementById('cTelefono')?.value.trim();
        const email = document.getElementById('cEmail')?.value.trim();
        const provincia = document.getElementById('cProvincia')?.value.trim();
        const canton = document.getElementById('cCanton')?.value.trim();
        const direccion = document.getElementById('cDireccion')?.value.trim();
        const actividad = document.getElementById('cActividad')?.value.trim();
        const obligadoContabilidad = document.getElementById('cObligadoContabilidad')?.value || 'N';
        const agenteRetencion = document.getElementById('cAgenteRetencion')?.value || 'N';
        const observaciones = document.getElementById('cObservaciones')?.value.trim();

        const errors = [];
        if (!tipo) errors.push('Selecciona un tipo de cliente');
        if (!nombre) errors.push('La razón social / nombre es obligatorio');
        if (!telefono) errors.push('El teléfono es obligatorio');

        // Validar RUC
        if (ruc) {
            const rucLimpio = ruc.replace(/[^0-9]/g, '');
            if (rucLimpio.length < 10 || rucLimpio.length > 13) {
                errors.push('El RUC debe tener entre 10 y 13 dígitos');
            }
            if (rucLimpio.length === 13 && !/^[0-9]{13}$/.test(rucLimpio)) {
                errors.push('El RUC de 13 dígitos debe ser numérico');
            }
            // Validar algoritmo de módulo 11
            if (!validarRUC(rucLimpio)) {
                errors.push('El RUC no es válido según el algoritmo de verificación (módulo 11)');
            }
            // Verificar duplicado
            const duplicado = Object.values(clientesCache).find(c => 
                (c.ruc === rucLimpio || c.cedula === rucLimpio)
            );
            if (duplicado) {
                errors.push(`Ya existe un cliente con el RUC "${rucLimpio}" (${duplicado.nombre})`);
            }
        } else {
            errors.push('El RUC es obligatorio para facturación');
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('El email no es válido');
        }

        if (errors.length > 0) {
            const msgDiv = document.getElementById('formMessageCliente');
            if (msgDiv) {
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:12px;border-radius:8px;">
                    <i class="fas fa-exclamation-circle"></i> ${errors.join('. ')}
                </div>`;
            }
            mostrarToast('❌ ' + errors.join('. '), 'error');
            return false;
        }

        const numero = await generarId('CLI');
        const rucLimpio = ruc.replace(/[^0-9]/g, '');

        const clienteRef = db.ref('clientes').push();
        await clienteRef.set({
            id: clienteRef.key,
            numero: numero,
            tipo: tipo,
            nombre: nombre,
            nombreComercial: nombreComercial || '',
            ruc: rucLimpio,
            cedula: rucLimpio,
            telefono: telefono,
            email: email || '',
            provincia: provincia || '',
            canton: canton || '',
            ciudad: canton || '',
            direccion: direccion || '',
            actividadEconomica: actividad || '',
            obligadoContabilidad: obligadoContabilidad,
            agenteRetencion: agenteRetencion,
            observaciones: observaciones || '',
            createdAt: Date.now(),
            createdBy: currentUser?.uid || '',
            createdByEmail: currentUser?.email || '',
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            updatedByEmail: currentUser?.email || '',
            status: 'activo'
        });

        mostrarToast(`✅ Cliente "${nombre}" registrado exitosamente`, 'success');
        console.log('[clientes.js] Cliente creado:', clienteRef.key);
        renderizarClientes();
        return true;

    } catch (error) {
        console.error('[clientes.js] Error al guardar:', error);
        mostrarToast('❌ Error al guardar el cliente: ' + error.message, 'error');
        return false;
    }
}

// ================================================================
// 13. ACTUALIZAR CLIENTE
// ================================================================

async function actualizarClienteDesdeFormulario() {
    console.log('[clientes.js] actualizarClienteDesdeFormulario() iniciado');

    const clienteId = document.getElementById('clienteIdEdit')?.value;
    if (!clienteId) {
        mostrarToast('❌ ID de cliente no encontrado', 'error');
        return false;
    }

    if (!esAdmin()) {
        mostrarToast('⛔ No autorizado.', 'error');
        return false;
    }

    try {
        const tipo = document.getElementById('cTipo')?.value;
        const ruc = document.getElementById('cRUC')?.value.trim();
        const nombre = document.getElementById('cNombre')?.value.trim();
        const nombreComercial = document.getElementById('cNombreComercial')?.value.trim();
        const telefono = document.getElementById('cTelefono')?.value.trim();
        const email = document.getElementById('cEmail')?.value.trim();
        const provincia = document.getElementById('cProvincia')?.value.trim();
        const canton = document.getElementById('cCanton')?.value.trim();
        const direccion = document.getElementById('cDireccion')?.value.trim();
        const actividad = document.getElementById('cActividad')?.value.trim();
        const obligadoContabilidad = document.getElementById('cObligadoContabilidad')?.value || 'N';
        const agenteRetencion = document.getElementById('cAgenteRetencion')?.value || 'N';
        const observaciones = document.getElementById('cObservaciones')?.value.trim();

        const errors = [];
        if (!tipo) errors.push('Selecciona un tipo de cliente');
        if (!nombre) errors.push('La razón social / nombre es obligatorio');
        if (!telefono) errors.push('El teléfono es obligatorio');

        if (ruc) {
            const rucLimpio = ruc.replace(/[^0-9]/g, '');
            if (rucLimpio.length < 10 || rucLimpio.length > 13) {
                errors.push('El RUC debe tener entre 10 y 13 dígitos');
            }
            if (!validarRUC(rucLimpio)) {
                errors.push('El RUC no es válido según el algoritmo de verificación (módulo 11)');
            }
            const duplicado = Object.values(clientesCache).find(c => 
                (c.ruc === rucLimpio || c.cedula === rucLimpio) && c.id !== clienteId
            );
            if (duplicado) {
                errors.push(`Ya existe otro cliente con el RUC "${rucLimpio}" (${duplicado.nombre})`);
            }
        } else {
            errors.push('El RUC es obligatorio para facturación');
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('El email no es válido');
        }

        if (errors.length > 0) {
            const msgDiv = document.getElementById('formMessageCliente');
            if (msgDiv) {
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:12px;border-radius:8px;">
                    <i class="fas fa-exclamation-circle"></i> ${errors.join('. ')}
                </div>`;
            }
            mostrarToast('❌ ' + errors.join('. '), 'error');
            return false;
        }

        const rucLimpio = ruc.replace(/[^0-9]/g, '');

        await db.ref(`clientes/${clienteId}`).update({
            tipo: tipo,
            nombre: nombre,
            nombreComercial: nombreComercial || '',
            ruc: rucLimpio,
            cedula: rucLimpio,
            telefono: telefono,
            email: email || '',
            provincia: provincia || '',
            canton: canton || '',
            ciudad: canton || '',
            direccion: direccion || '',
            actividadEconomica: actividad || '',
            obligadoContabilidad: obligadoContabilidad,
            agenteRetencion: agenteRetencion,
            observaciones: observaciones || '',
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            updatedByEmail: currentUser?.email || ''
        });

        mostrarToast(`✅ Cliente "${nombre}" actualizado exitosamente`, 'success');
        renderizarClientes();
        return true;

    } catch (error) {
        console.error('[clientes.js] Error al actualizar:', error);
        mostrarToast('❌ Error al actualizar el cliente: ' + error.message, 'error');
        return false;
    }
}

// ================================================================
// 14. VER DETALLE DE CLIENTE (con historial de ventas)
// ================================================================

async function verDetalleCliente(clienteId) {
    try {
        const cliente = clientesCache[clienteId];
        if (!cliente) {
            mostrarToast('❌ Cliente no encontrado', 'error');
            return;
        }

        const ventasCliente = Object.values(ventasCache || {})
            .filter(v => v.clienteId === clienteId)
            .sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

        const totalVentas = ventasCliente.length;
        const montoTotal = ventasCliente.reduce((sum, v) => sum + (v.total || 0), 0);
        const montoPagado = ventasCliente.reduce((sum, v) => sum + (v.pagado || 0), 0);

        const isAdmin = esAdmin();

        const html = `
            <div style="padding:10px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div style="background:var(--bg-primary);border-radius:8px;padding:16px;">
                        <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                            ${ICONOS_TIPO[cliente.tipo] || '👤'} ${escapeHTML(cliente.nombre)}
                            <span class="badge" style="background:${COLORES_TIPO[cliente.tipo] || '#3b82f6'};">${capitalize(cliente.tipo)}</span>
                            <span class="badge ${cliente.status === 'activo' ? 'badge-success' : 'badge-danger'}">${cliente.status === 'activo' ? 'Activo' : 'Inactivo'}</span>
                        </h4>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.9rem;">
                            <div><strong>ID:</strong> ${cliente.numero || cliente.id?.slice(0,8) || 'N/A'}</div>
                            <div><strong>RUC:</strong> ${cliente.ruc || cliente.cedula || 'N/A'}</div>
                            ${cliente.nombreComercial ? `<div style="grid-column:span 2;"><strong>Nombre Comercial:</strong> ${escapeHTML(cliente.nombreComercial)}</div>` : ''}
                            <div><strong>Teléfono:</strong> ${cliente.telefono || 'N/A'}</div>
                            <div><strong>Email:</strong> ${cliente.email || 'N/A'}</div>
                            <div style="grid-column:span 2;"><strong>Dirección:</strong> ${escapeHTML(cliente.direccion || 'N/A')}</div>
                            <div><strong>Provincia:</strong> ${cliente.provincia || 'N/A'}</div>
                            <div><strong>Cantón:</strong> ${cliente.canton || 'N/A'}</div>
                            ${cliente.actividadEconomica ? `<div style="grid-column:span 2;"><strong>Actividad:</strong> ${escapeHTML(cliente.actividadEconomica)}</div>` : ''}
                            <div><strong>Obligado Contabilidad:</strong> ${cliente.obligadoContabilidad === 'S' ? '✅ Sí' : '❌ No'}</div>
                            <div><strong>Agente Retención:</strong> ${cliente.agenteRetencion === 'S' ? '✅ Sí' : '❌ No'}</div>
                        </div>
                        ${cliente.observaciones ? `
                            <div style="margin-top:12px;padding:8px;background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:0.85rem;">
                                <strong>Observaciones:</strong> ${escapeHTML(cliente.observaciones)}
                            </div>
                        ` : ''}
                    </div>
                    <div style="background:var(--bg-primary);border-radius:8px;padding:16px;">
                        <h4 style="margin-bottom:12px;"><i class="fas fa-shopping-cart"></i> Historial de Ventas</h4>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.9rem;">
                            <div><strong>Total Ventas:</strong> ${totalVentas}</div>
                            <div><strong>Monto Total:</strong> ${formatearMoneda(montoTotal)}</div>
                            <div><strong>Pagado:</strong> ${formatearMoneda(montoPagado)}</div>
                            <div><strong>Pendiente:</strong> ${formatearMoneda(montoTotal - montoPagado)}</div>
                        </div>
                        ${ventasCliente.length > 0 ? `
                            <div style="max-height:200px;overflow-y:auto;margin-top:12px;">
                                ${ventasCliente.slice(0, 10).map(v => `
                                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:0.8rem;">
                                        <span><strong>#${v.numero}</strong> ${formatearFecha(v.fecha)}</span>
                                        <span>${formatearMoneda(v.total)}</span>
                                        <span class="badge" style="background:${COLORES_ESTADO?.[v.estado] || '#3b82f6'};font-size:0.6rem;">${capitalize(v.estado)}</span>
                                    </div>
                                `).join('')}
                                ${ventasCliente.length > 10 ? `<p style="font-size:0.75rem;color:var(--text-light);text-align:center;margin-top:4px;">+${ventasCliente.length - 10} más...</p>` : ''}
                            </div>
                        ` : `
                            <p style="color:var(--text-light);font-size:0.9rem;text-align:center;padding:12px;">
                                Este cliente no tiene ventas registradas
                            </p>
                        `}
                    </div>
                </div>
                <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                    <button class="btn btn-secondary btn-sm" onclick="cerrarModal()">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                    ${isAdmin ? `
                        <button class="btn btn-secondary btn-sm" onclick="abrirFormularioCliente('${clienteId}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-success btn-sm" onclick="cerrarModal(); setTimeout(() => mostrarVista('ventas'), 300);">
                            <i class="fas fa-shopping-cart"></i> Ver Ventas
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        await mostrarModal(`👤 Detalle de Cliente - ${escapeHTML(cliente.nombre)}`, html, {
            confirmText: 'Cerrar',
            showConfirm: true,
            showCancel: false
        });

    } catch (error) {
        console.error('[clientes.js] Error al ver detalle:', error);
        mostrarToast('❌ Error al cargar detalle: ' + error.message, 'error');
    }
}

// ================================================================
// 15. ELIMINAR CLIENTE (con cascada)
// ================================================================

window.eliminarCliente = async function(clienteId) {
    if (!esAdmin()) {
        mostrarToast('⛔ No autorizado. Solo administradores.', 'error');
        return;
    }

    const cliente = clientesCache[clienteId];
    if (!cliente) {
        mostrarToast('❌ Cliente no encontrado', 'error');
        return;
    }

    const tieneVentas = Object.values(ventasCache || {}).some(v => v.clienteId === clienteId);
    let mensajeAdvertencia = '';
    if (tieneVentas) {
        mensajeAdvertencia = '⚠️ Este cliente tiene ventas asociadas. Eliminarlo eliminará también todas sus ventas.';
    }

    const html = `
        <div style="text-align:center;padding:20px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:12px;"></i>
            <p style="font-size:1.1rem;font-weight:500;">¿Estás seguro de eliminar este cliente?</p>
            <div style="background:var(--bg-primary);border-radius:8px;padding:16px;margin:16px 0;text-align:left;">
                <p><strong>Nombre:</strong> ${escapeHTML(cliente.nombre)}</p>
                <p><strong>RUC:</strong> ${cliente.ruc || cliente.cedula || 'N/A'}</p>
                <p><strong>Teléfono:</strong> ${cliente.telefono || 'N/A'}</p>
                ${tieneVentas ? `<p style="color:var(--color-warning);"><i class="fas fa-exclamation-circle"></i> Tiene ventas asociadas</p>` : ''}
            </div>
            ${tieneVentas ? `<p style="color:var(--color-danger);font-size:0.9rem;">${mensajeAdvertencia}</p>` : ''}
            <p style="color:var(--text-danger);font-size:0.9rem;">⚠️ Esta acción no se puede deshacer.</p>
        </div>
    `;

    const confirmar = await mostrarModal('⚠️ Confirmar eliminación', html, {
        confirmText: '🗑️ Sí, eliminar',
        cancelText: '❌ Cancelar',
        showConfirm: true,
        showCancel: true
    });

    if (!confirmar) return;

    try {
        if (tieneVentas) {
            const ventas = Object.entries(ventasCache || {}).filter(([_, v]) => v.clienteId === clienteId);
            for (const [key, _] of ventas) {
                await db.ref(`ventas/${key}`).remove();
            }
        }

        await db.ref(`clientes/${clienteId}`).remove();
        mostrarToast(`✅ Cliente "${cliente.nombre}" eliminado correctamente`, 'success');
        renderizarClientes();
    } catch (error) {
        console.error('[clientes.js] Error al eliminar:', error);
        mostrarToast('❌ Error al eliminar: ' + error.message, 'error');
    }
};

// ================================================================
// 16. EXPORTAR CLIENTES A EXCEL
// ================================================================

function exportarClientesExcel() {
    const clientesLista = Object.values(clientesCache);
    if (clientesLista.length === 0) {
        mostrarToast('No hay clientes para exportar', 'warning');
        return;
    }

    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>ID</th>
            <th>Tipo</th>
            <th>Razón Social</th>
            <th>Nombre Comercial</th>
            <th>RUC</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Provincia</th>
            <th>Cantón</th>
            <th>Dirección</th>
            <th>Actividad Económica</th>
            <th>Obligado Contabilidad</th>
            <th>Agente Retención</th>
            <th>Observaciones</th>
        </tr>
    `;
    const tbody = document.createElement('tbody');
    clientesLista.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${c.numero || c.id?.slice(0,8) || ''}</td>
                <td>${c.tipo || 'persona'}</td>
                <td>${escapeHTML(c.nombre || '')}</td>
                <td>${escapeHTML(c.nombreComercial || '')}</td>
                <td>${c.ruc || c.cedula || ''}</td>
                <td>${c.telefono || ''}</td>
                <td>${c.email || ''}</td>
                <td>${escapeHTML(c.provincia || '')}</td>
                <td>${escapeHTML(c.canton || '')}</td>
                <td>${escapeHTML(c.direccion || '')}</td>
                <td>${escapeHTML(c.actividadEconomica || '')}</td>
                <td>${c.obligadoContabilidad || 'N'}</td>
                <td>${c.agenteRetencion || 'N'}</td>
                <td>${escapeHTML(c.observaciones || '')}</td>
            </tr>
        `;
    });
    tabla.appendChild(thead);
    tabla.appendChild(tbody);

    const nombreArchivo = `Clientes_${new Date().toISOString().split('T')[0]}`;
    exportarExcel(tabla, nombreArchivo);
}

// ================================================================
// 17. EXPOSICIÓN GLOBAL (API Pública)
// ================================================================

window.cargarClientes = cargarClientes;
window.renderizarClientes = renderizarClientes;
window.abrirFormularioCliente = abrirFormularioCliente;
window.verDetalleCliente = verDetalleCliente;
window.eliminarCliente = window.eliminarCliente;
window.exportarClientesExcel = exportarClientesExcel;
window.obtenerClientePorId = obtenerClientePorId;
window.obtenerNombreCliente = obtenerNombreCliente;
window.mostrarBuscadorRUC = mostrarBuscadorRUC;
window.buscarContribuyentePorRUCUI = buscarContribuyentePorRUCUI;
window.buscarContribuyentePorNombreUI = buscarContribuyentePorNombreUI;
window.usarResultadoRUC = usarResultadoRUC;
window.ordenarClientes = ordenarClientes;
window.cambiarPaginaClientes = cambiarPaginaClientes;
window.limpiarBusquedaCliente = limpiarBusquedaCliente;

console.log(`[clientes.js] Módulo de clientes v${CLIENTES_CONFIG.VERSION} cargado correctamente`);