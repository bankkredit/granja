/**
 * animales.js - CRUD y gestión de animales
 * Versión completa con carga de datos, validaciones y sincronización
 */

// ===== VARIABLES LOCALES =====
let animalesCache = {};
let listenerAnimales = null;
let formularioAbierto = false;
let modoEdicion = false;
let animalEnEdicion = null;

// ===== CONSTANTES =====
const ESTADOS_ANIMAL = {
    ACTIVO: 'activo',
    INACTIVO: 'inactivo',
    VENDIDO: 'vendido',
    MUERTO: 'muerto'
};

const ESTADOS_REPRODUCTIVOS = [
    'Gestante',
    'Lactante',
    'Activo',
    'Descanso',
    'Seco',
    'En celo'
];

// ===== OBTENER ANIMALES =====
function obtenerAnimales(callback) {
    if (listenerAnimales) return;
    listenerAnimales = db.ref('animales').on('value', snapshot => {
        animalesCache = snapshot.val() || {};
        if (callback) callback(animalesCache);
        if (currentView === 'animales') renderizarListaAnimales();
    }, error => {
        console.error('Error en listener de animales:', error);
        mostrarToast('Error al cargar animales: ' + error.message, 'error');
    });
}

// ===== RENDERIZAR LISTA =====
function renderizarListaAnimales(filtro = '') {
    const container = document.getElementById('animalesContent');
    if (!container) return;

    let lista = Object.values(animalesCache).filter(a => a.status !== 'inactivo');
    
    if (filtro) {
        const f = filtro.toLowerCase();
        lista = lista.filter(a =>
            (a.numero && a.numero.toLowerCase().includes(f)) ||
            (a.nombre && a.nombre.toLowerCase().includes(f)) ||
            (a.raza && a.raza.toLowerCase().includes(f)) ||
            (a.corral && a.corral.toLowerCase().includes(f)) ||
            (a.categoria && a.categoria.toLowerCase().includes(f)) ||
            (a.color && a.color.toLowerCase().includes(f))
        );
    }

    lista.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const totalActivos = lista.filter(a => a.status === 'activo').length;
    const totalHembras = lista.filter(a => a.sexo === 'Hembra').length;
    const totalMachos = lista.filter(a => a.sexo === 'Macho').length;
    const totalGestantes = lista.filter(a => a.estadoReproductivo === 'Gestante').length;

    const html = `
        <div class="card" style="margin-bottom:20px;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;">
                <div style="text-align:center;padding:12px;background:var(--bg-primary);border-radius:8px;">
                    <div style="font-size:1.8rem;font-weight:700;color:var(--color-primary);">${lista.length}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);">Total animales</div>
                </div>
                <div style="text-align:center;padding:12px;background:var(--bg-primary);border-radius:8px;">
                    <div style="font-size:1.8rem;font-weight:700;color:var(--color-success);">${totalActivos}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);">Activos</div>
                </div>
                <div style="text-align:center;padding:12px;background:var(--bg-primary);border-radius:8px;">
                    <div style="font-size:1.8rem;font-weight:700;color:var(--color-info);">${totalHembras}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);">Hembras</div>
                </div>
                <div style="text-align:center;padding:12px;background:var(--bg-primary);border-radius:8px;">
                    <div style="font-size:1.8rem;font-weight:700;color:var(--color-warning);">${totalMachos}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);">Machos</div>
                </div>
                <div style="text-align:center;padding:12px;background:var(--bg-primary);border-radius:8px;">
                    <div style="font-size:1.8rem;font-weight:700;color:var(--color-purple);">${totalGestantes}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);">Gestantes</div>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <span class="card-title">📋 Listado de Animales (${lista.length})</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <input type="text" id="buscarAnimal" placeholder="🔍 Buscar..." style="padding:6px 12px;border-radius:var(--radius);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);min-width:200px;">
                    <button class="btn btn-success" onclick="exportarAnimalesExcel()"><i class="fas fa-file-excel"></i> Excel</button>
                    <button class="btn btn-primary" onclick="abrirFormularioAnimal()"><i class="fas fa-plus"></i> Nuevo Animal</button>
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Categoría</th>
                            <th>Sexo</th>
                            <th>Raza</th>
                            <th>Estado</th>
                            <th>Corral</th>
                            <th>Reproductivo</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lista.length === 0 ? 
                            `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-light);">
                                <i class="fas fa-paw" style="font-size:3rem;display:block;margin-bottom:10px;"></i>
                                No hay animales registrados. ¡Haz clic en "Nuevo Animal" para comenzar!
                            </td></tr>` :
                            lista.map(a => `
                            <tr>
                                <td><strong style="color:var(--color-primary);">${a.numero}</strong></td>
                                <td>${a.nombre || '<span style="color:var(--text-light);">Sin nombre</span>'}</td>
                                <td><span class="badge">${a.categoria || 'N/A'}</span></td>
                                <td>${a.sexo === 'Macho' ? '♂️' : '♀️'} ${a.sexo || 'N/A'}</td>
                                <td>${a.raza || 'N/A'}</td>
                                <td><span class="badge ${a.status === 'activo' ? 'badge-success' : a.status === 'vendido' ? 'badge-warning' : 'badge-danger'}">${a.status || 'activo'}</span></td>
                                <td>${a.corral || 'N/A'}</td>
                                <td><span class="badge badge-purple">${a.estadoReproductivo || 'N/A'}</span></td>
                                <td class="actions">
                                    <button class="btn btn-sm btn-primary" onclick="verDetalleAnimal('${a.id}')" title="Ver detalle"><i class="fas fa-eye"></i></button>
                                    <button class="btn btn-sm btn-secondary" onclick="abrirFormularioAnimal('${a.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                                    <button class="btn btn-sm btn-success" onclick="abrirFormularioEvento('${a.id}')" title="Agregar evento"><i class="fas fa-calendar-plus"></i></button>
                                    ${currentUser?.rol === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="eliminarAnimal('${a.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;

    const searchInput = document.getElementById('buscarAnimal');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                renderizarListaAnimales(e.target.value);
            }, 300);
        });
    }
}

// ===== EXPORTAR A EXCEL =====
function exportarAnimalesExcel() {
    const lista = Object.values(animalesCache).filter(a => a.status !== 'inactivo');
    if (lista.length === 0) {
        mostrarToast('No hay animales para exportar', 'warning');
        return;
    }
    
    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Sexo</th>
            <th>Raza</th>
            <th>Color</th>
            <th>Estado</th>
            <th>Corral</th>
            <th>Lote</th>
            <th>Estado Reproductivo</th>
            <th>Fecha Nacimiento</th>
            <th>Peso Nacimiento</th>
            <th>Madre</th>
            <th>Padre</th>
            <th>Observaciones</th>
        </tr>
    `;
    const tbody = document.createElement('tbody');
    lista.forEach(a => {
        tbody.innerHTML += `
            <tr>
                <td>${a.numero || ''}</td>
                <td>${a.nombre || ''}</td>
                <td>${a.categoria || ''}</td>
                <td>${a.sexo || ''}</td>
                <td>${a.raza || ''}</td>
                <td>${a.color || ''}</td>
                <td>${a.status || 'activo'}</td>
                <td>${a.corral || ''}</td>
                <td>${a.lote || ''}</td>
                <td>${a.estadoReproductivo || ''}</td>
                <td>${a.nacimiento || ''}</td>
                <td>${a.pesoNacimiento || ''}</td>
                <td>${a.madre || ''}</td>
                <td>${a.padre || ''}</td>
                <td>${a.observaciones || ''}</td>
            </tr>
        `;
    });
    tabla.appendChild(thead);
    tabla.appendChild(tbody);
    
    exportarExcel(tabla, 'Animales_Granja');
}

// ===== CARGAR ANIMALES =====
function cargarAnimales() {
    console.log('[animales.js] Cargando animales...');
    if (!listenerAnimales) {
        obtenerAnimales(() => renderizarListaAnimales());
    } else {
        renderizarListaAnimales();
    }
}

// ===== VER DETALLE =====
async function verDetalleAnimal(id) {
    const animal = animalesCache[id];
    if (!animal) {
        mostrarToast('Animal no encontrado', 'error');
        return;
    }
    
    try {
        const eventosSnap = await db.ref('eventos').orderByChild('animalId').equalTo(id).once('value');
        const eventos = eventosSnap.val() || {};
        const listaEventos = Object.values(eventos).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const edad = calcularEdad(animal.nacimiento);

        let pesoActual = animal.pesoActual || 'N/A';
        const ultimoPesaje = listaEventos.filter(e => e.tipoEvento === 'pesaje').pop();
        if (ultimoPesaje && ultimoPesaje.datos && ultimoPesaje.datos.peso) {
            pesoActual = ultimoPesaje.datos.peso + ' kg';
        }

        let html = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div style="background:var(--bg-primary);border-radius:8px;padding:16px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        ${animal.fotoPrincipal ? 
                            `<img src="${animal.fotoPrincipal}" style="max-width:200px;max-height:200px;border-radius:50%;object-fit:cover;border:3px solid var(--color-primary);">` : 
                            `<div style="width:200px;height:200px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:4rem;color:var(--text-light);">🐖</div>`
                        }
                        <h3 style="margin-top:8px;">${animal.nombre || 'Sin nombre'}</h3>
                        <span class="badge ${animal.status === 'activo' ? 'badge-success' : 'badge-danger'}">${animal.status || 'activo'}</span>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.9rem;">
                        <div><strong>ID:</strong> ${animal.numero}</div>
                        <div><strong>Edad:</strong> ${edad}</div>
                        <div><strong>Sexo:</strong> ${animal.sexo || 'N/A'}</div>
                        <div><strong>Peso:</strong> ${pesoActual}</div>
                        <div><strong>Categoría:</strong> ${animal.categoria || 'N/A'}</div>
                        <div><strong>Raza:</strong> ${animal.raza || 'N/A'}</div>
                        <div><strong>Color:</strong> ${animal.color || 'N/A'}</div>
                        <div><strong>Corral:</strong> ${animal.corral || 'N/A'}</div>
                        <div><strong>Lote:</strong> ${animal.lote || 'N/A'}</div>
                        <div><strong>Reproductivo:</strong> ${animal.estadoReproductivo || 'N/A'}</div>
                        <div><strong>Madre:</strong> ${animal.madre || 'N/A'}</div>
                        <div><strong>Padre:</strong> ${animal.padre || 'N/A'}</div>
                        <div style="grid-column:span 2;"><strong>Origen:</strong> ${animal.origen || 'N/A'}</div>
                        <div style="grid-column:span 2;"><strong>Proveedor:</strong> ${animal.proveedor || 'N/A'}</div>
                        <div style="grid-column:span 2;"><strong>Observaciones:</strong> ${animal.observaciones || 'Ninguna'}</div>
                    </div>
                </div>
                
                <div style="background:var(--bg-primary);border-radius:8px;padding:16px;">
                    <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-history"></i> Línea de tiempo (${listaEventos.length})
                    </h4>
                    <div style="max-height:500px;overflow-y:auto;padding-right:8px;">
                        ${listaEventos.length === 0 ? 
                            '<p style="color:var(--text-light);text-align:center;padding:20px;">No hay eventos registrados.</p>' :
                            listaEventos.map(e => `
                                <div style="border-left:3px solid ${e.tipoEvento === 'nacimiento' ? 'var(--color-success)' : e.tipoEvento === 'vacuna' ? 'var(--color-info)' : e.tipoEvento === 'pesaje' ? 'var(--color-warning)' : 'var(--color-primary)'};padding-left:12px;margin-bottom:12px;background:var(--bg-secondary);border-radius:4px;padding:8px 12px;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;">
                                        <strong>${formatearFecha(e.fecha || e.createdAt)}</strong>
                                        <span class="badge" style="background:${e.tipoEvento === 'nacimiento' ? 'var(--color-success)' : e.tipoEvento === 'vacuna' ? 'var(--color-info)' : e.tipoEvento === 'pesaje' ? 'var(--color-warning)' : 'var(--color-primary)'};">${e.tipoEvento}</span>
                                    </div>
                                    <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">
                                        ${Object.entries(e.datos || {}).filter(([k,v]) => v).map(([k,v]) => `<span style="background:var(--bg-primary);padding:2px 8px;border-radius:4px;margin-right:4px;display:inline-block;margin-bottom:4px;">${k}: <strong>${v}</strong></span>`).join(' ') || '<span style="color:var(--text-light);">Sin detalles</span>'}
                                    </div>
                                    ${e.createdByEmail ? `<div style="font-size:0.7rem;color:var(--text-light);margin-top:4px;">Registrado por: ${e.createdByEmail}</div>` : ''}
                                </div>
                            `).join('')
                        }
                    </div>
                    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="btn btn-primary" onclick="abrirFormularioEvento('${id}')"><i class="fas fa-plus"></i> Agregar evento</button>
                        <button class="btn btn-secondary" onclick="generarQrAnimal('${id}')"><i class="fas fa-qrcode"></i> QR</button>
                        ${currentUser?.rol === 'admin' ? `<button class="btn btn-danger" onclick="eliminarAnimal('${id}')"><i class="fas fa-trash"></i> Eliminar</button>` : ''}
                    </div>
                </div>
            </div>
        `;
        await mostrarModal(`🐖 Detalle de ${animal.nombre || animal.numero}`, html, { 
            confirmText: 'Cerrar', 
            showConfirm: true, 
            showCancel: false 
        });
    } catch (error) {
        console.error('[animales.js] Error al cargar detalle:', error);
        mostrarToast('Error al cargar el detalle: ' + error.message, 'error');
    }
}

// ===== GENERAR QR =====
function generarQrAnimal(id) {
    const animal = animalesCache[id];
    if (!animal) {
        mostrarToast('Animal no encontrado', 'error');
        return;
    }
    
    const data = {
        id: animal.numero,
        nombre: animal.nombre || 'Sin nombre',
        raza: animal.raza || '',
        sexo: animal.sexo || '',
        categoria: animal.categoria || ''
    };
    
    const texto = JSON.stringify(data);
    const html = `
        <div style="text-align:center;padding:20px;">
            <div id="qrContainer" style="display:flex;justify-content:center;margin-bottom:16px;"></div>
            <p><strong>${animal.numero}</strong> - ${animal.nombre || 'Sin nombre'}</p>
            <p style="font-size:0.8rem;color:var(--text-secondary);">Escanea para ver información del animal</p>
            <button class="btn btn-primary" onclick="descargarQR()"><i class="fas fa-download"></i> Descargar QR</button>
        </div>
    `;
    
    mostrarModal('📱 Código QR', html, { 
        confirmText: 'Cerrar', 
        showConfirm: true, 
        showCancel: false 
    });
    
    setTimeout(() => {
        generarQR(texto, 'qrContainer');
    }, 100);
}

function descargarQR() {
    const canvas = document.querySelector('#qrContainer canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = 'qr_animal.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        mostrarToast('✅ QR descargado', 'success');
    } else {
        mostrarToast('Error al descargar QR', 'error');
    }
}

// ===== ABRIR FORMULARIO =====
async function abrirFormularioAnimal(id = null) {
    if (formularioAbierto) {
        mostrarToast('⚠️ Ya hay un formulario abierto', 'warning');
        return;
    }

    try {
        // Cargar configuraciones
        if (!configuraciones || Object.keys(configuraciones).length === 0) {
            await cargarConfiguraciones();
            if (!configuraciones || Object.keys(configuraciones).length === 0) {
                await crearConfiguracionesPorDefecto();
                const snap = await db.ref('configuraciones').once('value');
                configuraciones = snap.val() || {};
            }
        }

        // Obtener animal si es edición
        const animal = id ? animalesCache[id] : null;
        modoEdicion = !!animal;
        animalEnEdicion = animal;
        const titulo = modoEdicion ? '✏️ Editar Animal' : '➕ Nuevo Animal';

        // Preparar datos para el formulario
        const cats = configuraciones.categorias || [];
        const razas = configuraciones.razas || [];
        const colores = configuraciones.colores || [];
        const corrales = configuraciones.corrales || [];

        // Función para generar opciones de select
        const selectOptions = (list, selected) => {
            if (!list || list.length === 0) {
                return '<option value="">No hay opciones disponibles</option>';
            }
            return list.map(item =>
                `<option value="${item.nombre}" ${item.nombre === selected ? 'selected' : ''}>${item.nombre}</option>`
            ).join('');
        };

        // Preparar valores
        const nombreValue = animal?.nombre || '';
        const sexoValue = animal?.sexo || '';
        const categoriaValue = animal?.categoria || '';
        const razaValue = animal?.raza || '';
        const colorValue = animal?.color || '';
        const corralValue = animal?.corral || '';
        const fechaValue = animal?.nacimiento ? formatearFechaInput(animal.nacimiento) : '';
        const pesoNacValue = animal?.pesoNacimiento || '';
        const origenValue = animal?.origen || '';
        const proveedorValue = animal?.proveedor || '';
        const madreValue = animal?.madre || '';
        const padreValue = animal?.padre || '';
        const loteValue = animal?.lote || '';
        const estadoReproValue = animal?.estadoReproductivo || '';
        const observacionesValue = animal?.observaciones || '';
        const fotoPrincipal = animal?.fotoPrincipal || '';

        const html = `
            <form id="formAnimal" novalidate>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div class="form-group">
                        <label>Nombre <span style="color:var(--color-danger);">*</span></label>
                        <input type="text" id="aNombre" value="${nombreValue}" placeholder="Ej: Luna, Rayo" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Sexo <span style="color:var(--color-danger);">*</span></label>
                        <select id="aSexo" class="form-control">
                            <option value="">Seleccionar</option>
                            <option value="Macho" ${sexoValue === 'Macho' ? 'selected' : ''}>♂️ Macho</option>
                            <option value="Hembra" ${sexoValue === 'Hembra' ? 'selected' : ''}>♀️ Hembra</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Categoría <span style="color:var(--color-danger);">*</span></label>
                        <select id="aCategoria" class="form-control">
                            <option value="">Seleccionar</option>
                            ${selectOptions(cats, categoriaValue)}
                        </select>
                        ${currentUser?.rol === 'admin' ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();" style="color:var(--color-primary);">➕ Gestionar categorías</a></small>` : ''}
                    </div>
                    <div class="form-group">
                        <label>Raza <span style="color:var(--color-danger);">*</span></label>
                        <select id="aRaza" class="form-control">
                            <option value="">Seleccionar</option>
                            ${selectOptions(razas, razaValue)}
                        </select>
                        ${currentUser?.rol === 'admin' ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();" style="color:var(--color-primary);">➕ Gestionar razas</a></small>` : ''}
                    </div>
                    <div class="form-group">
                        <label>Color <span style="color:var(--color-danger);">*</span></label>
                        <select id="aColor" class="form-control">
                            <option value="">Seleccionar</option>
                            ${selectOptions(colores, colorValue)}
                        </select>
                        ${currentUser?.rol === 'admin' ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();" style="color:var(--color-primary);">➕ Gestionar colores</a></small>` : ''}
                    </div>
                    <div class="form-group">
                        <label>Corral <span style="color:var(--color-danger);">*</span></label>
                        <select id="aCorral" class="form-control">
                            <option value="">Seleccionar</option>
                            ${selectOptions(corrales, corralValue)}
                        </select>
                        ${currentUser?.rol === 'admin' ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();" style="color:var(--color-primary);">➕ Gestionar corrales</a></small>` : ''}
                    </div>
                    <div class="form-group">
                        <label>Fecha de nacimiento <span style="color:var(--color-danger);">*</span></label>
                        <input type="date" id="aNacimiento" value="${fechaValue}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Peso al nacer (kg)</label>
                        <input type="number" step="0.1" id="aPesoNac" value="${pesoNacValue}" placeholder="0.0" min="0" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Origen</label>
                        <input type="text" id="aOrigen" value="${origenValue}" placeholder="Propia, Externa" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Proveedor</label>
                        <input type="text" id="aProveedor" value="${proveedorValue}" placeholder="Nombre del proveedor" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Madre (ID)</label>
                        <input type="text" id="aMadre" value="${madreValue}" placeholder="Ej: CER000001" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Padre (ID)</label>
                        <input type="text" id="aPadre" value="${padreValue}" placeholder="Ej: CER000002" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Lote</label>
                        <input type="text" id="aLote" value="${loteValue}" placeholder="Ej: Lote A" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Estado reproductivo</label>
                        <select id="aEstadoRepro" class="form-control">
                            <option value="">Seleccionar</option>
                            ${ESTADOS_REPRODUCTIVOS.map(e => `<option value="${e}" ${estadoReproValue === e ? 'selected' : ''}>${e}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea id="aObservaciones" placeholder="Información adicional..." rows="3" class="form-control">${observacionesValue}</textarea>
                </div>
                <div class="form-group">
                    <label>Foto principal</label>
                    <input type="file" id="aFoto" accept="image/*" class="form-control">
                    ${fotoPrincipal ? `<div style="margin-top:8px;"><img src="${fotoPrincipal}" style="max-width:100px;max-height:100px;border-radius:8px;object-fit:cover;"></div>` : ''}
                </div>
                <div id="formMessage" style="margin-top:12px;display:none;"></div>
                <div style="color:var(--text-light);font-size:0.8rem;margin-top:8px;">
                    <i class="fas fa-info-circle"></i> Los campos con <span style="color:var(--color-danger);">*</span> son obligatorios
                </div>
            </form>
        `;

        formularioAbierto = true;
        
        await mostrarModal(titulo, html, {
            confirmText: modoEdicion ? '💾 Actualizar' : '💾 Crear',
            cancelText: '❌ Cancelar',
            showConfirm: true,
            showCancel: true,
            onConfirm: async function() {
                await guardarAnimalDesdeFormulario();
            }
        });
        
        formularioAbierto = false;
    } catch (error) {
        console.error('[animales.js] Error al abrir formulario:', error);
        mostrarToast('❌ Error al preparar el formulario: ' + error.message, 'error');
        formularioAbierto = false;
    }
}

// ===== GUARDAR ANIMAL DESDE FORMULARIO =====
async function guardarAnimalDesdeFormulario() {
    console.log('[animales.js] guardarAnimalDesdeFormulario() iniciado');
    
    try {
        // Recoger datos del formulario
        const datos = {
            nombre: document.getElementById('aNombre')?.value?.trim() || '',
            sexo: document.getElementById('aSexo')?.value || '',
            categoria: document.getElementById('aCategoria')?.value || '',
            raza: document.getElementById('aRaza')?.value || '',
            color: document.getElementById('aColor')?.value || '',
            corral: document.getElementById('aCorral')?.value || '',
            nacimiento: document.getElementById('aNacimiento')?.value || '',
            pesoNacimiento: parseFloat(document.getElementById('aPesoNac')?.value) || 0,
            origen: document.getElementById('aOrigen')?.value?.trim() || '',
            proveedor: document.getElementById('aProveedor')?.value?.trim() || '',
            madre: document.getElementById('aMadre')?.value?.trim() || '',
            padre: document.getElementById('aPadre')?.value?.trim() || '',
            lote: document.getElementById('aLote')?.value?.trim() || '',
            estadoReproductivo: document.getElementById('aEstadoRepro')?.value || '',
            observaciones: document.getElementById('aObservaciones')?.value?.trim() || ''
        };

        // Validaciones
        const errors = [];
        if (!datos.sexo) errors.push('Selecciona un sexo');
        if (!datos.categoria) errors.push('Selecciona una categoría');
        if (!datos.raza) errors.push('Selecciona una raza');
        if (!datos.color) errors.push('Selecciona un color');
        if (!datos.corral) errors.push('Selecciona un corral');
        if (!datos.nacimiento) errors.push('Ingresa una fecha de nacimiento');
        if (datos.nacimiento && new Date(datos.nacimiento) > new Date()) {
            errors.push('La fecha de nacimiento no puede ser futura');
        }
        if (datos.pesoNacimiento < 0) errors.push('El peso no puede ser negativo');

        if (errors.length > 0) {
            const msgDiv = document.getElementById('formMessage');
            if (msgDiv) {
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:12px;border-radius:8px;">
                    <i class="fas fa-exclamation-circle"></i> ${errors.join('. ')}
                </div>`;
                setTimeout(() => {
                    msgDiv.style.display = 'none';
                }, 5000);
            }
            mostrarToast('❌ ' + errors.join('. '), 'error');
            return false;
        }

        // Subir foto si se seleccionó
        const fileInput = document.getElementById('aFoto');
        let fotoUrl = animalEnEdicion?.fotoPrincipal || '';
        if (fileInput && fileInput.files.length > 0) {
            try {
                mostrarToast('📤 Subiendo foto...', 'info');
                const result = await subirImagenCloudinary(fileInput.files[0], 'animales');
                fotoUrl = result.url;
                mostrarToast('✅ Foto subida correctamente', 'success');
            } catch (error) {
                mostrarToast('⚠️ No se pudo subir la foto. El animal se guardará sin imagen.', 'warning');
            }
        }

        // Guardar datos
        if (modoEdicion && animalEnEdicion) {
            await db.ref(`animales/${animalEnEdicion.id}`).update({
                ...datos,
                fotoPrincipal: fotoUrl,
                updatedAt: Date.now(),
                updatedBy: currentUser?.uid || '',
                updatedByEmail: currentUser?.email || ''
            });
            mostrarToast(`✅ Animal ${animalEnEdicion.numero} actualizado exitosamente`, 'success');
            console.log('[animales.js] Animal actualizado:', animalEnEdicion.id);
        } else {
            const nuevoId = await generarId('CER');
            const ref = db.ref('animales').push();
            await ref.set({
                id: nuevoId,
                numero: nuevoId,
                ...datos,
                fotoPrincipal: fotoUrl,
                status: 'activo',
                createdAt: Date.now(),
                createdBy: currentUser?.uid || '',
                createdByEmail: currentUser?.email || '',
                updatedAt: Date.now(),
                updatedBy: currentUser?.uid || '',
                updatedByEmail: currentUser?.email || ''
            });
            
            await db.ref('eventos').push({
                animalId: ref.key,
                tipoEvento: 'nacimiento',
                fecha: datos.nacimiento,
                datos: { 
                    pesoNacimiento: datos.pesoNacimiento,
                    raza: datos.raza,
                    categoria: datos.categoria
                },
                createdAt: Date.now(),
                createdBy: currentUser?.uid || '',
                createdByEmail: currentUser?.email || '',
                updatedAt: Date.now(),
                updatedBy: currentUser?.uid || '',
                status: 'activo'
            });
            mostrarToast(`✅ Animal ${nuevoId} creado exitosamente`, 'success');
            console.log('[animales.js] Animal creado:', nuevoId);
        }
        
        renderizarListaAnimales();
        return true;
        
    } catch (error) {
        console.error('[animales.js] Error al guardar:', error);
        mostrarToast('❌ Error al guardar: ' + error.message, 'error');
        return false;
    }
}

// ===== ELIMINAR ANIMAL =====
async function eliminarAnimal(id) {
    if (currentUser?.rol !== 'admin') {
        mostrarToast('⛔ No autorizado. Solo administradores.', 'error');
        return;
    }
    
    const animal = animalesCache[id];
    if (!animal) {
        mostrarToast('Animal no encontrado', 'error');
        return;
    }

    const html = `
        <div style="text-align:center;padding:20px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:12px;"></i>
            <p style="font-size:1.1rem;font-weight:500;">¿Estás seguro de eliminar este animal?</p>
            <div style="background:var(--bg-primary);border-radius:8px;padding:16px;margin:16px 0;text-align:left;">
                <p><strong>ID:</strong> ${animal.numero}</p>
                <p><strong>Nombre:</strong> ${animal.nombre || 'Sin nombre'}</p>
                <p><strong>Categoría:</strong> ${animal.categoria || 'N/A'}</p>
                <p><strong>Sexo:</strong> ${animal.sexo || 'N/A'}</p>
                <p><strong>Corral:</strong> ${animal.corral || 'N/A'}</p>
            </div>
            <p style="color:var(--text-danger);font-size:0.9rem;">⚠️ Esta acción no se puede deshacer. El animal será marcado como inactivo.</p>
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
        await db.ref(`animales/${id}`).update({ 
            status: 'inactivo',
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            updatedByEmail: currentUser?.email || ''
        });
        
        await db.ref('eventos').push({
            animalId: id,
            tipoEvento: 'eliminacion',
            fecha: new Date().toISOString().split('T')[0],
            datos: { 
                motivo: 'Eliminado por administrador',
                eliminadoPor: currentUser?.email || currentUser?.uid
            },
            createdAt: Date.now(),
            createdBy: currentUser?.uid || '',
            createdByEmail: currentUser?.email || '',
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            status: 'activo'
        });
        
        mostrarToast(`✅ Animal ${animal.numero} eliminado correctamente`, 'success');
        renderizarListaAnimales();
    } catch (error) {
        console.error('[animales.js] Error al eliminar:', error);
        mostrarToast('❌ Error al eliminar: ' + error.message, 'error');
    }
}

// ===== EXPOSICIÓN GLOBAL =====
window.cargarAnimales = cargarAnimales;
window.obtenerAnimales = obtenerAnimales;
window.renderizarListaAnimales = renderizarListaAnimales;
window.verDetalleAnimal = verDetalleAnimal;
window.abrirFormularioAnimal = abrirFormularioAnimal;
window.eliminarAnimal = eliminarAnimal;
window.exportarAnimalesExcel = exportarAnimalesExcel;
window.generarQrAnimal = generarQrAnimal;
window.descargarQR = descargarQR;

console.log('[animales.js] Módulo cargado correctamente');