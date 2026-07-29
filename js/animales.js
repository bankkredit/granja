/**
 * animales.js - CRUD y gestión de animales
 * Dependencias: app.js (db, configuraciones, currentUser), util.js
 */

// ===== VARIABLES LOCALES =====
let animalesCache = {};
let listenerAnimales = null;

// ===== OBTENER ANIMALES (en tiempo real) =====
function obtenerAnimales(callback) {
    if (listenerAnimales) return;
    listenerAnimales = db.ref('animales').on('value', snapshot => {
        animalesCache = snapshot.val() || {};
        if (callback) callback(animalesCache);
        if (currentView === 'animales') renderizarListaAnimales();
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
            (a.categoria && a.categoria.toLowerCase().includes(f))
        );
    }

    const html = `
        <div class="card">
            <div class="card-header">
                <span class="card-title">Animales (${lista.length})</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <input type="text" id="buscarAnimal" placeholder="Buscar..." style="padding:6px 12px;border-radius:var(--radius);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);">
                    <button class="btn btn-primary" onclick="abrirFormularioAnimal()"><i class="fas fa-plus"></i> Nuevo</button>
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
                            <th>Estado</th>
                            <th>Corral</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lista.map(a => `
                            <tr>
                                <td><strong>${a.numero}</strong></td>
                                <td>${a.nombre || ''}</td>
                                <td>${a.categoria || ''}</td>
                                <td>${a.sexo || ''}</td>
                                <td><span class="badge ${a.status === 'activo' ? 'badge-success' : 'badge-danger'}">${a.status || 'activo'}</span></td>
                                <td>${a.corral || ''}</td>
                                <td class="actions">
                                    <button class="btn btn-sm btn-primary" onclick="verDetalleAnimal('${a.id}')"><i class="fas fa-eye"></i></button>
                                    <button class="btn btn-sm btn-secondary" onclick="abrirFormularioAnimal('${a.id}')"><i class="fas fa-edit"></i></button>
                                    ${currentUser?.rol === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="eliminarAnimal('${a.id}')"><i class="fas fa-trash"></i></button>` : ''}
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="7">No hay animales registrados</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;

    document.getElementById('buscarAnimal')?.addEventListener('input', (e) => {
        renderizarListaAnimales(e.target.value);
    });
}

// ===== CARGAR ANIMALES =====
function cargarAnimales() {
    if (!listenerAnimales) {
        obtenerAnimales(() => renderizarListaAnimales());
    } else {
        renderizarListaAnimales();
    }
}

// ===== VER DETALLE =====
async function verDetalleAnimal(id) {
    const animal = animalesCache[id];
    if (!animal) return mostrarToast('Animal no encontrado', 'error');
    const eventosSnap = await db.ref('eventos').orderByChild('animalId').equalTo(id).once('value');
    const eventos = eventosSnap.val() || {};
    const listaEventos = Object.values(eventos).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const edad = calcularEdad(animal.nacimiento);

    let html = `
        <div style="display:flex;flex-wrap:wrap;gap:20px;">
            <div style="flex:1;min-width:200px;">
                <p><strong>ID:</strong> ${animal.numero}</p>
                <p><strong>Nombre:</strong> ${animal.nombre || 'N/A'}</p>
                <p><strong>Categoría:</strong> ${animal.categoria || 'N/A'}</p>
                <p><strong>Sexo:</strong> ${animal.sexo || 'N/A'}</p>
                <p><strong>Raza:</strong> ${animal.raza || 'N/A'}</p>
                <p><strong>Color:</strong> ${animal.color || 'N/A'}</p>
                <p><strong>Nacimiento:</strong> ${formatearFecha(animal.nacimiento)} (${edad})</p>
                <p><strong>Corral:</strong> ${animal.corral || 'N/A'}</p>
                <p><strong>Lote:</strong> ${animal.lote || 'N/A'}</p>
                <p><strong>Estado reproductivo:</strong> ${animal.estadoReproductivo || 'N/A'}</p>
                <p><strong>Madre:</strong> ${animal.madre || 'N/A'}</p>
                <p><strong>Padre:</strong> ${animal.padre || 'N/A'}</p>
                <p><strong>Peso nacimiento:</strong> ${animal.pesoNacimiento ? animal.pesoNacimiento + ' kg' : 'N/A'}</p>
                ${animal.fotoPrincipal ? `<img src="${animal.fotoPrincipal}" style="max-width:200px;max-height:200px;border-radius:8px;margin-top:10px;">` : ''}
                <p><strong>Observaciones:</strong> ${animal.observaciones || ''}</p>
            </div>
            <div style="flex:2;min-width:300px;">
                <h4>Línea de tiempo</h4>
                <div style="max-height:400px;overflow-y:auto;">
                    ${listaEventos.length === 0 ? '<p>No hay eventos registrados.</p>' :
                        listaEventos.map(e => `
                            <div style="border-left:3px solid var(--color-primary);padding-left:12px;margin-bottom:12px;">
                                <div><strong>${formatearFecha(e.fecha || e.createdAt)}</strong> - ${e.tipoEvento}</div>
                                <div style="font-size:0.9rem;color:var(--text-secondary);">
                                    ${Object.entries(e.datos || {}).map(([k,v]) => `${k}: ${v}`).join(' | ')}
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
                <div style="margin-top:16px;">
                    <button class="btn btn-primary" onclick="abrirFormularioEvento('${id}')"><i class="fas fa-plus"></i> Agregar evento</button>
                    ${currentUser?.rol === 'admin' ? `<button class="btn btn-danger" onclick="eliminarAnimal('${id}')"><i class="fas fa-trash"></i> Eliminar</button>` : ''}
                </div>
            </div>
        </div>
    `;
    mostrarModal(`Detalle de ${animal.nombre || animal.numero}`, html, 'Cerrar', null, '', null);
}

// ===== ABRIR FORMULARIO =====
async function abrirFormularioAnimal(id = null) {
    if (!configuraciones || Object.keys(configuraciones).length === 0) {
        await cargarConfiguraciones();
        if (!configuraciones || Object.keys(configuraciones).length === 0) {
            await crearConfiguracionesPorDefecto();
            const snap = await db.ref('configuraciones').once('value');
            configuraciones = snap.val() || {};
        }
    }

    const animal = id ? animalesCache[id] : null;
    const esEdicion = !!animal;
    const titulo = esEdicion ? 'Editar animal' : 'Nuevo animal';

    const cats = configuraciones.categorias || [];
    const razas = configuraciones.razas || [];
    const colores = configuraciones.colores || [];
    const corrales = configuraciones.corrales || [];

    const selectOptions = (list, selected) => {
        if (!list || list.length === 0) {
            return '<option value="">No hay opciones</option>';
        }
        return list.map(item =>
            `<option value="${item.nombre}" ${item.nombre === selected ? 'selected' : ''}>${item.nombre}</option>`
        ).join('');
    };

    const fechaNac = animal?.nacimiento || '';
    const fechaValue = fechaNac ? new Date(fechaNac).toISOString().split('T')[0] : '';

    const html = `
        <form id="formAnimal">
            <div class="form-row">
                <div class="form-group">
                    <label>Nombre</label>
                    <input type="text" id="aNombre" value="${animal?.nombre || ''}">
                </div>
                <div class="form-group">
                    <label>Sexo</label>
                    <select id="aSexo">
                        <option value="Macho" ${animal?.sexo === 'Macho' ? 'selected' : ''}>Macho</option>
                        <option value="Hembra" ${animal?.sexo === 'Hembra' ? 'selected' : ''}>Hembra</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Categoría</label>
                    <select id="aCategoria">
                        <option value="">Seleccionar</option>
                        ${selectOptions(cats, animal?.categoria)}
                    </select>
                    ${currentUser?.rol === 'admin' ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();">Gestionar categorías</a></small>` : ''}
                </div>
                <div class="form-group">
                    <label>Raza</label>
                    <select id="aRaza">
                        <option value="">Seleccionar</option>
                        ${selectOptions(razas, animal?.raza)}
                    </select>
                    ${currentUser?.rol === 'admin' ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();">Gestionar razas</a></small>` : ''}
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Color</label>
                    <select id="aColor">
                        <option value="">Seleccionar</option>
                        ${selectOptions(colores, animal?.color)}
                    </select>
                    ${currentUser?.rol === 'admin' ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();">Gestionar colores</a></small>` : ''}
                </div>
                <div class="form-group">
                    <label>Corral</label>
                    <select id="aCorral">
                        <option value="">Seleccionar</option>
                        ${selectOptions(corrales, animal?.corral)}
                    </select>
                    ${currentUser?.rol === 'admin' ? `<small><a href="#" onclick="mostrarVista('configuracion'); cerrarModal();">Gestionar corrales</a></small>` : ''}
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Fecha de nacimiento</label>
                    <input type="date" id="aNacimiento" value="${fechaValue}">
                </div>
                <div class="form-group">
                    <label>Peso al nacer (kg)</label>
                    <input type="number" step="0.1" id="aPesoNac" value="${animal?.pesoNacimiento || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Origen</label>
                    <input type="text" id="aOrigen" value="${animal?.origen || ''}">
                </div>
                <div class="form-group">
                    <label>Proveedor</label>
                    <input type="text" id="aProveedor" value="${animal?.proveedor || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Madre (ID)</label>
                    <input type="text" id="aMadre" value="${animal?.madre || ''}">
                </div>
                <div class="form-group">
                    <label>Padre (ID)</label>
                    <input type="text" id="aPadre" value="${animal?.padre || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Lote</label>
                    <input type="text" id="aLote" value="${animal?.lote || ''}">
                </div>
                <div class="form-group">
                    <label>Estado reproductivo</label>
                    <input type="text" id="aEstadoRepro" value="${animal?.estadoReproductivo || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <textarea id="aObservaciones">${animal?.observaciones || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Foto principal</label>
                <input type="file" id="aFoto" accept="image/*">
                ${animal?.fotoPrincipal ? `<img src="${animal.fotoPrincipal}" style="max-width:100px;margin-top:8px;">` : ''}
            </div>
        </form>
    `;

    await mostrarModal(titulo, html, esEdicion ? 'Actualizar' : 'Crear', null, 'Cancelar', null);

    const confirmBtn = document.querySelector('#modalOverlay .modal-footer .btn-primary');
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const datos = {
                nombre: document.getElementById('aNombre').value.trim(),
                sexo: document.getElementById('aSexo').value,
                categoria: document.getElementById('aCategoria').value,
                raza: document.getElementById('aRaza').value,
                color: document.getElementById('aColor').value,
                corral: document.getElementById('aCorral').value,
                nacimiento: document.getElementById('aNacimiento').value,
                pesoNacimiento: parseFloat(document.getElementById('aPesoNac').value) || 0,
                origen: document.getElementById('aOrigen').value.trim(),
                proveedor: document.getElementById('aProveedor').value.trim(),
                madre: document.getElementById('aMadre').value.trim(),
                padre: document.getElementById('aPadre').value.trim(),
                lote: document.getElementById('aLote').value.trim(),
                estadoReproductivo: document.getElementById('aEstadoRepro').value.trim(),
                observaciones: document.getElementById('aObservaciones').value.trim()
            };

            const errors = validarCampos(datos, {
                sexo: { required: true },
                nacimiento: { required: true }
            });
            if (errors.length > 0) {
                mostrarToast(errors.join(' '), 'error');
                return;
            }

            const fileInput = document.getElementById('aFoto');
            let fotoUrl = animal?.fotoPrincipal || '';
            if (fileInput && fileInput.files.length > 0) {
                try {
                    const result = await subirArchivoCloudinary(fileInput.files[0], 'animales');
                    fotoUrl = result.url;
                } catch (error) {
                    mostrarToast('Error al subir foto: ' + error.message, 'error');
                    return;
                }
            }

            try {
                if (esEdicion) {
                    await db.ref(`animales/${id}`).update({
                        ...datos,
                        fotoPrincipal: fotoUrl,
                        updatedAt: Date.now(),
                        updatedBy: currentUser?.uid || ''
                    });
                    mostrarToast('Animal actualizado', 'success');
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
                        updatedAt: Date.now(),
                        updatedBy: currentUser?.uid || ''
                    });
                    await db.ref('eventos').push({
                        animalId: ref.key,
                        tipoEvento: 'nacimiento',
                        fecha: datos.nacimiento,
                        datos: { pesoNacimiento: datos.pesoNacimiento },
                        createdAt: Date.now(),
                        createdBy: currentUser?.uid || '',
                        updatedAt: Date.now(),
                        updatedBy: currentUser?.uid || '',
                        status: 'activo'
                    });
                    mostrarToast('Animal creado exitosamente', 'success');
                }
                cerrarModal();
                renderizarListaAnimales();
            } catch (error) {
                mostrarToast('Error al guardar: ' + error.message, 'error');
            }
        };
    }
}

// ===== ELIMINAR ANIMAL =====
async function eliminarAnimal(id) {
    if (currentUser?.rol !== 'admin') return mostrarToast('No autorizado', 'error');
    if (!confirm('¿Eliminar permanentemente este animal? Esta acción no se puede deshacer.')) return;
    try {
        await db.ref(`animales/${id}`).update({ status: 'inactivo' });
        mostrarToast('Animal eliminado (lógicamente)', 'success');
    } catch (error) {
        mostrarToast('Error: ' + error.message, 'error');
    }
}

// ===== EXPOSICIÓN GLOBAL =====
window.cargarAnimales = cargarAnimales;
window.obtenerAnimales = obtenerAnimales;
window.renderizarListaAnimales = renderizarListaAnimales;
window.verDetalleAnimal = verDetalleAnimal;
window.abrirFormularioAnimal = abrirFormularioAnimal;
window.eliminarAnimal = eliminarAnimal;