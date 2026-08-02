/**
 * animales.js - CRUD y gestión de animales
 * Versión completa con validaciones robustas, precarga de datos y selección de padres
 */

let animalesCache = {};
let listenerAnimales = null;
let formularioAbierto = false;
let modoEdicion = false;
let animalEnEdicion = null;
let animalIdEnEdicion = null;

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

const VALORES_POR_DEFECTO = {
    sexo: 'Hembra',
    categoria: '',
    raza: '',
    color: '',
    corral: '',
    nacimiento: new Date().toISOString().split('T')[0],
    pesoNacimiento: 1.2,
    origen: 'Propia',
    proveedor: '',
    madre: '',
    padre: '',
    lote: '',
    estadoReproductivo: 'Activo',
    observaciones: ''
};

function esAdmin() {
    return currentUser?.rol === 'admin' || currentUser?.email === 'vinicio@geomira.se';
}

function obtenerAnimalPorId(id) {
    if (!id) return null;
    if (animalesCache[id]) return animalesCache[id];
    const animal = Object.values(animalesCache).find(a => a.numero === id || a.id === id);
    return animal || null;
}

function obtenerFirebaseKey(id) {
    if (!id) return null;
    if (animalesCache[id]) return id;
    const entries = Object.entries(animalesCache);
    for (const [key, value] of entries) {
        if (value.numero === id || value.id === id) {
            return key;
        }
    }
    return null;
}

function obtenerListaAnimalesParaSelect(exceptoId = null) {
    const lista = Object.values(animalesCache).filter(a =>
        a.status === 'activo' &&
        a.id !== exceptoId &&
        a.sexo
    );
    lista.sort((a, b) => a.numero.localeCompare(b.numero));
    return lista;
}

function generarOpcionesPadres(lista, selected = '', sexo = null) {
    if (!lista || lista.length === 0) {
        return '<option value="">No hay animales disponibles</option>';
    }
    let options = '<option value="">Seleccionar</option>';
    let filtrados = lista;
    if (sexo === 'Macho') filtrados = lista.filter(a => a.sexo === 'Macho');
    else if (sexo === 'Hembra') filtrados = lista.filter(a => a.sexo === 'Hembra');
    filtrados.forEach(animal => {
        const selectedAttr = animal.id === selected ? 'selected' : '';
        const nombre = animal.nombre ? ` - ${animal.nombre}` : '';
        options += `<option value="${animal.id}" ${selectedAttr}>${animal.numero}${nombre}</option>`;
    });
    return options;
}

function generarOpciones(lista, valorSeleccionado, textoVacio = 'Seleccionar') {
    if (!lista || lista.length === 0) {
        return `<option value="">No hay opciones disponibles</option>`;
    }
    let options = `<option value="">${textoVacio}</option>`;
    lista.forEach(item => {
        const selected = item.nombre === valorSeleccionado ? 'selected' : '';
        options += `<option value="${item.nombre}" ${selected}>${item.nombre}</option>`;
    });
    return options;
}

function obtenerAnimales(callback) {
    if (listenerAnimales) {
        console.log('[animales.js] Listener ya existe');
        return;
    }
    console.log('[animales.js] Iniciando listener de animales...');
    listenerAnimales = db.ref('animales').on('value', snapshot => {
        animalesCache = snapshot.val() || {};
        console.log('[animales.js] Animales cargados:', Object.keys(animalesCache).length);
        if (callback) callback(animalesCache);
        if (currentView === 'animales') renderizarListaAnimales();
    }, error => {
        console.error('Error en listener de animales:', error);
        mostrarToast('Error al cargar animales: ' + error.message, 'error');
    });
}

function cargarAnimales() {
    console.log('[animales.js] Cargando animales...');
    if (!listenerAnimales) {
        obtenerAnimales(() => renderizarListaAnimales());
    } else {
        renderizarListaAnimales();
    }
}

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
    const isAdmin = esAdmin();

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
                                    ${isAdmin ? `<button class="btn btn-sm btn-danger" onclick="eliminarAnimal('${a.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
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

async function verDetalleAnimal(id) {
    console.log('[animales.js] Ver detalle - ID recibido:', id);
    let animal = obtenerAnimalPorId(id);
    if (!animal) {
        console.log('[animales.js] Animal no encontrado para ID:', id);
        mostrarToast('Animal no encontrado', 'error');
        return;
    }
    console.log('[animales.js] Animal encontrado:', animal.numero);

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

        const isAdmin = esAdmin();

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
                        <div><strong>Madre:</strong> ${animal.madre ? (animalesCache[animal.madre]?.numero || animal.madre) : 'N/A'}</div>
                        <div><strong>Padre:</strong> ${animal.padre ? (animalesCache[animal.padre]?.numero || animal.padre) : 'N/A'}</div>
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
                        ${isAdmin ? `<button class="btn btn-danger" onclick="eliminarAnimal('${id}')"><i class="fas fa-trash"></i> Eliminar</button>` : ''}
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

function generarQrAnimal(id) {
    let animal = obtenerAnimalPorId(id);
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

async function abrirFormularioAnimal(id = null) {
    if (formularioAbierto) {
        mostrarToast('⚠️ Ya hay un formulario abierto', 'warning');
        return;
    }

    try {
        console.log('[animales.js] Abriendo formulario, id:', id);

        if (!configuraciones || Object.keys(configuraciones).length === 0) {
            console.log('[animales.js] Configuraciones vacías, cargando...');
            await cargarConfiguraciones();
            if (!configuraciones || Object.keys(configuraciones).length === 0) {
                await crearConfiguracionesPorDefecto();
                const snap = await db.ref('configuraciones').once('value');
                configuraciones = snap.val() || {};
                window.configuraciones = configuraciones;
            }
        }

        console.log('[animales.js] Configuraciones cargadas:', Object.keys(configuraciones));

        const cats = configuraciones.categorias || [];
        const razas = configuraciones.razas || [];
        const colores = configuraciones.colores || [];
        const corrales = configuraciones.corrales || [];

        console.log('[animales.js] Categorías:', cats.length, 'Razas:', razas.length, 'Colores:', colores.length, 'Corrales:', corrales.length);

        let animal = null;
        let firebaseKey = null;
        if (id) {
            animal = obtenerAnimalPorId(id);
            if (!animal) {
                mostrarToast('Animal no encontrado', 'error');
                return;
            }
            firebaseKey = obtenerFirebaseKey(id);
            console.log('[animales.js] Animal a editar:', animal.numero, 'Firebase Key:', firebaseKey);
        }

        modoEdicion = !!animal;
        animalEnEdicion = animal;
        animalIdEnEdicion = firebaseKey;
        const titulo = modoEdicion ? '✏️ Editar Animal' : '➕ Nuevo Animal';

        const listaAnimales = obtenerListaAnimalesParaSelect(animal?.id || null);

        const getDefaultValue = (modoEdicion, animal, campo, lista, valorPorDefecto = '') => {
            if (modoEdicion && animal && animal[campo]) return animal[campo];
            if (!modoEdicion && lista && lista.length > 0) return lista[0].nombre;
            return valorPorDefecto;
        };

        const nombreValue = modoEdicion ? (animal?.nombre || '') : '';
        const sexoValue = modoEdicion ? (animal?.sexo || '') : VALORES_POR_DEFECTO.sexo;
        const categoriaValue = getDefaultValue(modoEdicion, animal, 'categoria', cats, VALORES_POR_DEFECTO.categoria);
        const razaValue = getDefaultValue(modoEdicion, animal, 'raza', razas, VALORES_POR_DEFECTO.raza);
        const colorValue = getDefaultValue(modoEdicion, animal, 'color', colores, VALORES_POR_DEFECTO.color);
        const corralValue = getDefaultValue(modoEdicion, animal, 'corral', corrales, VALORES_POR_DEFECTO.corral);
        
        let fechaValue = '';
        if (modoEdicion && animal?.nacimiento) {
            fechaValue = formatearFechaInput(animal.nacimiento);
        } else {
            fechaValue = VALORES_POR_DEFECTO.nacimiento;
        }
        
        const pesoNacValue = modoEdicion ? (animal?.pesoNacimiento || '') : VALORES_POR_DEFECTO.pesoNacimiento;
        const origenValue = modoEdicion ? (animal?.origen || '') : VALORES_POR_DEFECTO.origen;
        const proveedorValue = modoEdicion ? (animal?.proveedor || '') : VALORES_POR_DEFECTO.proveedor;
        const madreId = modoEdicion ? (animal?.madre || '') : '';
        const padreId = modoEdicion ? (animal?.padre || '') : '';
        const loteValue = modoEdicion ? (animal?.lote || '') : VALORES_POR_DEFECTO.lote;
        const estadoReproValue = modoEdicion ? (animal?.estadoReproductivo || '') : VALORES_POR_DEFECTO.estadoReproductivo;
        const observacionesValue = modoEdicion ? (animal?.observaciones || '') : VALORES_POR_DEFECTO.observaciones;
        const fotoPrincipal = modoEdicion ? (animal?.fotoPrincipal || '') : '';

        console.log('[animales.js] Valores precargados:', {
            nombre: nombreValue,
            sexo: sexoValue,
            categoria: categoriaValue,
            raza: razaValue,
            color: colorValue,
            corral: corralValue,
            fecha: fechaValue
        });

        const madreOptions = generarOpcionesPadres(listaAnimales, madreId, 'Hembra');
        const padreOptions = generarOpcionesPadres(listaAnimales, padreId, 'Macho');
        const categoriaOptions = generarOpciones(cats, categoriaValue);
        const razaOptions = generarOpciones(razas, razaValue);
        const colorOptions = generarOpciones(colores, colorValue);
        const corralOptions = generarOpciones(corrales, corralValue);
        const estadoReproOptions = ESTADOS_REPRODUCTIVOS.map(e =>
            `<option value="${e}" ${estadoReproValue === e ? 'selected' : ''}>${e}</option>`
        ).join('');

        const html = `
            <form id="formAnimal" novalidate>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div class="form-group">
                        <label>Nombre <span style="color:var(--color-danger);">*</span></label>
                        <input type="text" id="aNombre" value="${nombreValue}" placeholder="Ej: Luna, Rayo" class="form-control" required>
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Nombre actual: ' + (animal?.nombre || 'Sin nombre') : 'Ingresa un nombre descriptivo'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Sexo <span style="color:var(--color-danger);">*</span></label>
                        <select id="aSexo" class="form-control" required>
                            <option value="">Seleccionar</option>
                            <option value="Macho" ${sexoValue === 'Macho' ? 'selected' : ''}>♂️ Macho</option>
                            <option value="Hembra" ${sexoValue === 'Hembra' ? 'selected' : ''}>♀️ Hembra</option>
                        </select>
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Sexo actual: ' + (animal?.sexo || 'No definido') : 'Selecciona el sexo del animal'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Categoría <span style="color:var(--color-danger);">*</span></label>
                        <select id="aCategoria" class="form-control" required>
                            ${categoriaOptions}
                        </select>
                        ${esAdmin() ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();" style="color:var(--color-primary);">➕ Gestionar categorías</a></small>` : ''}
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Categoría actual: ' + (animal?.categoria || 'No definida') : 'Selecciona la categoría del animal'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Raza <span style="color:var(--color-danger);">*</span></label>
                        <select id="aRaza" class="form-control" required>
                            ${razaOptions}
                        </select>
                        ${esAdmin() ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();" style="color:var(--color-primary);">➕ Gestionar razas</a></small>` : ''}
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Raza actual: ' + (animal?.raza || 'No definida') : 'Selecciona la raza del animal'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Color <span style="color:var(--color-danger);">*</span></label>
                        <select id="aColor" class="form-control" required>
                            ${colorOptions}
                        </select>
                        ${esAdmin() ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();" style="color:var(--color-primary);">➕ Gestionar colores</a></small>` : ''}
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Color actual: ' + (animal?.color || 'No definido') : 'Selecciona el color del animal'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Corral <span style="color:var(--color-danger);">*</span></label>
                        <select id="aCorral" class="form-control" required>
                            ${corralOptions}
                        </select>
                        ${esAdmin() ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();" style="color:var(--color-primary);">➕ Gestionar corrales</a></small>` : ''}
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Corral actual: ' + (animal?.corral || 'No definido') : 'Selecciona el corral del animal'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Fecha de nacimiento <span style="color:var(--color-danger);">*</span></label>
                        <input type="date" id="aNacimiento" value="${fechaValue}" class="form-control" required>
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Fecha actual: ' + formatearFecha(animal?.nacimiento) : 'Fecha de hoy: ' + new Date().toLocaleDateString('es-ES')}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Peso al nacer (kg)</label>
                        <input type="number" step="0.1" id="aPesoNac" value="${pesoNacValue}" placeholder="0.0" min="0" class="form-control">
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Peso registrado: ' + (animal?.pesoNacimiento || 'N/A') + ' kg' : 'Valor recomendado: 1.2 kg'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Origen</label>
                        <input type="text" id="aOrigen" value="${origenValue}" placeholder="Propia, Externa" class="form-control">
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Origen actual: ' + (animal?.origen || 'No definido') : 'Ej: Propia, Externa, Comprada'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Proveedor</label>
                        <input type="text" id="aProveedor" value="${proveedorValue}" placeholder="Nombre del proveedor" class="form-control">
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Proveedor actual: ' + (animal?.proveedor || 'Ninguno') : 'Nombre del proveedor si aplica'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Madre <span style="color:var(--color-primary);">👩</span></label>
                        <select id="aMadre" class="form-control">
                            ${madreOptions}
                        </select>
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion && animal?.madre ? 'Madre actual: ' + (animalesCache[animal.madre]?.numero || animal.madre) : 'Selecciona la madre si se conoce'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Padre <span style="color:var(--color-primary);">👨</span></label>
                        <select id="aPadre" class="form-control">
                            ${padreOptions}
                        </select>
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion && animal?.padre ? 'Padre actual: ' + (animalesCache[animal.padre]?.numero || animal.padre) : 'Selecciona el padre si se conoce'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Lote</label>
                        <input type="text" id="aLote" value="${loteValue}" placeholder="Ej: Lote A" class="form-control">
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Lote actual: ' + (animal?.lote || 'No asignado') : 'Asigna un lote de producción'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Estado reproductivo</label>
                        <select id="aEstadoRepro" class="form-control">
                            <option value="">Seleccionar</option>
                            ${estadoReproOptions}
                        </select>
                        <small style="color:var(--text-light);font-size:0.7rem;">
                            ${modoEdicion ? 'Estado actual: ' + (animal?.estadoReproductivo || 'No definido') : 'Selecciona el estado reproductivo'}
                        </small>
                    </div>
                </div>
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea id="aObservaciones" placeholder="Información adicional sobre el animal..." rows="3" class="form-control">${observacionesValue}</textarea>
                    <small style="color:var(--text-light);font-size:0.7rem;">
                        ${modoEdicion && animal?.observaciones ? 'Observaciones actuales: ' + animal.observaciones : 'Agrega notas o información relevante'}
                    </small>
                </div>
                <div class="form-group">
                    <label>Foto principal</label>
                    <input type="file" id="aFoto" accept="image/*" class="form-control">
                    ${fotoPrincipal ? `<div style="margin-top:8px;"><img src="${fotoPrincipal}" style="max-width:100px;max-height:100px;border-radius:8px;object-fit:cover;border:2px solid var(--color-primary);"></div>` : ''}
                    <small style="color:var(--text-light);font-size:0.7rem;">
                        ${fotoPrincipal ? 'Foto actual. Selecciona una nueva para reemplazarla.' : 'Selecciona una foto para el animal (opcional)'}
                    </small>
                </div>
                <div id="formMessage" style="margin-top:12px;display:none;"></div>
                <div style="color:var(--text-light);font-size:0.8rem;margin-top:8px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-sm);border:1px solid var(--border-color);">
                    <i class="fas fa-info-circle"></i>
                    ${modoEdicion ?
                        'Editando animal <strong>' + animal.numero + '</strong>. Los campos con <span style="color:var(--color-danger);">*</span> son obligatorios.' :
                        'Complete los campos obligatorios (<span style="color:var(--color-danger);">*</span>) para registrar un nuevo animal. Los valores sugeridos están preseleccionados.'}
                </div>
            </form>
        `;

        formularioAbierto = true;

        await mostrarModal(titulo, html, {
            confirmText: modoEdicion ? '💾 Actualizar' : '💾 Crear',
            cancelText: '❌ Cancelar',
            showConfirm: true,
            showCancel: true,
            onConfirm: async function () {
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

async function guardarAnimalDesdeFormulario() {
    console.log('[animales.js] guardarAnimalDesdeFormulario() iniciado');
    console.log('[animales.js] modoEdicion:', modoEdicion, 'animalIdEnEdicion:', animalIdEnEdicion);

    try {
        const aNombre = document.getElementById('aNombre');
        const aSexo = document.getElementById('aSexo');
        const aCategoria = document.getElementById('aCategoria');
        const aRaza = document.getElementById('aRaza');
        const aColor = document.getElementById('aColor');
        const aCorral = document.getElementById('aCorral');
        const aNacimiento = document.getElementById('aNacimiento');
        const aPesoNac = document.getElementById('aPesoNac');
        const aOrigen = document.getElementById('aOrigen');
        const aProveedor = document.getElementById('aProveedor');
        const aMadre = document.getElementById('aMadre');
        const aPadre = document.getElementById('aPadre');
        const aLote = document.getElementById('aLote');
        const aEstadoRepro = document.getElementById('aEstadoRepro');
        const aObservaciones = document.getElementById('aObservaciones');
        const aFoto = document.getElementById('aFoto');

        if (!aNombre || !aSexo || !aCategoria || !aRaza || !aColor || !aCorral || !aNacimiento) {
            mostrarToast('❌ Error interno: faltan campos en el formulario', 'error');
            return false;
        }

        const datos = {
            nombre: aNombre.value.trim(),
            sexo: aSexo.value,
            categoria: aCategoria.value,
            raza: aRaza.value,
            color: aColor.value,
            corral: aCorral.value,
            nacimiento: aNacimiento.value,
            pesoNacimiento: parseFloat(aPesoNac?.value) || 0,
            origen: aOrigen?.value.trim() || '',
            proveedor: aProveedor?.value.trim() || '',
            madre: aMadre?.value || '',
            padre: aPadre?.value || '',
            lote: aLote?.value.trim() || '',
            estadoReproductivo: aEstadoRepro?.value || '',
            observaciones: aObservaciones?.value.trim() || ''
        };

        console.log('[animales.js] Datos a guardar:', datos);

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
                return false;
            }
            mostrarToast('❌ ' + errors.join('. '), 'error');
            return false;
        }

        let fotoUrl = animalEnEdicion?.fotoPrincipal || '';
        if (aFoto && aFoto.files && aFoto.files.length > 0) {
            try {
                const file = aFoto.files[0];
                console.log('[animales.js] Subiendo foto:', file.name, 'Tamaño:', file.size);
                
                const tiposValidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
                if (!tiposValidos.includes(file.type)) {
                    mostrarToast('⚠️ Formato no soportado. Usa JPG, PNG, GIF o WEBP.', 'warning');
                } else if (file.size > 5 * 1024 * 1024) {
                    mostrarToast('⚠️ El archivo es demasiado grande. Máximo 5MB.', 'warning');
                } else {
                    mostrarToast('📤 Subiendo foto...', 'info');
                    const result = await subirImagenCloudinary(file, 'animales');
                    if (result && result.url) {
                        fotoUrl = result.url;
                        console.log('[animales.js] Foto subida exitosamente:', fotoUrl);
                        mostrarToast('✅ Foto subida correctamente', 'success');
                    }
                }
            } catch (error) {
                console.error('[animales.js] Error al subir foto:', error);
                mostrarToast('⚠️ No se pudo subir la foto: ' + error.message, 'warning');
            }
        }

        if (modoEdicion && animalIdEnEdicion) {
            console.log('[animales.js] Actualizando animal:', animalIdEnEdicion);
            await db.ref(`animales/${animalIdEnEdicion}`).update({
                ...datos,
                fotoPrincipal: fotoUrl,
                updatedAt: Date.now(),
                updatedBy: currentUser?.uid || '',
                updatedByEmail: currentUser?.email || ''
            });
            const numero = animalEnEdicion?.numero || 'Sin número';
            mostrarToast(`✅ Animal ${numero} actualizado exitosamente`, 'success');
            console.log('[animales.js] Animal actualizado:', animalIdEnEdicion);
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

            mostrarToast(`✅ Animal ${nuevoId} creado exitosamente`, 'success');
            console.log('[animales.js] Animal creado:', nuevoId);
            
            setTimeout(() => {
                mostrarToast('💡 Recuerda registrar el nacimiento en el módulo Eventos', 'info', 5000);
            }, 1500);
        }

        cerrarModal();
        renderizarListaAnimales();
        modoEdicion = false;
        animalEnEdicion = null;
        animalIdEnEdicion = null;
        return true;

    } catch (error) {
        console.error('[animales.js] Error al guardar:', error);
        mostrarToast('❌ Error al guardar: ' + error.message, 'error');
        return false;
    }
}

async function eliminarAnimal(id) {
    console.log('[animales.js] eliminarAnimal() llamado para ID:', id);

    if (!esAdmin()) {
        mostrarToast('⛔ No autorizado. Solo administradores.', 'error');
        return;
    }

    let animal = null;
    let firebaseKey = null;

    const entries = Object.entries(animalesCache);
    console.log('[animales.js] Buscando en animalesCache. Total:', entries.length);
    
    for (const [key, value] of entries) {
        if (value && (value.numero === id || value.id === id || key === id)) {
            animal = value;
            firebaseKey = key;
            console.log('[animales.js] Encontrado en caché:', key, value.numero);
            break;
        }
    }

    if (!animal) {
        console.log('[animales.js] No encontrado en caché, buscando en Firebase...');
        try {
            const snapshot = await db.ref('animales').orderByChild('numero').equalTo(id).once('value');
            const data = snapshot.val();
            if (data) {
                const keys = Object.keys(data);
                if (keys.length > 0) {
                    firebaseKey = keys[0];
                    animal = data[firebaseKey];
                    console.log('[animales.js] Encontrado en Firebase por número:', firebaseKey, animal.numero);
                }
            }
        } catch (error) {
            console.error('[animales.js] Error buscando en Firebase por número:', error);
        }
    }

    if (!animal) {
        try {
            const snapshot = await db.ref(`animales/${id}`).once('value');
            const data = snapshot.val();
            if (data) {
                firebaseKey = id;
                animal = data;
                console.log('[animales.js] Encontrado por ID de Firebase:', firebaseKey, animal.numero);
            }
        } catch (error) {
            console.error('[animales.js] Error buscando por ID de Firebase:', error);
        }
    }

    if (!animal || !firebaseKey) {
        console.log('[animales.js] Animal no encontrado para ID:', id);
        mostrarToast('❌ Animal no encontrado', 'error');
        return;
    }

    console.log('[animales.js] Animal encontrado:', animal.numero || 'Sin número', 'Firebase Key:', firebaseKey);

    const html = `
        <div style="text-align:center;padding:20px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:12px;"></i>
            <p style="font-size:1.1rem;font-weight:500;">¿Estás seguro de eliminar este animal?</p>
            <div style="background:var(--bg-primary);border-radius:8px;padding:16px;margin:16px 0;text-align:left;">
                <p><strong>ID:</strong> ${animal.numero || 'N/A'}</p>
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
        console.log('[animales.js] Eliminando de Firebase con key:', firebaseKey);
        await db.ref(`animales/${firebaseKey}`).update({
            status: 'inactivo',
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            updatedByEmail: currentUser?.email || ''
        });
        console.log('[animales.js] Animal marcado como inactivo:', firebaseKey);

        if (animalesCache[firebaseKey]) {
            animalesCache[firebaseKey].status = 'inactivo';
        }

        mostrarToast(`✅ Animal ${animal.numero || 'N/A'} eliminado correctamente`, 'success');
        renderizarListaAnimales();
    } catch (error) {
        console.error('[animales.js] Error al eliminar:', error);
        mostrarToast('❌ Error al eliminar: ' + error.message, 'error');
    }
}

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