/**
 * configuracion.js - Módulo Avanzado de Configuración y Administración
 * Sistema completo para gestionar todos los parámetros configurables de la granja
 * Versión 3.2 - CORREGIDO (sin errores de await)
 */

// ===== VARIABLES LOCALES =====
let configuracionData = {};
let configuracionListener = null;
let configuracionHistorial = [];
let configuracionFiltro = '';

// ===== CONSTANTES =====
const LISTAS_CONFIG = {
    categorias: {
        label: 'Categorías de Animales',
        icon: 'fa-tags',
        description: 'Clasificación principal de los animales',
        color: '#3b82f6',
        grupo: 'animales',
        required: true,
        defaultItems: ['Madre', 'Reproductor', 'Lechón', 'Engorde', 'Cebo']
    },
    razas: {
        label: 'Razas',
        icon: 'fa-dna',
        description: 'Razas de animales registradas',
        color: '#8b5cf6',
        grupo: 'animales',
        required: true,
        defaultItems: ['Landrace', 'Duroc', 'Pietrain', 'Large White', 'Hampshire']
    },
    colores: {
        label: 'Colores',
        icon: 'fa-palette',
        description: 'Colores de pelaje de los animales',
        color: '#ec4899',
        grupo: 'animales',
        required: true,
        defaultItems: ['Blanco', 'Negro', 'Rojizo', 'Pinto', 'Gris', 'Café']
    },
    corrales: {
        label: 'Corrales',
        icon: 'fa-home',
        description: 'Ubicaciones físicas de los animales',
        color: '#f59e0b',
        grupo: 'instalaciones',
        required: true,
        defaultItems: ['Corral 1', 'Corral 2', 'Corral 3', 'Corral 4', 'Corral 5']
    },
    lotes: {
        label: 'Lotes de Producción',
        icon: 'fa-layer-group',
        description: 'Lotes de producción para agrupación',
        color: '#14b8a6',
        grupo: 'produccion',
        required: false,
        defaultItems: ['Lote A', 'Lote B', 'Lote C', 'Lote 2024-1', 'Lote 2024-2']
    },
    tiposVacunas: {
        label: 'Vacunas',
        icon: 'fa-syringe',
        description: 'Vacunas disponibles para los animales',
        color: '#22c55e',
        grupo: 'salud',
        required: true,
        defaultItems: ['Fiebre Aftosa', 'Peste Porcina', 'Parvovirus', 'Leptospirosis', 'Erisipela']
    },
    medicamentos: {
        label: 'Medicamentos',
        icon: 'fa-pills',
        description: 'Medicamentos en inventario',
        color: '#ef4444',
        grupo: 'salud',
        required: true,
        defaultItems: ['Oxitetraciclina', 'Penicilina', 'Ivermectina', 'Enrofloxacina', 'Ampicilina']
    },
    enfermedades: {
        label: 'Enfermedades Comunes',
        icon: 'fa-virus',
        description: 'Registro de enfermedades comunes',
        color: '#dc2626',
        grupo: 'salud',
        required: false,
        defaultItems: ['Diarrea', 'Neumonía', 'Sarna', 'Gripe Porcina', 'Síndrome Reproductivo']
    },
    alimentos: {
        label: 'Tipos de Alimento',
        icon: 'fa-seedling',
        description: 'Tipos de alimento utilizados',
        color: '#65a30d',
        grupo: 'alimentacion',
        required: false,
        defaultItems: ['Balanceado Inicio', 'Balanceado Crecimiento', 'Balanceado Terminación', 'Granos', 'Suplemento']
    },
    proveedores: {
        label: 'Proveedores',
        icon: 'fa-truck',
        description: 'Proveedores de insumos y servicios',
        color: '#6366f1',
        grupo: 'externos',
        required: false,
        defaultItems: ['Agroinsumos S.A.', 'Alimentos del Campo', 'Veterinaria Central', 'Distribuidora Pecuaria']
    },
    metodosPago: {
        label: 'Métodos de Pago',
        icon: 'fa-credit-card',
        description: 'Métodos de pago aceptados',
        color: '#059669',
        grupo: 'finanzas',
        required: false,
        defaultItems: ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Cheque', 'Depósito']
    },
    tiposEvento: {
        label: 'Tipos de Evento',
        icon: 'fa-calendar-alt',
        description: 'Clasificación de eventos registrados',
        color: '#7c3aed',
        grupo: 'eventos',
        required: true,
        defaultItems: ['Pesaje', 'Vacuna', 'Tratamiento', 'Inseminación', 'Parto', 'Cambio de Corral', 'Venta', 'Muerte', 'Diagnóstico', 'Destete']
    }
};

const GRUPOS_CONFIG = {
    animales: { label: '🐖 Gestión Animal', icon: 'fa-paw' },
    instalaciones: { label: '🏠 Instalaciones', icon: 'fa-building' },
    produccion: { label: '📦 Producción', icon: 'fa-chart-line' },
    salud: { label: '💉 Salud', icon: 'fa-heartbeat' },
    alimentacion: { label: '🌾 Alimentación', icon: 'fa-seedling' },
    externos: { label: '🤝 Externos', icon: 'fa-handshake' },
    finanzas: { label: '💰 Finanzas', icon: 'fa-coins' },
    eventos: { label: '📋 Eventos', icon: 'fa-calendar-check' }
};

// ===== INICIALIZAR MÓDULO =====
function cargarConfiguracion() {
    console.log('[configuracion.js] Inicializando módulo avanzado de configuración...');
    const container = document.getElementById('configuracionContent');
    if (!container) {
        console.error('[configuracion.js] Contenedor no encontrado');
        return;
    }

    if (currentUser?.rol !== 'admin' && currentUser?.email !== 'vinicio@geomira.se') {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:60px 20px;border:2px dashed var(--color-danger);">
                <i class="fas fa-lock" style="font-size:4rem;color:var(--color-danger);display:block;margin-bottom:16px;"></i>
                <h2 style="font-size:1.5rem;margin-bottom:8px;">Acceso Restringido</h2>
                <p style="color:var(--text-secondary);max-width:400px;margin:0 auto;">
                    Solo los administradores pueden acceder a la configuración del sistema.
                </p>
                <div style="margin-top:16px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-sm);display:inline-block;">
                    <span class="badge badge-purple"><i class="fas fa-user-shield"></i> Administrador</span>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="card" style="text-align:center;padding:60px;">
            <div class="loader" style="margin:20px auto;"></div>
            <p style="color:var(--text-secondary);">Cargando configuración avanzada...</p>
        </div>
    `;

    cargarDatosConfiguracion();
}

// ===== CARGAR DATOS =====
async function cargarDatosConfiguracion() {
    try {
        const snapshot = await db.ref('configuraciones').once('value');
        const data = snapshot.val() || {};
        
        if (Object.keys(data).length === 0) {
            const defaultData = await crearConfiguracionesPorDefecto();
            configuracionData = defaultData;
            guardarHistorial('configuracion_inicial', 'Configuración inicial creada');
        } else {
            configuracionData = data;
        }

        if (configuracionListener) {
            configuracionListener.off();
        }
        configuracionListener = db.ref('configuraciones').on('value', snap => {
            const newData = snap.val() || {};
            if (JSON.stringify(configuracionData) !== JSON.stringify(newData)) {
                configuracionData = newData;
                window.configuraciones = configuracionData;
                if (document.getElementById('configuracionContent')) {
                    renderizarConfiguracion();
                }
            }
        });

        renderizarConfiguracion();
    } catch (error) {
        console.error('[configuracion.js] Error:', error);
        mostrarToast('❌ Error al cargar configuración: ' + error.message, 'error');
        document.getElementById('configuracionContent').innerHTML = `
            <div class="card" style="text-align:center;padding:40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:16px;"></i>
                <h3>Error al cargar configuración</h3>
                <p style="color:var(--text-secondary);">${error.message}</p>
                <button class="btn btn-primary" onclick="cargarConfiguracion()" style="margin-top:16px;">
                    <i class="fas fa-sync"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// ===== CREAR CONFIGURACIONES POR DEFECTO =====
async function crearConfiguracionesPorDefecto() {
    const defaultConfig = {};
    for (const [key, config] of Object.entries(LISTAS_CONFIG)) {
        defaultConfig[key] = config.defaultItems.map((nombre, index) => ({
            id: `${key}_${index + 1}`,
            nombre: nombre,
            createdAt: Date.now(),
            createdBy: currentUser?.uid || 'system',
            updatedAt: Date.now()
        }));
    }
    
    try {
        await db.ref('configuraciones').set(defaultConfig);
        mostrarToast('✅ Configuraciones por defecto creadas', 'success');
        return defaultConfig;
    } catch (error) {
        console.error('[configuracion.js] Error:', error);
        throw error;
    }
}

// ===== GUARDAR HISTORIAL =====
function guardarHistorial(tipo, descripcion, datos = {}) {
    configuracionHistorial.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        tipo: tipo,
        descripcion: descripcion,
        datos: datos,
        fecha: Date.now(),
        usuario: currentUser?.email || 'sistema',
        usuarioNombre: currentUser?.nombre || 'Sistema'
    });
    if (configuracionHistorial.length > 100) {
        configuracionHistorial = configuracionHistorial.slice(0, 100);
    }
}

// ===== RENDERIZAR CONFIGURACIÓN =====
function renderizarConfiguracion() {
    const container = document.getElementById('configuracionContent');
    if (!container) return;

    const totalItems = Object.values(configuracionData).reduce((sum, list) => sum + (list ? list.length : 0), 0);
    const totalListas = Object.keys(configuracionData).length;

    let html = `
        <div class="config-header" style="margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
                <div>
                    <h2 style="font-size:1.8rem;font-weight:700;display:flex;align-items:center;gap:12px;">
                        <i class="fas fa-cog" style="color:var(--color-primary);"></i>
                        Panel de Configuración
                    </h2>
                    <p style="color:var(--text-secondary);margin-top:4px;">
                        Gestión avanzada de todos los parámetros del sistema
                    </p>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <span class="badge badge-purple"><i class="fas fa-user-shield"></i> Administrador</span>
                    <span class="badge badge-success" id="configStatus">
                        <i class="fas fa-check-circle"></i> Sincronizado
                    </span>
                    <span class="badge badge-outline">${totalListas} listas</span>
                    <span class="badge badge-outline">${totalItems} ítems</span>
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:16px;padding:16px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                ${Object.entries(GRUPOS_CONFIG).map(([key, grupo]) => {
                    const count = Object.entries(LISTAS_CONFIG).filter(([k, v]) => v.grupo === key).length;
                    const items = Object.values(configuracionData).filter((list, i) => {
                        const listKey = Object.keys(LISTAS_CONFIG)[i];
                        return LISTAS_CONFIG[listKey]?.grupo === key;
                    }).reduce((sum, list) => sum + (list ? list.length : 0), 0);
                    return `
                        <div style="text-align:center;">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">${grupo.label}</div>
                            <div style="font-size:1.2rem;font-weight:700;">${items}</div>
                            <div style="font-size:0.65rem;color:var(--text-light);">${count} listas</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <div class="card" style="margin-bottom:16px;border:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;flex:1;">
                    <div style="flex:1;min-width:200px;position:relative;">
                        <i class="fas fa-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-light);"></i>
                        <input type="text" id="configSearch" placeholder="Buscar listas o elementos..." 
                            style="width:100%;padding:8px 12px 8px 36px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);"
                            oninput="filtrarConfiguracion(this.value)">
                    </div>
                    <select id="configGrupoFilter" onchange="filtrarConfiguracion(document.getElementById('configSearch').value)" 
                        style="padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);">
                        <option value="">Todos los grupos</option>
                        ${Object.entries(GRUPOS_CONFIG).map(([key, grupo]) => 
                            `<option value="${key}">${grupo.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-success btn-sm" onclick="exportarConfiguracion()">
                        <i class="fas fa-file-export"></i> Exportar
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="importarConfiguracion()">
                        <i class="fas fa-file-import"></i> Importar
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="verHistorialConfiguracion()">
                        <i class="fas fa-history"></i> Historial
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="resetearConfiguracion()">
                        <i class="fas fa-trash"></i> Resetear
                    </button>
                </div>
            </div>
        </div>
    `;

    const grupos = {};
    for (const [key, config] of Object.entries(LISTAS_CONFIG)) {
        const grupo = config.grupo || 'otros';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push({ key, config });
    }

    for (const [grupoKey, listas] of Object.entries(grupos)) {
        const grupoInfo = GRUPOS_CONFIG[grupoKey] || { label: 'Otros', icon: 'fa-folder' };
        html += `
            <div class="card" style="margin-bottom:16px;border-left:4px solid var(--color-primary);" data-grupo="${grupoKey}">
                <div class="card-header" style="margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border-color);">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <i class="fas ${grupoInfo.icon}" style="color:var(--color-primary);font-size:1.2rem;"></i>
                        <span style="font-weight:600;font-size:1.1rem;">${grupoInfo.label}</span>
                        <span class="badge badge-outline">${listas.length} listas</span>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    ${listas.map(({ key, config }) => renderizarListaConfiguracion(key, config)).join('')}
                </div>
            </div>
        `;
    }

    html += `
        <div class="card" style="border:1px dashed var(--border-color);background:var(--bg-primary);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div>
                    <span style="font-weight:500;"><i class="fas fa-info-circle"></i> Información del sistema</span>
                    <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">
                        Última actualización: ${new Date().toLocaleString('es-ES')}
                    </p>
                </div>
                <div style="display:flex;gap:8px;font-size:0.8rem;color:var(--text-secondary);">
                    <span><strong>${Object.keys(configuracionData).length}</strong> listas activas</span>
                    <span>•</span>
                    <span><strong>${totalItems}</strong> elementos totales</span>
                    <span>•</span>
                    <span><strong>${configuracionHistorial.length}</strong> cambios registrados</span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ===== RENDERIZAR LISTA =====
function renderizarListaConfiguracion(key, config) {
    const items = configuracionData[key] || [];
    const color = config.color || '#3b82f6';
    const filtroActual = document.getElementById('configSearch')?.value?.toLowerCase() || '';
    
    const itemsFiltrados = filtroActual ? 
        items.filter(item => item.nombre.toLowerCase().includes(filtroActual)) : 
        items;

    return `
        <div class="config-list" data-key="${key}" style="border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:16px;background:var(--bg-secondary);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                    <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:${color}20;display:flex;align-items:center;justify-content:center;color:${color};font-size:1rem;flex-shrink:0;">
                        <i class="fas ${config.icon}"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <h4 style="font-size:0.95rem;font-weight:600;margin:0;display:flex;align-items:center;gap:8px;">
                            ${config.label}
                            <span class="badge badge-outline" style="font-size:0.65rem;">${items.length}</span>
                            ${config.required ? '<span class="badge badge-danger" style="font-size:0.6rem;">Requerido</span>' : ''}
                        </h4>
                        <p style="font-size:0.75rem;color:var(--text-secondary);margin:0;">${config.description}</p>
                    </div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;">
                    <button class="btn btn-secondary btn-sm" onclick="expandirLista('${key}')" title="Ver todos">
                        <i class="fas fa-expand"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="restaurarLista('${key}')" title="Restaurar predeterminados">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            </div>
            
            <div class="items-container" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;min-height:32px;align-items:center;padding:4px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                ${itemsFiltrados.length === 0 ? 
                    `<span style="color:var(--text-light);font-size:0.8rem;padding:4px 12px;">
                        ${filtroActual ? 'No hay coincidencias' : 'Lista vacía'}
                    </span>` :
                    itemsFiltrados.map(item => `
                        <span class="badge" style="display:inline-flex;align-items:center;gap:4px;background:${color}15;color:var(--text-primary);padding:4px 12px;border:1px solid ${color}30;border-radius:16px;font-size:0.8rem;transition:all 0.2s;">
                            ${item.nombre}
                            <button onclick="eliminarItemConfig('${key}','${item.id}')" 
                                style="background:none;border:none;color:${color};cursor:pointer;font-size:0.65rem;padding:0 2px;opacity:0.5;transition:opacity 0.2s;"
                                onmouseover="this.style.opacity='1'" 
                                onmouseout="this.style.opacity='0.5'"
                                title="Eliminar ${item.nombre}">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </span>
                    `).join('')
                }
                ${filtroActual && itemsFiltrados.length < items.length ? 
                    `<span style="font-size:0.7rem;color:var(--text-light);">(+${items.length - itemsFiltrados.length} ocultos)</span>` : 
                    ''}
            </div>
            
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <div style="flex:1;min-width:120px;position:relative;">
                    <input type="text" id="input_${key}" 
                        placeholder="Nuevo ${config.label.toLowerCase().slice(0, -1)}..." 
                        style="width:100%;padding:6px 12px;padding-right:32px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem;"
                        onkeydown="if(event.key==='Enter') agregarItemConfig('${key}')">
                    <button onclick="agregarItemConfig('${key}')" 
                        style="position:absolute;right:2px;top:50%;transform:translateY(-50%);background:${color};border:none;color:white;padding:2px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;font-weight:500;">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
            
            <div id="message_${key}" style="margin-top:6px;display:none;font-size:0.8rem;"></div>
        </div>
    `;
}

// ===== FILTRAR CONFIGURACIÓN =====
function filtrarConfiguracion(valor) {
    configuracionFiltro = valor;
    const grupoFilter = document.getElementById('configGrupoFilter')?.value || '';
    
    document.querySelectorAll('[data-grupo]').forEach(grupoDiv => {
        const grupo = grupoDiv.dataset.grupo;
        if (grupoFilter && grupo !== grupoFilter) {
            grupoDiv.style.display = 'none';
            return;
        }
        grupoDiv.style.display = 'block';
        
        const listas = grupoDiv.querySelectorAll('.config-list');
        let visible = false;
        listas.forEach(lista => {
            const key = lista.dataset.key;
            const config = LISTAS_CONFIG[key];
            if (!config) return;
            
            const labelMatch = config.label.toLowerCase().includes(valor.toLowerCase());
            const items = configuracionData[key] || [];
            const itemMatch = items.some(item => item.nombre.toLowerCase().includes(valor.toLowerCase()));
            
            if (labelMatch || itemMatch || !valor) {
                lista.style.display = 'block';
                visible = true;
            } else {
                lista.style.display = 'none';
            }
        });
        
        if (!visible && valor) {
            grupoDiv.style.display = 'none';
        }
    });
}

// ===== AGREGAR ITEM =====
window.agregarItemConfig = async function(key) {
    if (currentUser?.rol !== 'admin' && currentUser?.email !== 'vinicio@geomira.se') {
        mostrarToast('⛔ No autorizado', 'error');
        return;
    }
    
    const input = document.getElementById(`input_${key}`);
    const valor = input.value.trim();
    const msgDiv = document.getElementById(`message_${key}`);
    const config = LISTAS_CONFIG[key];
    
    if (!valor) {
        mostrarToast('⚠️ Ingresa un valor', 'warning');
        input.focus();
        return;
    }
    
    if (valor.length < 2) {
        mostrarToast('⚠️ El valor debe tener al menos 2 caracteres', 'warning');
        input.focus();
        return;
    }
    
    if (valor.length > 50) {
        mostrarToast('⚠️ El valor no puede tener más de 50 caracteres', 'warning');
        input.focus();
        return;
    }
    
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-\.]+$/.test(valor)) {
        mostrarToast('⚠️ Solo letras, números, espacios y guiones', 'warning');
        input.focus();
        return;
    }
    
    const lista = configuracionData[key] || [];
    const duplicado = lista.find(item => item.nombre.toLowerCase() === valor.toLowerCase());
    if (duplicado) {
        mostrarToast(`⚠️ "${valor}" ya existe en ${config?.label || key}`, 'warning');
        if (msgDiv) {
            msgDiv.style.display = 'block';
            msgDiv.innerHTML = `<div style="background:var(--color-warning);color:white;padding:6px 12px;border-radius:var(--radius-sm);font-size:0.8rem;">
                <i class="fas fa-exclamation-triangle"></i> "${valor}" ya existe
            </div>`;
            setTimeout(() => { msgDiv.style.display = 'none'; }, 3000);
        }
        input.value = '';
        input.focus();
        return;
    }
    
    try {
        const nuevo = { 
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7), 
            nombre: valor,
            createdAt: Date.now(),
            createdBy: currentUser?.uid || 'system',
            createdByEmail: currentUser?.email || 'system'
        };
        lista.push(nuevo);
        await db.ref(`configuraciones/${key}`).set(lista);
        input.value = '';
        mostrarToast(`✅ "${valor}" agregado a ${config?.label || key}`, 'success');
        guardarHistorial('agregar_item', `Agregado "${valor}" a ${config?.label || key}`, { key, valor });
        input.focus();
        
        if (msgDiv) {
            msgDiv.style.display = 'block';
            msgDiv.innerHTML = `<div style="background:var(--color-success);color:white;padding:6px 12px;border-radius:var(--radius-sm);font-size:0.8rem;">
                <i class="fas fa-check-circle"></i> "${valor}" agregado correctamente
            </div>`;
            setTimeout(() => { msgDiv.style.display = 'none'; }, 3000);
        }
    } catch (error) {
        console.error('[configuracion.js] Error:', error);
        mostrarToast('❌ Error al agregar: ' + error.message, 'error');
    }
};

// ===== ELIMINAR ITEM =====
window.eliminarItemConfig = async function(key, id) {
    if (currentUser?.rol !== 'admin' && currentUser?.email !== 'vinicio@geomira.se') {
        mostrarToast('⛔ No autorizado', 'error');
        return;
    }
    
    const lista = configuracionData[key] || [];
    const item = lista.find(i => i.id === id);
    
    if (!item) {
        mostrarToast('⚠️ Ítem no encontrado', 'warning');
        return;
    }
    
    const config = LISTAS_CONFIG[key];
    const label = config?.label || key;
    
    if (config?.required && lista.length <= 3) {
        mostrarToast(`⚠️ "${label}" debe tener al menos 3 elementos`, 'warning');
        return;
    }
    
    const confirmar = confirm(`¿Estás seguro de eliminar "${item.nombre}" de ${label}?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmar) return;
    
    try {
        let lista = configuracionData[key] || [];
        lista = lista.filter(item => item.id !== id);
        await db.ref(`configuraciones/${key}`).set(lista);
        mostrarToast(`✅ "${item.nombre}" eliminado de ${label}`, 'success');
        guardarHistorial('eliminar_item', `Eliminado "${item.nombre}" de ${label}`, { key, item });
    } catch (error) {
        console.error('[configuracion.js] Error:', error);
        mostrarToast('❌ Error al eliminar: ' + error.message, 'error');
    }
};

// ===== EXPANDIR LISTA =====
window.expandirLista = function(key) {
    const items = configuracionData[key] || [];
    const config = LISTAS_CONFIG[key];
    const label = config?.label || key;
    const color = config?.color || '#3b82f6';
    
    if (items.length === 0) {
        mostrarToast('⚠️ No hay elementos en esta lista', 'warning');
        return;
    }
    
    const html = `
        <div style="padding:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h4 style="margin:0;">${label}</h4>
                <span class="badge badge-outline">${items.length} elementos</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;">
                ${items.map(item => `
                    <div style="display:flex;align-items:center;gap:8px;background:${color}10;padding:8px 12px;border-radius:var(--radius-sm);border:1px solid ${color}20;">
                        <span style="font-size:0.85rem;">${item.nombre}</span>
                    </div>
                `).join('')}
            </div>
            ${config?.description ? `<p style="margin-top:12px;font-size:0.8rem;color:var(--text-secondary);">${config.description}</p>` : ''}
        </div>
    `;
    
    mostrarModal(`📋 ${label}`, html, {
        confirmText: 'Cerrar',
        showConfirm: true,
        showCancel: false
    });
};

// ===== RESTAURAR LISTA =====
window.restaurarLista = async function(key) {
    if (currentUser?.rol !== 'admin' && currentUser?.email !== 'vinicio@geomira.se') {
        mostrarToast('⛔ No autorizado', 'error');
        return;
    }
    
    const config = LISTAS_CONFIG[key];
    const label = config?.label || key;
    const itemsActuales = configuracionData[key] || [];
    
    if (!config?.defaultItems) {
        mostrarToast('⚠️ No hay valores predeterminados para esta lista', 'warning');
        return;
    }
    
    const confirmar = confirm(
        `¿Restaurar "${label}" a valores predeterminados?\n\n` +
        `Actuales: ${itemsActuales.length} elementos\n` +
        `Predeterminados: ${config.defaultItems.length} elementos\n\n` +
        `Los cambios actuales se perderán.`
    );
    
    if (!confirmar) return;
    
    try {
        const nuevosItems = config.defaultItems.map((nombre, index) => ({
            id: `${key}_${Date.now()}_${index + 1}`,
            nombre: nombre,
            createdAt: Date.now(),
            createdBy: currentUser?.uid || 'system',
            updatedAt: Date.now()
        }));
        await db.ref(`configuraciones/${key}`).set(nuevosItems);
        mostrarToast(`✅ ${label} restaurada a valores predeterminados`, 'success');
        guardarHistorial('restaurar_lista', `Restaurada lista ${label}`, { key });
    } catch (error) {
        console.error('[configuracion.js] Error:', error);
        mostrarToast('❌ Error al restaurar: ' + error.message, 'error');
    }
};

// ===== EXPORTAR CONFIGURACIÓN =====
window.exportarConfiguracion = function() {
    if (Object.keys(configuracionData).length === 0) {
        mostrarToast('No hay datos para exportar', 'warning');
        return;
    }
    
    const exportData = {
        version: '3.2',
        fecha: new Date().toISOString(),
        exportadoPor: currentUser?.email || 'sistema',
        configuracion: configuracionData
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `configuracion_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('✅ Configuración exportada correctamente', 'success');
};

// ===== IMPORTAR CONFIGURACIÓN =====
window.importarConfiguracion = function() {
    if (currentUser?.rol !== 'admin' && currentUser?.email !== 'vinicio@geomira.se') {
        mostrarToast('⛔ No autorizado', 'error');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            const configData = data.configuracion || data;
            const keys = Object.keys(LISTAS_CONFIG);
            const hasValidKeys = keys.some(k => configData[k] !== undefined);
            
            if (!hasValidKeys) {
                mostrarToast('❌ Archivo inválido. No contiene configuraciones válidas.', 'error');
                return;
            }
            
            const totalItems = Object.values(configData).reduce((sum, list) => sum + (list ? list.length : 0), 0);
            
            const confirmar = confirm(
                `¿Importar configuración?\n\n` +
                `Versión: ${data.version || 'desconocida'}\n` +
                `Exportado: ${data.fecha ? new Date(data.fecha).toLocaleString('es-ES') : 'desconocido'}\n` +
                `Total elementos: ${totalItems}\n\n` +
                `Los cambios actuales se perderán.`
            );
            
            if (!confirmar) return;
            
            for (const [key, values] of Object.entries(configData)) {
                if (LISTAS_CONFIG[key]) {
                    await db.ref(`configuraciones/${key}`).set(values);
                }
            }
            
            mostrarToast('✅ Configuración importada correctamente', 'success');
            guardarHistorial('importar_configuracion', `Configuración importada (${totalItems} elementos)`, { totalItems });
        } catch (error) {
            console.error('[configuracion.js] Error:', error);
            mostrarToast('❌ Error al importar: ' + error.message, 'error');
        }
    };
    input.click();
};

// ===== VER HISTORIAL =====
window.verHistorialConfiguracion = function() {
    if (configuracionHistorial.length === 0) {
        mostrarToast('⚠️ No hay cambios registrados', 'warning');
        return;
    }
    
    const html = `
        <div style="padding:10px;max-height:500px;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h4 style="margin:0;">Historial de Cambios</h4>
                <span class="badge badge-outline">${configuracionHistorial.length} registros</span>
            </div>
            ${configuracionHistorial.map(entry => `
                <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color);">
                    <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;font-size:0.9rem;">
                        <i class="fas ${entry.tipo === 'agregar_item' ? 'fa-plus-circle' : entry.tipo === 'eliminar_item' ? 'fa-minus-circle' : entry.tipo === 'restaurar_lista' ? 'fa-undo' : 'fa-edit'}" 
                            style="color:${entry.tipo === 'agregar_item' ? 'var(--color-success)' : entry.tipo === 'eliminar_item' ? 'var(--color-danger)' : 'var(--color-warning)'};"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.9rem;font-weight:500;">${entry.descripcion}</div>
                        <div style="font-size:0.75rem;color:var(--text-secondary);">
                            ${entry.usuarioNombre} • ${new Date(entry.fecha).toLocaleString('es-ES')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    mostrarModal('📜 Historial de Cambios', html, {
        confirmText: 'Cerrar',
        showConfirm: true,
        showCancel: false
    });
};

// ===== RESETEAR CONFIGURACIÓN =====
window.resetearConfiguracion = async function() {
    if (currentUser?.rol !== 'admin' && currentUser?.email !== 'vinicio@geomira.se') {
        mostrarToast('⛔ No autorizado', 'error');
        return;
    }
    
    const totalItems = Object.values(configuracionData).reduce((sum, list) => sum + (list ? list.length : 0), 0);
    
    const confirmar = confirm(
        `⚠️ ¿Resetear toda la configuración?\n\n` +
        `Se eliminarán todas las listas y se crearán con valores por defecto.\n\n` +
        `Elementos a eliminar: ${totalItems}\n` +
        `Listas afectadas: ${Object.keys(configuracionData).length}\n\n` +
        `⚠️ Esta acción no se puede deshacer.`
    );
    
    if (!confirmar) return;
    
    try {
        const defaultData = await crearConfiguracionesPorDefecto();
        await db.ref('configuraciones').set(defaultData);
        mostrarToast('✅ Configuración reseteada correctamente', 'success');
        guardarHistorial('resetear_configuracion', `Configuración reseteada completamente (${totalItems} elementos)`, { totalItems });
    } catch (error) {
        console.error('[configuracion.js] Error:', error);
        mostrarToast('❌ Error al resetear: ' + error.message, 'error');
    }
};

// ===== EXPOSICIÓN GLOBAL =====
window.cargarConfiguracion = cargarConfiguracion;
window.agregarItemConfig = window.agregarItemConfig;
window.eliminarItemConfig = window.eliminarItemConfig;
window.expandirLista = window.expandirLista;
window.restaurarLista = window.restaurarLista;
window.exportarConfiguracion = window.exportarConfiguracion;
window.importarConfiguracion = window.importarConfiguracion;
window.resetearConfiguracion = window.resetearConfiguracion;
window.verHistorialConfiguracion = window.verHistorialConfiguracion;
window.filtrarConfiguracion = filtrarConfiguracion;

console.log('[configuracion.js] Módulo avanzado cargado correctamente');