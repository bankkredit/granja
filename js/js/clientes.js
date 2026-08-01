/**
 * clientes.js - Módulo de Gestión de Clientes (Versión 4.5)
 * Carga automática del CSV desde el servidor
 * Búsqueda en archivo externo sin interacción del usuario
 */

// ================================================================
// 1. CONFIGURACIÓN Y CONSTANTES
// ================================================================

const CLIENTES_CONFIG = {
    VERSION: '4.5.0',
    PAGE_SIZE: 15,
    MAX_RESULTS: 100,
    DEBOUNCE_DELAY: 300,
    SUGGESTIONS_LIMIT: 5,
    CSV_DELIMITER: ';',
    CSV_URL: 'database.csv', // Archivo en la misma ubicación
    BATCH_SIZE: 10000,
    DB_NAME: 'ContribuyentesDB',
    DB_VERSION: 1,
    STORE_NAME: 'contribuyentes'
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

// ================================================================
// 2. VARIABLES DE ESTADO
// ================================================================

let clientesCache = {};
let clientesIndex = null;
let clientesListener = null;
let clienteEnEdicion = null;
let modoEdicionCliente = false;
let contribuyentesData = [];
let contribuyentesCargados = false;
let contribuyentesIndex = null;
let contribuyentesCargando = false;
let dbIndexedDB = null;

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
// 3. FUNCIONES DE UTILIDAD
// ================================================================

function capitalize(texto) {
    if (!texto) return '';
    return texto.toLowerCase().split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function normalizarTexto(texto) {
    if (!texto) return '';
    const sinAcentos = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return sinAcentos.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function validarRUC(ruc) {
    if (!ruc) return false;
    const rucLimpio = ruc.replace(/[^0-9]/g, '');
    return rucLimpio.length === 10 || rucLimpio.length === 13;
}

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

function formatearFecha(timestamp) {
    if (!timestamp) return 'N/A';
    const fecha = new Date(timestamp);
    return fecha.toLocaleDateString('es-EC', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatearMoneda(cantidad, moneda = 'USD') {
    if (cantidad === undefined || cantidad === null) return '$0.00';
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 2
    }).format(cantidad);
}

async function generarId(prefijo) {
    try {
        const snapshot = await db.ref('contadores').child(prefijo).once('value');
        let contador = snapshot.val() || 0;
        contador++;
        await db.ref('contadores').child(prefijo).set(contador);
        return prefijo + contador.toString().padStart(6, '0');
    } catch (error) {
        console.error('Error generando ID:', error);
        return prefijo + Date.now().toString().slice(-6);
    }
}

function esAdmin() {
    return currentUser?.rol === 'admin' || currentUser?.email === 'vinicio@geomira.se';
}

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
// 4. INDEXEDDB - ALMACENAMIENTO LOCAL PARA CSV
// ================================================================

function abrirIndexedDB() {
    return new Promise((resolve, reject) => {
        if (dbIndexedDB) {
            resolve(dbIndexedDB);
            return;
        }
        
        const request = indexedDB.open(CLIENTES_CONFIG.DB_NAME, CLIENTES_CONFIG.DB_VERSION);
        
        request.onerror = (event) => {
            console.error('[clientes.js] Error abriendo IndexedDB:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            dbIndexedDB = event.target.result;
            console.log('[clientes.js] IndexedDB abierta correctamente');
            resolve(dbIndexedDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(CLIENTES_CONFIG.STORE_NAME)) {
                const store = db.createObjectStore(CLIENTES_CONFIG.STORE_NAME, { keyPath: 'id' });
                store.createIndex('ruc', 'NUMERO_RUC', { unique: false });
                store.createIndex('nombre', 'RAZON_SOCIAL', { unique: false });
                console.log('[clientes.js] ObjectStore creada:', CLIENTES_CONFIG.STORE_NAME);
            }
        };
    });
}

async function guardarContribuyentesEnIndexedDB(data) {
    const db = await abrirIndexedDB();
    const transaction = db.transaction([CLIENTES_CONFIG.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CLIENTES_CONFIG.STORE_NAME);
    
    store.clear();
    
    return new Promise((resolve, reject) => {
        let completados = 0;
        const total = data.length;
        const batchSize = CLIENTES_CONFIG.BATCH_SIZE;
        
        transaction.oncomplete = () => {
            console.log(`[clientes.js] Guardados ${total} contribuyentes en IndexedDB`);
            resolve();
        };
        
        transaction.onerror = (event) => {
            console.error('[clientes.js] Error guardando en IndexedDB:', event.target.error);
            reject(event.target.error);
        };
        
        function procesarLote(inicio) {
            const fin = Math.min(inicio + batchSize, total);
            const lote = data.slice(inicio, fin);
            
            lote.forEach(item => {
                store.add(item);
            });
            
            completados += lote.length;
            
            if (fin < total) {
                setTimeout(() => procesarLote(fin), 10);
            }
        }
        
        procesarLote(0);
    });
}

async function contarContribuyentesIndexedDB() {
    const db = await abrirIndexedDB();
    const transaction = db.transaction([CLIENTES_CONFIG.STORE_NAME], 'readonly');
    const store = transaction.objectStore(CLIENTES_CONFIG.STORE_NAME);
    
    return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ================================================================
// 5. CARGA AUTOMÁTICA DEL CSV DESDE EL SERVIDOR
// ================================================================

/**
 * Datos de ejemplo para fallback si no se puede cargar el CSV
 */
function obtenerContribuyentesEjemplo() {
    return [
        { 
            id: '1',
            NUMERO_RUC: '1754237251001', 
            RAZON_SOCIAL: 'LINCANGO ANAGUANO CARLOS MANUEL', 
            CODIGO_JURISDICCION: 'PICHINCHA', 
            TIPO_CONTRIBUYENTE: 'PERSONA NATURAL', 
            DESCRIPCION_PARROQUIA_EST: 'NAYON' 
        },
        { 
            id: '2',
            NUMERO_RUC: '0401921945001', 
            RAZON_SOCIAL: 'MONTENEGRO VILLACIS ALAN DAVID', 
            CODIGO_JURISDICCION: 'PICHINCHA', 
            TIPO_CONTRIBUYENTE: 'PERSONA NATURAL', 
            DESCRIPCION_PARROQUIA_EST: 'SAN BARTOLO' 
        },
        { 
            id: '3',
            NUMERO_RUC: '1793232562001', 
            RAZON_SOCIAL: 'CONSORCIO CANGAHUA CG', 
            CODIGO_JURISDICCION: 'PICHINCHA', 
            TIPO_CONTRIBUYENTE: 'SOCIEDAD', 
            DESCRIPCION_PARROQUIA_EST: 'QUITUMBE' 
        },
        { 
            id: '4',
            NUMERO_RUC: '1712886751', 
            RAZON_SOCIAL: 'JUAN PEREZ GARCIA', 
            CODIGO_JURISDICCION: 'PICHINCHA', 
            TIPO_CONTRIBUYENTE: 'PERSONA NATURAL', 
            DESCRIPCION_PARROQUIA_EST: 'QUITO' 
        },
        { 
            id: '5',
            NUMERO_RUC: '1791234567001', 
            RAZON_SOCIAL: 'AGROINDUSTRIAL GANADERA S.A.', 
            CODIGO_JURISDICCION: 'GUAYAS', 
            TIPO_CONTRIBUYENTE: 'SOCIEDAD', 
            DESCRIPCION_PARROQUIA_EST: 'GUAYAQUIL' 
        }
    ];
}

/**
 * Procesa el texto CSV en lotes
 */
function procesarCSV(text, onProgress = null) {
    return new Promise((resolve) => {
        const delimiter = CLIENTES_CONFIG.CSV_DELIMITER || ';';
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            resolve([]);
            return;
        }
        
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
        const total = lines.length - 1;
        const batchSize = CLIENTES_CONFIG.BATCH_SIZE || 10000;
        const results = [];
        let procesados = 0;
        
        function procesarLote(inicio) {
            const fin = Math.min(inicio + batchSize, lines.length);
            
            for (let i = inicio; i < fin; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                let values = [];
                let current = '';
                let inQuotes = false;
                
                for (let char of line) {
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === delimiter && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());
                
                const obj = { id: `c${i}` };
                headers.forEach((h, idx) => {
                    let val = values[idx] || '';
                    val = val.replace(/^"|"$/g, '').trim();
                    obj[h] = val;
                });
                
                if (obj.NUMERO_RUC && obj.RAZON_SOCIAL) {
                    results.push(obj);
                }
            }
            
            procesados += (fin - inicio);
            if (onProgress) {
                const porcentaje = Math.round((procesados / total) * 100);
                onProgress(porcentaje, procesados, total);
            }
            
            if (fin < lines.length) {
                setTimeout(() => procesarLote(fin), 10);
            } else {
                resolve(results);
            }
        }
        
        procesarLote(1);
    });
}

/**
 * CARGA AUTOMÁTICA - Sin interacción del usuario
 * Intenta cargar desde la URL configurada
 */
async function cargarContribuyentes(forzar = false) {
    if (contribuyentesCargados && !forzar) {
        console.log('[clientes.js] Usando caché de contribuyentes');
        return true;
    }
    
    if (contribuyentesCargando) {
        console.log('[clientes.js] Ya está cargando contribuyentes...');
        return true;
    }
    
    contribuyentesCargando = true;
    
    try {
        console.log('[clientes.js] Cargando base de datos de contribuyentes SRI...');
        
        // Verificar si ya hay datos en IndexedDB
        try {
            const count = await contarContribuyentesIndexedDB();
            if (count > 0 && !forzar) {
                console.log(`[clientes.js] Usando datos de IndexedDB (${count} registros)`);
                contribuyentesData = await obtenerMuestraIndexedDB(1000);
                construirIndiceContribuyentes(contribuyentesData);
                contribuyentesCargados = true;
                contribuyentesCargando = false;
                mostrarToast(`✅ Base de datos SRI: ${count.toLocaleString()} registros cargados`, 'success', 3000);
                return true;
            }
        } catch (e) {
            console.warn('[clientes.js] Error verificando IndexedDB:', e);
        }
        
        // Intentar cargar desde la URL del servidor
        mostrarToast('📥 Cargando base de datos del SRI...', 'info', 2000);
        
        const response = await fetch(CLIENTES_CONFIG.CSV_URL);
        
        if (!response.ok) {
            throw new Error(`Error al cargar CSV: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        
        if (!text || text.trim().length === 0) {
            throw new Error('El archivo CSV está vacío');
        }
        
        // Procesar el CSV en lotes
        const data = await procesarCSV(text, (porcentaje, procesados, total) => {
            if (porcentaje % 10 === 0) {
                mostrarToast(`📥 Procesando: ${porcentaje}% (${procesados.toLocaleString()}/${total.toLocaleString()})`, 'info', 1000);
            }
        });
        
        if (data.length > 0) {
            // Guardar en IndexedDB
            await guardarContribuyentesEnIndexedDB(data);
            contribuyentesData = data.slice(0, 1000);
            construirIndiceContribuyentes(contribuyentesData);
            contribuyentesCargados = true;
            mostrarToast(`✅ ${data.length.toLocaleString()} contribuyentes cargados`, 'success', 4000);
            console.log(`[clientes.js] Contribuyentes cargados: ${data.length}`);
        } else {
            throw new Error('No se encontraron datos válidos en el CSV');
        }
        
        contribuyentesCargando = false;
        return true;
        
    } catch (error) {
        console.error('[clientes.js] Error cargando contribuyentes:', error);
        
        // Fallback a datos de ejemplo
        mostrarToast('⚠️ Usando datos de ejemplo. No se pudo cargar el CSV completo.', 'warning', 5000);
        contribuyentesData = obtenerContribuyentesEjemplo();
        construirIndiceContribuyentes(contribuyentesData);
        contribuyentesCargados = true;
        contribuyentesCargando = false;
        return true;
    }
}

async function obtenerMuestraIndexedDB(limite = 1000) {
    const db = await abrirIndexedDB();
    const transaction = db.transaction([CLIENTES_CONFIG.STORE_NAME], 'readonly');
    const store = transaction.objectStore(CLIENTES_CONFIG.STORE_NAME);
    
    return new Promise((resolve) => {
        const results = [];
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && results.length < limite) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = () => resolve([]);
    });
}

function construirIndiceContribuyentes(data) {
    contribuyentesIndex = {
        porRUC: {},
        porNombre: {}
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
    }
}

function buscarContribuyentePorRUC(ruc) {
    if (!ruc || !contribuyentesIndex) return null;
    
    const rucLimpio = ruc.replace(/[^0-9]/g, '');
    
    // Búsqueda exacta
    if (contribuyentesIndex.porRUC[rucLimpio]) {
        return contribuyentesIndex.porRUC[rucLimpio];
    }
    
    // Búsqueda por últimos 4 dígitos
    if (rucLimpio.length >= 4) {
        const ultimos = rucLimpio.slice(-4);
        if (contribuyentesIndex.porRUC[ultimos]) {
            const resultados = Array.isArray(contribuyentesIndex.porRUC[ultimos]) ? 
                contribuyentesIndex.porRUC[ultimos] : [contribuyentesIndex.porRUC[ultimos]];
            if (resultados.length > 0) {
                return resultados[0];
            }
        }
    }
    
    return null;
}

function buscarContribuyentesPorNombre(nombre, limite = 10) {
    if (!nombre || !contribuyentesIndex) return [];
    
    const busqueda = normalizarTexto(nombre);
    if (!busqueda) return [];
    
    const resultadosSet = new Set();
    const palabras = busqueda.split(/\s+/);
    
    for (const p of palabras) {
        if (p.length > 2 && contribuyentesIndex.porNombre[p]) {
            for (const c of contribuyentesIndex.porNombre[p]) {
                resultadosSet.add(c);
            }
        }
    }
    
    return Array.from(resultadosSet).slice(0, limite);
}

// ================================================================
// 6. INDICE DE CLIENTES
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
        
        if (cliente.ruc) {
            const rucLimpio = cliente.ruc.replace(/[^0-9]/g, '');
            if (rucLimpio) {
                this.porRUC[rucLimpio] = cliente;
                if (rucLimpio.length >= 4) {
                    const ultimos = rucLimpio.slice(-4);
                    if (!this.porRUC[ultimos]) this.porRUC[ultimos] = [];
                    if (Array.isArray(this.porRUC[ultimos])) {
                        this.porRUC[ultimos].push(cliente);
                    } else {
                        this.porRUC[ultimos] = [this.porRUC[ultimos], cliente];
                    }
                }
            }
        }
        
        if (cliente.cedula && cliente.cedula !== cliente.ruc) {
            const cedulaLimpia = cliente.cedula.replace(/[^0-9]/g, '');
            if (cedulaLimpia) {
                this.porRUC[cedulaLimpia] = cliente;
            }
        }
        
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
        
        if (cliente.telefono) {
            const telefonoLimpio = cliente.telefono.replace(/[^0-9]/g, '');
            if (telefonoLimpio) {
                this.porTelefono[telefonoLimpio] = cliente;
                if (telefonoLimpio.length >= 4) {
                    const ultimos = telefonoLimpio.slice(-4);
                    if (!this.porTelefono[ultimos]) this.porTelefono[ultimos] = [];
                    if (Array.isArray(this.porTelefono[ultimos])) {
                        this.porTelefono[ultimos].push(cliente);
                    } else {
                        this.porTelefono[ultimos] = [this.porTelefono[ultimos], cliente];
                    }
                }
            }
        }
        
        if (cliente.email) {
            const emailNormalizado = normalizarTexto(cliente.email);
            if (emailNormalizado) {
                this.porEmail[emailNormalizado] = cliente;
            }
        }
        
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
        
        if (campo === 'ruc' || !campo) {
            const rucLimpio = query.replace(/[^0-9]/g, '');
            if (rucLimpio) {
                if (this.porRUC[rucLimpio]) {
                    const cliente = this.porRUC[rucLimpio];
                    if (!Array.isArray(cliente)) {
                        resultados.add(cliente.id);
                    } else {
                        for (const c of cliente) resultados.add(c.id);
                    }
                }
                if (rucLimpio.length >= 4) {
                    const ultimos = rucLimpio.slice(-4);
                    if (this.porRUC[ultimos]) {
                        const clientes = Array.isArray(this.porRUC[ultimos]) ? this.porRUC[ultimos] : [this.porRUC[ultimos]];
                        for (const c of clientes) resultados.add(c.id);
                    }
                }
            }
        }
        
        if (campo === 'nombre' || !campo) {
            for (const palabra of palabras) {
                if (palabra.length > 2 && this.porNombre[palabra]) {
                    for (const id of this.porNombre[palabra]) {
                        resultados.add(id);
                    }
                }
            }
        }
        
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
        
        if (campo === 'email' || !campo) {
            const emailNorm = normalizarTexto(query);
            if (emailNorm && this.porEmail[emailNorm]) {
                resultados.add(this.porEmail[emailNorm].id);
            }
        }
        
        if (campo === 'numero' || !campo) {
            const num = query.replace(/[^0-9]/g, '');
            if (num && this.porNumero[num]) {
                resultados.add(this.porNumero[num].id);
            }
        }
        
        return Array.from(resultados).map(id => this.porId[id]).filter(Boolean);
    }
}

clientesIndex = new IndiceClientes();

// ================================================================
// 7. INICIALIZAR MÓDULO
// ================================================================

function cargarClientes(callback = null) {
    console.log('[clientes.js] Inicializando módulo de clientes...');

    // Carga automática del CSV
    cargarContribuyentes();

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
// 8. RENDERIZAR CLIENTES
// ================================================================

function renderizarClientes() {
    const container = document.getElementById('clientesContent');
    if (!container) return;

    const isAdmin = esAdmin();
    const clientesLista = Object.values(clientesCache);
    
    let filtrados = clientesLista;
    
    if (filtroActual.busqueda) {
        const resultados = clientesIndex.buscar(filtroActual.busqueda);
        const ids = new Set(resultados.map(c => c.id));
        filtrados = filtrados.filter(c => ids.has(c.id));
    }
    
    if (filtroActual.tipo) {
        filtrados = filtrados.filter(c => c.tipo === filtroActual.tipo);
    }
    
    if (filtroActual.estado) {
        filtrados = filtrados.filter(c => c.status === filtroActual.estado);
    }
    
    if (filtroActual.ciudad) {
        filtrados = filtrados.filter(c => (c.ciudad || '').toLowerCase().includes(filtroActual.ciudad.toLowerCase()));
    }
    
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
    
    const pageSize = CLIENTES_CONFIG.PAGE_SIZE;
    const totalPages = Math.ceil(filtrados.length / pageSize) || 1;
    const page = Math.min(filtroActual.pagina || 1, totalPages);
    const start = (page - 1) * pageSize;
    const paginados = filtrados.slice(start, start + pageSize);
    
    const total = clientesLista.length;
    const personas = clientesLista.filter(c => c.tipo === 'persona').length;
    const empresas = clientesLista.filter(c => c.tipo === 'empresa').length;
    const ganaderos = clientesLista.filter(c => c.tipo === 'ganadero').length;
    const intermediarios = clientesLista.filter(c => c.tipo === 'intermediario').length;

    // Estado de carga de contribuyentes
    const estadoSRI = contribuyentesCargados ? 
        `✅ Base SRI: ${contribuyentesData.length} registros` : 
        '⏳ Cargando base SRI...';

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

    html += `
        <div class="card">
            <div class="card-header" style="flex-wrap:wrap;gap:8px;">
                <span class="card-title"><i class="fas fa-users"></i> Lista de Clientes (${filtrados.length})</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <div style="position:relative;display:flex;align-items:center;gap:4px;">
                        <input type="text" id="buscarCliente" placeholder="🔍 Buscar..." 
                               style="padding:6px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);min-width:200px;font-size:0.9rem;">
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
            <div style="padding:8px;background:var(--bg-primary);border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.8rem;color:var(--text-secondary);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <span><i class="fas fa-database"></i> ${estadoSRI}</span>
                <span>
                    <button class="btn btn-sm btn-secondary" onclick="recargarContribuyentes()" title="Recargar base de datos SRI">
                        <i class="fas fa-sync"></i> Recargar
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="mostrarBuscadorRUC()">
                        <i class="fas fa-search"></i> Buscar en SRI
                    </button>
                </span>
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

    const searchInput = document.getElementById('buscarCliente');
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

// ================================================================
// 9. RECARGAR CONTRIBUYENTES
// ================================================================

window.recargarContribuyentes = async function() {
    mostrarToast('🔄 Recargando base de datos del SRI...', 'info', 2000);
    contribuyentesCargados = false;
    await cargarContribuyentes(true);
    renderizarClientes();
};

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

// ================================================================
// 10. BUSCADOR DE CONTRIBUYENTES
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
                    ${contribuyentesCargados ? 
                        `Base de datos: ${contribuyentesData.length} registros disponibles` : 
                        '⏳ Cargando base de datos...'}
                </p>
                <button class="btn btn-sm btn-secondary" onclick="recargarContribuyentes()" style="margin-top:8px;">
                    <i class="fas fa-sync"></i> Recargar datos
                </button>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group">
                    <label>Buscar por RUC / Cédula</label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="buscarRUCInput" placeholder="Ej: 1712886751" 
                            style="flex:1;padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-size:1rem;">
                        <button class="btn btn-primary" onclick="buscarContribuyentePorRUCUI()">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
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
                </div>
            </div>
            
            <div id="resultadosBusquedaRUC" style="max-height:350px;overflow-y:auto;margin-top:12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:12px;background:var(--bg-secondary);">
                <p style="color:var(--text-light);text-align:center;padding:20px;margin:0;">
                    <i class="fas fa-info-circle"></i> Ingresa un RUC o nombre para buscar
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
                <br>
                <button class="btn btn-success" onclick="usarResultadoRUC(null, '${ruc}')">
                    <i class="fas fa-user-plus"></i> Registrar como nuevo cliente
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="background:#d1fae5;border-radius:8px;padding:16px;border:2px solid var(--color-success);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                <div>
                    <h4 style="margin:0;color:var(--color-success);">
                        <i class="fas fa-check-circle"></i> Contribuyente encontrado
                    </h4>
                </div>
                <button class="btn btn-success" onclick="usarResultadoRUC('${resultado.NUMERO_RUC}')">
                    <i class="fas fa-check"></i> Usar para facturación
                </button>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.9rem;background:white;padding:12px;border-radius:var(--radius-sm);">
                <div style="grid-column:span 2;"><strong>Razón Social:</strong> ${escapeHTML(resultado.RAZON_SOCIAL)}</div>
                <div><strong>RUC:</strong> ${resultado.NUMERO_RUC}</div>
                <div><strong>Tipo:</strong> ${resultado.TIPO_CONTRIBUYENTE || 'N/A'}</div>
                <div style="grid-column:span 2;"><strong>Jurisdicción:</strong> ${resultado.CODIGO_JURISDICCION || 'N/A'}</div>
                ${resultado.DESCRIPCION_PARROQUIA_EST ? `<div style="grid-column:span 2;"><strong>Parroquia:</strong> ${resultado.DESCRIPCION_PARROQUIA_EST}</div>` : ''}
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

    realizarBusquedaNombre(nombre, container);
}

function realizarBusquedaNombre(nombre, container) {
    const resultados = buscarContribuyentesPorNombre(nombre, CLIENTES_CONFIG.MAX_RESULTS);
    
    if (resultados.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:20px;color:var(--text-light);">
                <i class="fas fa-exclamation-circle" style="font-size:2rem;display:block;margin-bottom:10px;color:var(--color-warning);"></i>
                <p><strong>No se encontraron contribuyentes</strong></p>
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
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">
                            ${r.TIPO_CONTRIBUYENTE || ''} • ${r.CODIGO_JURISDICCION || ''}
                        </div>
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                        <span style="font-size:0.9rem;font-weight:bold;color:var(--color-primary);">${r.NUMERO_RUC}</span>
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
// 11. FORMULARIO CON DATOS PRECARGADOS
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
        datosPrecargados.razonSocial = contribuyente.RAZON_SOCIAL || '';
        datosPrecargados.tipoContribuyente = contribuyente.TIPO_CONTRIBUYENTE || '';
        datosPrecargados.provincia = contribuyente.CODIGO_JURISDICCION || '';
        datosPrecargados.parroquia = contribuyente.DESCRIPCION_PARROQUIA_EST || '';
        
        if (contribuyente.TIPO_CONTRIBUYENTE?.toLowerCase().includes('sociedad')) {
            datosPrecargados.tipo = 'empresa';
        } else {
            datosPrecargados.tipo = 'persona';
        }
        
        mostrarToast('✅ Datos del contribuyente precargados', 'success');
    } else if (rucManual) {
        datosPrecargados.ruc = rucManual;
        datosPrecargados.cedula = rucManual;
        mostrarToast('ℹ️ RUC ingresado manualmente', 'info');
    }

    await abrirFormularioCliente(null, datosPrecargados);
}

// ================================================================
// 12. CREAR/EDITAR CLIENTE
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
                ${!isEdit ? `<span style="font-size:0.8rem;color:var(--text-secondary);align-self:center;">Busca en la base de datos del SRI Ecuador</span>` : ''}
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
                    <small style="color:var(--text-light);">${getVal('tipoContribuyente') ? `Tipo: ${getVal('tipoContribuyente')}` : 'Ingresa el RUC'}</small>
                </div>
                <div class="form-group" style="grid-column:span 2;">
                    <label>Razón Social / Nombre Completo <span style="color:var(--color-danger);">*</span></label>
                    <input type="text" id="cNombre" value="${getVal('nombre', '')}" class="form-control" required placeholder="Razón social o nombre completo">
                </div>
                <div class="form-group" style="grid-column:span 2;">
                    <label>Nombre Comercial</label>
                    <input type="text" id="cNombreComercial" value="${getVal('nombreComercial', '')}" class="form-control" placeholder="Nombre comercial">
                </div>
                <div class="form-group">
                    <label>Teléfono <span style="color:var(--text-light);">(Opcional)</span></label>
                    <input type="tel" id="cTelefono" value="${getVal('telefono', '')}" class="form-control" placeholder="Número de contacto">
                </div>
                <div class="form-group">
                    <label>Email <span style="color:var(--text-light);">(Opcional)</span></label>
                    <input type="email" id="cEmail" value="${getVal('email', '')}" class="form-control" placeholder="correo@ejemplo.com">
                </div>
                <div class="form-group">
                    <label>Provincia / Jurisdicción</label>
                    <input type="text" id="cProvincia" value="${getVal('provincia', getVal('CODIGO_JURISDICCION', ''))}" class="form-control" placeholder="Provincia">
                </div>
                <div class="form-group">
                    <label>Cantón / Parroquia</label>
                    <input type="text" id="cCanton" value="${getVal('canton', getVal('parroquia', getVal('DESCRIPCION_PARROQUIA_EST', '')))}" class="form-control" placeholder="Cantón o parroquia">
                </div>
                <div class="form-group" style="grid-column:span 2;">
                    <label>Dirección</label>
                    <input type="text" id="cDireccion" value="${getVal('direccion', '')}" class="form-control" placeholder="Dirección completa">
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
// 13. GUARDAR Y ACTUALIZAR CLIENTE
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
        const observaciones = document.getElementById('cObservaciones')?.value.trim();

        const errors = [];
        if (!tipo) errors.push('Selecciona un tipo de cliente');
        if (!nombre) errors.push('La razón social / nombre es obligatorio');

        if (ruc) {
            const rucLimpio = ruc.replace(/[^0-9]/g, '');
            if (rucLimpio.length < 10 || rucLimpio.length > 13) {
                errors.push('El RUC debe tener entre 10 y 13 dígitos');
            }
            if (!validarRUC(rucLimpio)) {
                errors.push('El RUC debe tener 10 o 13 dígitos numéricos');
            }
            const duplicado = Object.values(clientesCache).find(c => 
                (c.ruc === rucLimpio || c.cedula === rucLimpio)
            );
            if (duplicado) {
                errors.push(`Ya existe un cliente con el RUC "${rucLimpio}" (${duplicado.nombre})`);
            }
        } else {
            errors.push('El RUC es obligatorio');
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
            telefono: telefono || '',
            email: email || '',
            provincia: provincia || '',
            canton: canton || '',
            ciudad: canton || provincia || '',
            direccion: direccion || '',
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
        renderizarClientes();
        return true;

    } catch (error) {
        console.error('[clientes.js] Error al guardar:', error);
        mostrarToast('❌ Error al guardar el cliente: ' + error.message, 'error');
        return false;
    }
}

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
        const observaciones = document.getElementById('cObservaciones')?.value.trim();

        const errors = [];
        if (!tipo) errors.push('Selecciona un tipo de cliente');
        if (!nombre) errors.push('La razón social / nombre es obligatorio');

        if (ruc) {
            const rucLimpio = ruc.replace(/[^0-9]/g, '');
            if (rucLimpio.length < 10 || rucLimpio.length > 13) {
                errors.push('El RUC debe tener entre 10 y 13 dígitos');
            }
            if (!validarRUC(rucLimpio)) {
                errors.push('El RUC debe tener 10 o 13 dígitos numéricos');
            }
            const duplicado = Object.values(clientesCache).find(c => 
                (c.ruc === rucLimpio || c.cedula === rucLimpio) && c.id !== clienteId
            );
            if (duplicado) {
                errors.push(`Ya existe otro cliente con el RUC "${rucLimpio}" (${duplicado.nombre})`);
            }
        } else {
            errors.push('El RUC es obligatorio');
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
            telefono: telefono || '',
            email: email || '',
            provincia: provincia || '',
            canton: canton || '',
            ciudad: canton || provincia || '',
            direccion: direccion || '',
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
// 14. VER DETALLE DE CLIENTE
// ================================================================

async function verDetalleCliente(clienteId) {
    try {
        const cliente = clientesCache[clienteId];
        if (!cliente) {
            mostrarToast('❌ Cliente no encontrado', 'error');
            return;
        }

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
                        </div>
                        ${cliente.observaciones ? `
                            <div style="margin-top:12px;padding:8px;background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:0.85rem;">
                                <strong>Observaciones:</strong> ${escapeHTML(cliente.observaciones)}
                            </div>
                        ` : ''}
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
// 15. ELIMINAR CLIENTE
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

    const html = `
        <div style="text-align:center;padding:20px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:12px;"></i>
            <p style="font-size:1.1rem;font-weight:500;">¿Estás seguro de eliminar este cliente?</p>
            <div style="background:var(--bg-primary);border-radius:8px;padding:16px;margin:16px 0;text-align:left;">
                <p><strong>Nombre:</strong> ${escapeHTML(cliente.nombre)}</p>
                <p><strong>RUC:</strong> ${cliente.ruc || cliente.cedula || 'N/A'}</p>
                <p><strong>Teléfono:</strong> ${cliente.telefono || 'N/A'}</p>
            </div>
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
        await db.ref(`clientes/${clienteId}`).remove();
        mostrarToast(`✅ Cliente "${cliente.nombre}" eliminado correctamente`, 'success');
        renderizarClientes();
    } catch (error) {
        console.error('[clientes.js] Error al eliminar:', error);
        mostrarToast('❌ Error al eliminar: ' + error.message, 'error');
    }
};

// ================================================================
// 16. EXPORTAR CLIENTES
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
// 17. EXPOSICIÓN GLOBAL
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
window.recargarContribuyentes = recargarContribuyentes;

console.log(`[clientes.js] Módulo de clientes v${CLIENTES_CONFIG.VERSION} cargado correctamente`);