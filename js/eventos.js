/**
 * eventos.js - Gestión de eventos (vacunas, pesajes, partos, etc.)
 * Dependencias: app.js (db, configuraciones, currentUser), util.js
 */

// ===== VARIABLES LOCALES =====
let eventosCache = {};

// ===== OBTENER EVENTOS DE UN ANIMAL =====
function obtenerEventos(animalId, callback) {
    const ref = db.ref('eventos').orderByChild('animalId').equalTo(animalId);
    ref.on('value', snapshot => {
        eventosCache = snapshot.val() || {};
        if (callback) callback(eventosCache);
    });
    return ref; // para posible off
}

// ===== ABRIR FORMULARIO DE EVENTO =====
async function abrirFormularioEvento(animalId, tipo = null) {
    if (!animalId) return mostrarToast('Seleccione un animal primero', 'warning');
    const animal = animalesCache[animalId];
    if (!animal) return mostrarToast('Animal no encontrado', 'error');

    // Asegurar que las configuraciones estén cargadas
    if (!configuraciones || Object.keys(configuraciones).length === 0) {
        await cargarConfiguraciones();
        if (!configuraciones || Object.keys(configuraciones).length === 0) {
            await crearConfiguracionesPorDefecto();
            const snap = await db.ref('configuraciones').once('value');
            configuraciones = snap.val() || {};
        }
    }

    // Si no se pasa tipo, mostrar selector
    if (!tipo) {
        const tipos = ['pesaje', 'vacuna', 'tratamiento', 'inseminacion', 'parto', 'cambioCorral', 'venta', 'muerte'];
        let html = `<p>Seleccione el tipo de evento para <strong>${animal.nombre || animal.numero}</strong></p>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;">`;
        tipos.forEach(t => {
            html += `<button class="btn btn-secondary" onclick="abrirFormularioEvento('${animalId}','${t}')">${capitalize(t)}</button>`;
        });
        html += `</div>`;
        mostrarModal('Nuevo evento', html, 'Cancelar', null, '', null);
        return;
    }

    // Construir formulario según tipo
    let camposHTML = '';
    let datosIniciales = {};

    switch (tipo) {
        case 'pesaje':
            camposHTML = `
                <div class="form-group"><label>Peso (kg)</label><input type="number" step="0.1" id="ePeso" required></div>
                <div class="form-group"><label>Método</label><input type="text" id="eMetodo" placeholder="Báscula, cinta, etc."></div>
            `;
            break;
        case 'vacuna':
            const vacunas = configuraciones.tiposVacunas || [];
            camposHTML = `
                <div class="form-group"><label>Vacuna</label>
                    <select id="eVacuna">
                        <option value="">Seleccionar</option>
                        ${vacunas.map(v => `<option value="${v.nombre}">${v.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Lote</label><input type="text" id="eLote"></div>
                <div class="form-group"><label>Dosis</label><input type="text" id="eDosis" placeholder="2ml"></div>
                <div class="form-group"><label>Vía</label><input type="text" id="eVia" placeholder="IM, SC, etc."></div>
            `;
            break;
        case 'tratamiento':
            const medicamentos = configuraciones.medicamentos || [];
            camposHTML = `
                <div class="form-group"><label>Medicamento</label>
                    <select id="eMedicamento">
                        <option value="">Seleccionar</option>
                        ${medicamentos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Dosis</label><input type="text" id="eDosisTrat"></div>
                <div class="form-group"><label>Duración (días)</label><input type="number" id="eDuracion"></div>
            `;
            break;
        case 'inseminacion':
            camposHTML = `
                <div class="form-group"><label>Reproductor (ID)</label><input type="text" id="eReproductor"></div>
                <div class="form-group"><label>Semen (lote)</label><input type="text" id="eSemen"></div>
                <div class="form-group"><label>Proveedor</label><input type="text" id="eProveedorSem"></div>
                <div class="form-group"><label>Fecha de inseminación</label><input type="date" id="eFechaIns"></div>
            `;
            break;
        case 'parto':
            camposHTML = `
                <div class="form-group"><label>Cantidad vivos</label><input type="number" id="eVivos" required></div>
                <div class="form-group"><label>Cantidad muertos</label><input type="number" id="eMuertos" value="0"></div>
                <div class="form-group"><label>Momificados</label><input type="number" id="eMomificados" value="0"></div>
                <div class="form-group"><label>Peso promedio (kg)</label><input type="number" step="0.1" id="ePesoProm"></div>
            `;
            break;
        case 'cambioCorral':
            const corrales = configuraciones.corrales || [];
            camposHTML = `
                <div class="form-group"><label>Nuevo corral</label>
                    <select id="eCorral">
                        <option value="">Seleccionar</option>
                        ${corrales.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Motivo</label><input type="text" id="eMotivo"></div>
            `;
            break;
        case 'venta':
            camposHTML = `
                <div class="form-group"><label>Precio</label><input type="number" step="0.01" id="ePrecio"></div>
                <div class="form-group"><label>Comprador</label><input type="text" id="eComprador"></div>
            `;
            break;
        case 'muerte':
            camposHTML = `
                <div class="form-group"><label>Causa</label><input type="text" id="eCausa"></div>
                <div class="form-group"><label>Observaciones</label><textarea id="eObsMuerte"></textarea></div>
            `;
            break;
        default:
            mostrarToast('Tipo de evento no soportado', 'error');
            return;
    }

    const html = `
        <form id="formEvento">
            <div class="form-group"><label>Fecha</label><input type="date" id="eFecha" value="${new Date().toISOString().split('T')[0]}" required></div>
            ${camposHTML}
        </form>
    `;

    await mostrarModal(`Registrar ${capitalize(tipo)}`, html, 'Guardar', null, 'Cancelar', null);

    const confirmBtn = document.querySelector('#modalOverlay .modal-footer .btn-primary');
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            // Recoger datos
            const fecha = document.getElementById('eFecha').value;
            const datos = {};
            // Capturar según tipo
            const inputs = document.querySelectorAll('#formEvento input, #formEvento select, #formEvento textarea');
            inputs.forEach(el => {
                if (el.id.startsWith('e')) {
                    const key = el.id.slice(1);
                    datos[key] = el.value;
                }
            });
            // Validar fecha
            if (!fecha) return mostrarToast('Fecha es requerida', 'error');

            // Guardar evento
            try {
                await db.ref('eventos').push({
                    animalId: animalId,
                    tipoEvento: tipo,
                    fecha: fecha,
                    datos: datos,
                    createdAt: Date.now(),
                    createdBy: currentUser?.uid || '',
                    updatedAt: Date.now(),
                    updatedBy: currentUser?.uid || '',
                    status: 'activo'
                });
                mostrarToast('Evento registrado', 'success');
                cerrarModal();
                // Actualizar estado del animal según evento (ej: parto, inseminación)
                await actualizarEstadoAnimal(animalId, tipo, datos);
            } catch (error) {
                mostrarToast('Error al guardar: ' + error.message, 'error');
            }
        };
    }
}

// ===== ACTUALIZAR ESTADO DEL ANIMAL SEGÚN EVENTO =====
async function actualizarEstadoAnimal(animalId, tipo, datos) {
    try {
        const animalRef = db.ref(`animales/${animalId}`);
        const snapshot = await animalRef.once('value');
        const animal = snapshot.val();
        if (!animal) return;

        let updates = { updatedAt: Date.now(), updatedBy: currentUser?.uid || '' };

        switch (tipo) {
            case 'pesaje':
                const peso = parseFloat(datos.peso);
                if (!isNaN(peso)) {
                    updates.pesoActual = peso;
                }
                break;
            case 'inseminacion':
                updates.estadoReproductivo = 'Gestante';
                break;
            case 'parto':
                updates.estadoReproductivo = 'Lactante';
                break;
            case 'cambioCorral':
                if (datos.corral) updates.corral = datos.corral;
                break;
            case 'venta':
            case 'muerte':
                updates.status = 'inactivo';
                break;
            default:
                break;
        }
        if (Object.keys(updates).length > 0) {
            await animalRef.update(updates);
        }
    } catch (error) {
        console.error('Error actualizando estado:', error);
    }
}

// ===== CARGAR VISTA DE EVENTOS (global) =====
function cargarEventos() {
    const container = document.getElementById('eventosContent');
    // Mostrar selector de animal para registrar eventos rápidos
    const animales = Object.values(animalesCache).filter(a => a.status === 'activo');
    let html = `
        <div class="card">
            <div class="card-header"><span class="card-title">Registro rápido de eventos</span></div>
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label>Seleccionar animal</label>
                    <select id="eventoAnimalSelect">
                        <option value="">-- Elija --</option>
                        ${animales.map(a => `<option value="${a.id}">${a.numero} - ${a.nombre || ''}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label>Tipo de evento</label>
                    <select id="eventoTipoSelect">
                        <option value="">-- Elija --</option>
                        <option value="pesaje">Pesaje</option>
                        <option value="vacuna">Vacuna</option>
                        <option value="tratamiento">Tratamiento</option>
                        <option value="inseminacion">Inseminación</option>
                        <option value="parto">Parto</option>
                        <option value="cambioCorral">Cambio de corral</option>
                        <option value="venta">Venta</option>
                        <option value="muerte">Muerte</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="registrarEventoRapido()"><i class="fas fa-plus"></i> Registrar</button>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Eventos recientes (todos)</span></div>
            <div id="eventosRecientesLista">Cargando...</div>
        </div>
    `;
    container.innerHTML = html;
    // Cargar últimos eventos
    cargarEventosRecientes();
}

async function cargarEventosRecientes() {
    const container = document.getElementById('eventosRecientesLista');
    try {
        const snap = await db.ref('eventos').orderByChild('createdAt').limitToLast(20).once('value');
        const eventos = snap.val() || {};
        const lista = Object.values(eventos).reverse();
        if (lista.length === 0) {
            container.innerHTML = '<p>No hay eventos registrados.</p>';
            return;
        }
        let html = `<div class="table-responsive"><table><thead><tr><th>Fecha</th><th>Animal</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>`;
        for (const e of lista) {
            const animal = animalesCache[e.animalId];
            const nombreAnimal = animal ? `${animal.numero} - ${animal.nombre || ''}` : e.animalId;
            const detalle = Object.entries(e.datos || {}).map(([k,v]) => `${k}: ${v}`).join(' ');
            html += `<tr>
                <td>${formatearFecha(e.fecha || e.createdAt)}</td>
                <td>${nombreAnimal}</td>
                <td><span class="badge">${e.tipoEvento}</span></td>
                <td>${detalle}</td>
            </tr>`;
        }
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p>Error cargando eventos.</p>';
    }
}

// ===== REGISTRO RÁPIDO DESDE VISTA EVENTOS =====
window.registrarEventoRapido = function() {
    const animalId = document.getElementById('eventoAnimalSelect').value;
    const tipo = document.getElementById('eventoTipoSelect').value;
    if (!animalId) return mostrarToast('Seleccione un animal', 'warning');
    if (!tipo) return mostrarToast('Seleccione un tipo', 'warning');
    abrirFormularioEvento(animalId, tipo);
};

// ===== EXPOSICIÓN GLOBAL =====
window.cargarEventos = cargarEventos;
window.obtenerEventos = obtenerEventos;
window.abrirFormularioEvento = abrirFormularioEvento;
window.registrarEventoRapido = registrarEventoRapido;
window.actualizarEstadoAnimal = actualizarEstadoAnimal;