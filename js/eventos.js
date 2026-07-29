/**
 * eventos.js - Gestión avanzada de eventos para animales
 * Versión completa con edición, eliminación y sincronización
 * CORREGIDO: Captura correcta de todos los campos del formulario
 * FIX: Problema con mayúsculas/minúsculas en nombres de campos
 */

// ===== VARIABLES LOCALES =====
let eventosCache = {};
let listenerEventos = null;
let formularioEventoAbierto = false;
let eventoEnEdicion = null;
let modoEdicionEvento = false;
let selectorEventoAbierto = false;

// ===== CONSTANTES =====
const TIPOS_EVENTO = {
    PESAJE: 'pesaje',
    VACUNA: 'vacuna',
    TRATAMIENTO: 'tratamiento',
    INSEMINACION: 'inseminacion',
    PARTO: 'parto',
    CAMBIO_CORRAL: 'cambioCorral',
    VENTA: 'venta',
    MUERTE: 'muerte',
    DIAGNOSTICO: 'diagnostico',
    DESTETE: 'destete'
};

const COLORES_EVENTO = {
    pesaje: 'var(--color-warning)',
    vacuna: 'var(--color-info)',
    tratamiento: 'var(--color-purple)',
    inseminacion: 'var(--color-primary)',
    parto: 'var(--color-success)',
    cambioCorral: 'var(--color-secondary)',
    venta: 'var(--color-danger)',
    muerte: 'var(--color-danger)',
    diagnostico: 'var(--color-warning)',
    destete: 'var(--color-success)',
    nacimiento: 'var(--color-success)',
    eliminacion: 'var(--color-danger)'
};

// ===== MAPEO DE NOMBRES DE CAMPOS (CORREGIDO) =====
const MAPEO_CAMPOS = {
    'Precio': 'precio',
    'Comprador': 'comprador',
    'Peso': 'peso',
    'Metodo': 'metodo',
    'Vacuna': 'vacuna',
    'Lote': 'lote',
    'Dosis': 'dosis',
    'Via': 'via',
    'Medicamento': 'medicamento',
    'DosisTrat': 'dosisTrat',
    'Duracion': 'duracion',
    'ViaTrat': 'viaTrat',
    'Reproductor': 'reproductor',
    'Semen': 'semen',
    'ProveedorSem': 'proveedorSem',
    'FechaIns': 'fechaIns',
    'TipoIns': 'tipoIns',
    'Vivos': 'vivos',
    'Muertos': 'muertos',
    'Momificados': 'momificados',
    'PesoProm': 'pesoProm',
    'Corral': 'corral',
    'Motivo': 'motivo',
    'Causa': 'causa',
    'PesoFinal': 'pesoFinal',
    'Diagnostico': 'diagnostico',
    'TratamientoRecomendado': 'tratamientoRecomendado',
    'NumeroCrias': 'numeroCrias',
    'PesoDestete': 'pesoDestete',
    'ObservacionesPesaje': 'observaciones',
    'ObservacionesVacuna': 'observaciones',
    'ObservacionesTrat': 'observaciones',
    'ObservacionesIns': 'observaciones',
    'ObservacionesParto': 'observaciones',
    'ObservacionesVenta': 'observaciones',
    'ObservacionesDiag': 'observaciones',
    'ObservacionesDestete': 'observaciones',
    'ObsMuerte': 'observaciones'
};

// ===== OBTENER EVENTOS DE UN ANIMAL =====
function obtenerEventos(animalId, callback) {
    if (listenerEventos) {
        listenerEventos.off();
        listenerEventos = null;
    }
    
    const ref = db.ref('eventos').orderByChild('animalId').equalTo(animalId);
    listenerEventos = ref.on('value', snapshot => {
        eventosCache = snapshot.val() || {};
        if (callback) callback(eventosCache);
    }, error => {
        console.error('Error en listener de eventos:', error);
        mostrarToast('Error al cargar eventos: ' + error.message, 'error');
    });
    return ref;
}

// ===== OBTENER ANIMAL POR ID =====
function obtenerAnimalPorId(animalId) {
    if (!animalId) return null;
    if (animalesCache && animalesCache[animalId]) {
        return animalesCache[animalId];
    }
    if (animalesCache) {
        const animal = Object.values(animalesCache).find(a => a.id === animalId || a.numero === animalId);
        if (animal) return animal;
    }
    return null;
}

// ===== VERIFICAR ANIMAL =====
async function verificarAnimal(animalId) {
    if (!animalId) {
        mostrarToast('❌ ID de animal no proporcionado', 'error');
        return null;
    }
    
    let animal = obtenerAnimalPorId(animalId);
    if (animal) return animal;
    
    try {
        const snapshot = await db.ref(`animales/${animalId}`).once('value');
        const data = snapshot.val();
        if (data) {
            animalesCache[animalId] = data;
            return data;
        }
    } catch (error) {
        console.error('Error verificando animal:', error);
    }
    
    mostrarToast(`❌ Animal no encontrado: ${animalId}`, 'error');
    return null;
}

// ===== SELECCIONAR TIPO DE EVENTO =====
window.seleccionarTipoEvento = function(animalId, tipo) {
    console.log('[eventos.js] seleccionarTipoEvento() llamado:', { animalId, tipo });
    cerrarModal();
    setTimeout(() => {
        formularioEventoAbierto = false;
        selectorEventoAbierto = false;
        abrirFormularioEvento(animalId, tipo);
    }, 300);
};

// ===== CERRAR SELECTOR DE EVENTOS =====
window.cerrarSelectorEvento = function() {
    console.log('[eventos.js] cerrarSelectorEvento() llamado');
    cerrarModal();
    formularioEventoAbierto = false;
    selectorEventoAbierto = false;
};

// ===== RECOGER DATOS DEL FORMULARIO (VERSIÓN CORREGIDA) =====
function recogerDatosFormularioEvento() {
    const datos = {};
    const elementos = document.querySelectorAll('#formEvento input, #formEvento select, #formEvento textarea');
    
    elementos.forEach(el => {
        // Excluir campos especiales
        if (el.id === 'eFecha' || el.id === 'eCorralAnterior' || el.id === 'eventoIdEdit') {
            return;
        }
        
        // Si el campo tiene id y comienza con 'e'
        if (el.id && el.id.startsWith('e')) {
            let key = el.id.slice(1); // Remover la 'e' inicial
            let value = el.value;
            
            // Si es número, convertir a número
            if (el.type === 'number') {
                value = parseFloat(value);
                if (isNaN(value)) value = '';
            } else {
                value = value.trim();
            }
            
            // Mapear el nombre del campo si existe en el mapeo
            if (MAPEO_CAMPOS[key]) {
                key = MAPEO_CAMPOS[key];
            }
            
            // Guardar solo si tiene valor y no está vacío
            if (value !== '' && value !== null && value !== undefined) {
                datos[key] = value;
            }
        }
    });
    
    console.log('[eventos.js] Datos recogidos del formulario (crudos):', datos);
    return datos;
}

// ===== ABRIR FORMULARIO DE EVENTO =====
async function abrirFormularioEvento(animalId, tipo = null, eventoId = null) {
    console.log('[eventos.js] abrirFormularioEvento() llamado:', { animalId, tipo, eventoId });

    // Si es edición, obtener el evento
    if (eventoId) {
        try {
            const snapshot = await db.ref(`eventos/${eventoId}`).once('value');
            const evento = snapshot.val();
            if (!evento) {
                mostrarToast('❌ Evento no encontrado', 'error');
                return;
            }
            eventoEnEdicion = { id: eventoId, ...evento };
            modoEdicionEvento = true;
            animalId = evento.animalId;
            tipo = evento.tipoEvento;
        } catch (error) {
            console.error('[eventos.js] Error al obtener evento:', error);
            mostrarToast('❌ Error al cargar el evento: ' + error.message, 'error');
            return;
        }
    } else {
        eventoEnEdicion = null;
        modoEdicionEvento = false;
    }

    // Verificar si hay un formulario abierto (excepto si es el selector)
    if (formularioEventoAbierto && !selectorEventoAbierto) {
        console.log('[eventos.js] Formulario ya abierto, mostrando advertencia');
        mostrarToast('⚠️ Ya hay un formulario de evento abierto. Ciérralo primero.', 'warning');
        return;
    }

    // Verificar animal
    const animal = await verificarAnimal(animalId);
    if (!animal) {
        console.log('[eventos.js] Animal no encontrado:', animalId);
        formularioEventoAbierto = false;
        return;
    }

    try {
        // Cargar configuraciones si es necesario
        if (!configuraciones || Object.keys(configuraciones).length === 0) {
            await cargarConfiguraciones();
            if (!configuraciones || Object.keys(configuraciones).length === 0) {
                await crearConfiguracionesPorDefecto();
                const snap = await db.ref('configuraciones').once('value');
                configuraciones = snap.val() || {};
            }
        }

        // Si no se pasa tipo, mostrar selector de tipos
        if (!tipo && !modoEdicionEvento) {
            console.log('[eventos.js] Mostrando selector de tipos para:', animal.numero, animal.nombre);
            
            selectorEventoAbierto = true;
            formularioEventoAbierto = true;

            const tipos = Object.values(TIPOS_EVENTO);
            const iconos = {
                pesaje: '⚖️',
                vacuna: '💉',
                tratamiento: '💊',
                inseminacion: '🧬',
                parto: '🐷',
                cambioCorral: '🏠',
                venta: '💰',
                muerte: '⚰️',
                diagnostico: '🔬',
                destete: '👶'
            };

            let html = `
                <div style="text-align:center;margin-bottom:16px;">
                    <p style="font-size:1.1rem;font-weight:500;">Seleccione el tipo de evento para</p>
                    <p style="font-size:1.2rem;color:var(--color-primary);font-weight:700;">${animal.nombre || animal.numero}</p>
                    <p style="font-size:0.9rem;color:var(--text-secondary);">ID: ${animal.numero}</p>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0;">
            `;
            
            tipos.forEach(t => {
                html += `<button class="btn btn-secondary" onclick="seleccionarTipoEvento('${animalId}','${t}')" style="justify-content:center;padding:10px;font-size:0.9rem;">
                    ${iconos[t] || '📋'} ${capitalize(t)}
                </button>`;
            });
            html += `</div>
                <div style="text-align:center;margin-top:12px;">
                    <button class="btn btn-secondary" onclick="cerrarSelectorEvento()" style="width:100%;">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            `;
            
            await mostrarModal('📋 Seleccionar Tipo de Evento', html, {
                confirmText: 'Cerrar',
                showConfirm: true,
                showCancel: false
            });
            
            formularioEventoAbierto = false;
            selectorEventoAbierto = false;
            console.log('[eventos.js] Selector cerrado, flags reseteados');
            return;
        }

        // Si llegamos aquí, tenemos tipo definido (formulario completo)
        console.log('[eventos.js] Abriendo formulario completo para tipo:', tipo);

        // Construir formulario según tipo
        let camposHTML = '';
        let tituloEvento = modoEdicionEvento ? '✏️ Editar Evento' : '📋 Nuevo Evento';
        const evento = eventoEnEdicion;

        // Función para obtener valor del evento o vacío
        const getVal = (key) => {
            if (evento && evento.datos) {
                return evento.datos[key] || '';
            }
            return '';
        };

        const getFechaVal = () => {
            if (evento && evento.fecha) {
                return formatearFechaInput(evento.fecha);
            }
            return new Date().toISOString().split('T')[0];
        };

        // Construir campos según tipo
        switch (tipo) {
            case TIPOS_EVENTO.PESAJE:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Pesaje' : '⚖️ Registrar Pesaje';
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Peso (kg) <span style="color:var(--color-danger);">*</span></label>
                            <input type="number" step="0.1" id="ePeso" value="${getVal('peso')}" required placeholder="0.0" min="0" max="500">
                        </div>
                        <div class="form-group">
                            <label>Método</label>
                            <select id="eMetodo">
                                <option value="">Seleccionar</option>
                                <option value="Báscula" ${getVal('metodo') === 'Báscula' ? 'selected' : ''}>Báscula</option>
                                <option value="Cinta métrica" ${getVal('metodo') === 'Cinta métrica' ? 'selected' : ''}>Cinta métrica</option>
                                <option value="Estimación" ${getVal('metodo') === 'Estimación' ? 'selected' : ''}>Estimación</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea id="eObservacionesPesaje" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            case TIPOS_EVENTO.VACUNA:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Vacuna' : '💉 Registrar Vacuna';
                const vacunas = configuraciones.tiposVacunas || [];
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Vacuna <span style="color:var(--color-danger);">*</span></label>
                            <select id="eVacuna" required>
                                <option value="">Seleccionar</option>
                                ${vacunas.map(v => `<option value="${v.nombre}" ${getVal('vacuna') === v.nombre ? 'selected' : ''}>${v.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Lote</label>
                            <input type="text" id="eLote" value="${getVal('lote')}" placeholder="Número de lote">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Dosis</label>
                            <input type="text" id="eDosis" value="${getVal('dosis')}" placeholder="Ej: 2ml">
                        </div>
                        <div class="form-group">
                            <label>Vía</label>
                            <select id="eVia">
                                <option value="">Seleccionar</option>
                                <option value="IM" ${getVal('via') === 'IM' ? 'selected' : ''}>IM (Intramuscular)</option>
                                <option value="SC" ${getVal('via') === 'SC' ? 'selected' : ''}>SC (Subcutánea)</option>
                                <option value="IV" ${getVal('via') === 'IV' ? 'selected' : ''}>IV (Intravenosa)</option>
                                <option value="Oral" ${getVal('via') === 'Oral' ? 'selected' : ''}>Oral</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea id="eObservacionesVacuna" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            case TIPOS_EVENTO.TRATAMIENTO:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Tratamiento' : '💊 Registrar Tratamiento';
                const medicamentos = configuraciones.medicamentos || [];
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Medicamento <span style="color:var(--color-danger);">*</span></label>
                            <select id="eMedicamento" required>
                                <option value="">Seleccionar</option>
                                ${medicamentos.map(m => `<option value="${m.nombre}" ${getVal('medicamento') === m.nombre ? 'selected' : ''}>${m.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Dosis</label>
                            <input type="text" id="eDosisTrat" value="${getVal('dosisTrat')}" placeholder="Ej: 5ml">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Duración (días)</label>
                            <input type="number" id="eDuracion" value="${getVal('duracion')}" placeholder="Días de tratamiento" min="1">
                        </div>
                        <div class="form-group">
                            <label>Vía</label>
                            <select id="eViaTrat">
                                <option value="">Seleccionar</option>
                                <option value="Oral" ${getVal('viaTrat') === 'Oral' ? 'selected' : ''}>Oral</option>
                                <option value="IM" ${getVal('viaTrat') === 'IM' ? 'selected' : ''}>IM (Intramuscular)</option>
                                <option value="SC" ${getVal('viaTrat') === 'SC' ? 'selected' : ''}>SC (Subcutánea)</option>
                                <option value="IV" ${getVal('viaTrat') === 'IV' ? 'selected' : ''}>IV (Intravenosa)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea id="eObservacionesTrat" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            case TIPOS_EVENTO.INSEMINACION:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Inseminación' : '🧬 Registrar Inseminación';
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Reproductor (ID) <span style="color:var(--color-danger);">*</span></label>
                            <input type="text" id="eReproductor" value="${getVal('reproductor')}" required placeholder="Ej: CER000001">
                        </div>
                        <div class="form-group">
                            <label>Semen (lote)</label>
                            <input type="text" id="eSemen" value="${getVal('semen')}" placeholder="Número de lote de semen">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Proveedor</label>
                            <input type="text" id="eProveedorSem" value="${getVal('proveedorSem')}" placeholder="Nombre del proveedor">
                        </div>
                        <div class="form-group">
                            <label>Fecha de inseminación <span style="color:var(--color-danger);">*</span></label>
                            <input type="date" id="eFechaIns" value="${getVal('fechaIns') || ''}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Tipo de inseminación</label>
                        <select id="eTipoIns">
                            <option value="">Seleccionar</option>
                            <option value="Natural" ${getVal('tipoIns') === 'Natural' ? 'selected' : ''}>Natural (Monta)</option>
                            <option value="Artificial" ${getVal('tipoIns') === 'Artificial' ? 'selected' : ''}>Artificial</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea id="eObservacionesIns" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            case TIPOS_EVENTO.PARTO:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Parto' : '🐷 Registrar Parto';
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Cantidad vivos <span style="color:var(--color-danger);">*</span></label>
                            <input type="number" id="eVivos" value="${getVal('vivos')}" required placeholder="0" min="0">
                        </div>
                        <div class="form-group">
                            <label>Cantidad muertos</label>
                            <input type="number" id="eMuertos" value="${getVal('muertos') || 0}" min="0">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Momificados</label>
                            <input type="number" id="eMomificados" value="${getVal('momificados') || 0}" min="0">
                        </div>
                        <div class="form-group">
                            <label>Peso promedio (kg)</label>
                            <input type="number" step="0.1" id="ePesoProm" value="${getVal('pesoProm') || ''}" placeholder="0.0" min="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Observaciones del parto</label>
                        <textarea id="eObservacionesParto" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            case TIPOS_EVENTO.CAMBIO_CORRAL:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Cambio de Corral' : '🏠 Cambio de Corral';
                const corrales = configuraciones.corrales || [];
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Nuevo corral <span style="color:var(--color-danger);">*</span></label>
                            <select id="eCorral" required>
                                <option value="">Seleccionar</option>
                                ${corrales.map(c => `<option value="${c.nombre}" ${getVal('corral') === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Corral anterior</label>
                            <input type="text" id="eCorralAnterior" value="${animal.corral || ''}" readonly style="background:var(--bg-primary);">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Motivo</label>
                        <input type="text" id="eMotivo" value="${getVal('motivo')}" placeholder="Razón del cambio">
                    </div>
                `;
                break;

            case TIPOS_EVENTO.VENTA:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Venta' : '💰 Registrar Venta';
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Precio <span style="color:var(--color-danger);">*</span></label>
                            <input type="number" step="0.01" id="ePrecio" value="${getVal('precio')}" required placeholder="0.00" min="0">
                        </div>
                        <div class="form-group">
                            <label>Comprador</label>
                            <input type="text" id="eComprador" value="${getVal('comprador')}" placeholder="Nombre del comprador">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea id="eObservacionesVenta" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            case TIPOS_EVENTO.MUERTE:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Muerte' : '⚰️ Registrar Muerte';
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Causa <span style="color:var(--color-danger);">*</span></label>
                            <input type="text" id="eCausa" value="${getVal('causa')}" required placeholder="Causa de muerte">
                        </div>
                        <div class="form-group">
                            <label>Peso final (kg)</label>
                            <input type="number" step="0.1" id="ePesoFinal" value="${getVal('pesoFinal') || ''}" placeholder="0.0" min="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea id="eObsMuerte" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            case TIPOS_EVENTO.DIAGNOSTICO:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Diagnóstico' : '🔬 Registrar Diagnóstico';
                camposHTML = `
                    <div class="form-group">
                        <label>Diagnóstico <span style="color:var(--color-danger);">*</span></label>
                        <textarea id="eDiagnostico" required rows="3">${getVal('diagnostico') || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Tratamiento recomendado</label>
                        <textarea id="eTratamientoRecomendado" rows="2">${getVal('tratamientoRecomendado') || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea id="eObservacionesDiag" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            case TIPOS_EVENTO.DESTETE:
                tituloEvento = modoEdicionEvento ? '✏️ Editar Destete' : '👶 Registrar Destete';
                camposHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Número de crías <span style="color:var(--color-danger);">*</span></label>
                            <input type="number" id="eNumeroCrias" value="${getVal('numeroCrias')}" required placeholder="0" min="0">
                        </div>
                        <div class="form-group">
                            <label>Peso promedio (kg)</label>
                            <input type="number" step="0.1" id="ePesoDestete" value="${getVal('pesoDestete') || ''}" placeholder="0.0" min="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea id="eObservacionesDestete" rows="2">${getVal('observaciones') || ''}</textarea>
                    </div>
                `;
                break;

            default:
                mostrarToast('❌ Tipo de evento no soportado', 'error');
                formularioEventoAbierto = false;
                return;
        }

        const html = `
            <form id="formEvento" novalidate>
                <div class="form-group">
                    <label>Fecha <span style="color:var(--color-danger);">*</span></label>
                    <input type="date" id="eFecha" value="${getFechaVal()}" required>
                </div>
                ${camposHTML}
                <div id="formMessageEvento" style="margin-top:12px;display:none;"></div>
                ${modoEdicionEvento ? `<input type="hidden" id="eventoIdEdit" value="${eventoEnEdicion.id}">` : ''}
            </form>
        `;

        formularioEventoAbierto = true;

        await mostrarModal(tituloEvento, html, {
            confirmText: modoEdicionEvento ? '💾 Actualizar Evento' : '💾 Guardar Evento',
            cancelText: '❌ Cancelar',
            showConfirm: true,
            showCancel: true,
            onConfirm: async function() {
                if (modoEdicionEvento) {
                    await actualizarEventoDesdeFormulario(animalId, tipo);
                } else {
                    await guardarEventoDesdeFormulario(animalId, tipo, animal);
                }
            }
        });

        formularioEventoAbierto = false;

    } catch (error) {
        console.error('[eventos.js] Error al abrir formulario:', error);
        mostrarToast('❌ Error al preparar el formulario: ' + error.message, 'error');
        formularioEventoAbierto = false;
        selectorEventoAbierto = false;
    }
}

// ===== GUARDAR EVENTO DESDE FORMULARIO =====
async function guardarEventoDesdeFormulario(animalId, tipo, animal) {
    console.log('[eventos.js] guardarEventoDesdeFormulario() iniciado');

    try {
        const fecha = document.getElementById('eFecha')?.value;
        if (!fecha) {
            mostrarToast('❌ La fecha es obligatoria', 'error');
            return false;
        }

        // Recoger datos del formulario
        const datos = recogerDatosFormularioEvento();
        console.log('[eventos.js] Datos después del mapeo:', datos);

        // Validaciones específicas por tipo
        const errors = [];
        
        switch (tipo) {
            case TIPOS_EVENTO.PESAJE:
                if (!datos.peso || datos.peso === '') errors.push('Ingresa el peso');
                if (datos.peso && parseFloat(datos.peso) > 500) errors.push('El peso parece excesivo (>500kg)');
                break;
            case TIPOS_EVENTO.VACUNA:
                if (!datos.vacuna || datos.vacuna === '') errors.push('Selecciona una vacuna');
                break;
            case TIPOS_EVENTO.TRATAMIENTO:
                if (!datos.medicamento || datos.medicamento === '') errors.push('Selecciona un medicamento');
                break;
            case TIPOS_EVENTO.INSEMINACION:
                if (!datos.reproductor || datos.reproductor === '') errors.push('Ingresa el ID del reproductor');
                if (!datos.fechaIns || datos.fechaIns === '') errors.push('Ingresa la fecha de inseminación');
                break;
            case TIPOS_EVENTO.PARTO:
                if (!datos.vivos && datos.vivos !== 0 && datos.vivos !== '0') errors.push('Ingresa la cantidad de vivos');
                if (datos.vivos && parseInt(datos.vivos) < 0) errors.push('La cantidad de vivos no puede ser negativa');
                break;
            case TIPOS_EVENTO.CAMBIO_CORRAL:
                if (!datos.corral || datos.corral === '') errors.push('Selecciona un corral');
                break;
            case TIPOS_EVENTO.VENTA:
                console.log('[eventos.js] Validando VENTA - datos.precio:', datos.precio);
                if (!datos.precio || datos.precio === '' || datos.precio === 0) {
                    errors.push('Ingresa el precio');
                }
                if (datos.precio && parseFloat(datos.precio) <= 0) {
                    errors.push('El precio debe ser mayor a 0');
                }
                break;
            case TIPOS_EVENTO.MUERTE:
                if (!datos.causa || datos.causa === '') errors.push('Ingresa la causa de muerte');
                break;
            case TIPOS_EVENTO.DIAGNOSTICO:
                if (!datos.diagnostico || datos.diagnostico === '') errors.push('Ingresa el diagnóstico');
                break;
            case TIPOS_EVENTO.DESTETE:
                if (!datos.numeroCrias && datos.numeroCrias !== 0 && datos.numeroCrias !== '0') {
                    errors.push('Ingresa el número de crías');
                }
                if (datos.numeroCrias && parseInt(datos.numeroCrias) < 0) {
                    errors.push('El número de crías no puede ser negativo');
                }
                break;
        }

        if (errors.length > 0) {
            const msgDiv = document.getElementById('formMessageEvento');
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

        // Guardar evento en Firebase
        const eventoRef = db.ref('eventos').push();
        await eventoRef.set({
            animalId: animalId,
            tipoEvento: tipo,
            fecha: fecha,
            datos: datos,
            createdAt: Date.now(),
            createdBy: currentUser?.uid || '',
            createdByEmail: currentUser?.email || '',
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            status: 'activo'
        });

        mostrarToast(`✅ Evento ${capitalize(tipo)} registrado exitosamente`, 'success');
        console.log('[eventos.js] Evento creado:', eventoRef.key, 'Datos:', datos);

        // Actualizar estado del animal
        await actualizarEstadoAnimal(animalId, tipo, datos);
        cargarEventosRecientes();
        return true;

    } catch (error) {
        console.error('[eventos.js] Error al guardar:', error);
        mostrarToast('❌ Error al guardar el evento: ' + error.message, 'error');
        return false;
    }
}

// ===== ACTUALIZAR EVENTO DESDE FORMULARIO =====
async function actualizarEventoDesdeFormulario(animalId, tipo) {
    console.log('[eventos.js] actualizarEventoDesdeFormulario() iniciado');

    try {
        const eventoId = document.getElementById('eventoIdEdit')?.value;
        if (!eventoId) {
            mostrarToast('❌ ID de evento no encontrado', 'error');
            return false;
        }

        const fecha = document.getElementById('eFecha')?.value;
        if (!fecha) {
            mostrarToast('❌ La fecha es obligatoria', 'error');
            return false;
        }

        const datos = recogerDatosFormularioEvento();

        if (Object.keys(datos).length === 0) {
            mostrarToast('❌ No hay datos para actualizar', 'error');
            return false;
        }

        await db.ref(`eventos/${eventoId}`).update({
            fecha: fecha,
            datos: datos,
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            updatedByEmail: currentUser?.email || ''
        });

        mostrarToast(`✅ Evento ${capitalize(tipo)} actualizado exitosamente`, 'success');
        console.log('[eventos.js] Evento actualizado:', eventoId, 'Datos:', datos);

        await actualizarEstadoAnimal(animalId, tipo, datos);
        cargarEventosRecientes();
        return true;

    } catch (error) {
        console.error('[eventos.js] Error al actualizar:', error);
        mostrarToast('❌ Error al actualizar el evento: ' + error.message, 'error');
        return false;
    }
}

// ===== ELIMINAR EVENTO =====
async function eliminarEvento(eventoId) {
    if (currentUser?.rol !== 'admin') {
        mostrarToast('⛔ No autorizado. Solo administradores.', 'error');
        return;
    }

    try {
        const snapshot = await db.ref(`eventos/${eventoId}`).once('value');
        const evento = snapshot.val();
        if (!evento) {
            mostrarToast('❌ Evento no encontrado', 'error');
            return;
        }

        const html = `
            <div style="text-align:center;padding:20px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:12px;"></i>
                <p style="font-size:1.1rem;font-weight:500;">¿Estás seguro de eliminar este evento?</p>
                <div style="background:var(--bg-primary);border-radius:8px;padding:16px;margin:16px 0;text-align:left;">
                    <p><strong>Tipo:</strong> ${evento.tipoEvento}</p>
                    <p><strong>Fecha:</strong> ${formatearFecha(evento.fecha || evento.createdAt)}</p>
                    <p><strong>Detalle:</strong> ${Object.entries(evento.datos || {}).filter(([k,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' | ') || 'Sin detalles'}</p>
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

        await db.ref(`eventos/${eventoId}`).remove();
        mostrarToast('✅ Evento eliminado correctamente', 'success');
        cargarEventosRecientes();
    } catch (error) {
        console.error('[eventos.js] Error al eliminar:', error);
        mostrarToast('❌ Error al eliminar: ' + error.message, 'error');
    }
}

// ===== ACTUALIZAR ESTADO DEL ANIMAL =====
async function actualizarEstadoAnimal(animalId, tipo, datos) {
    try {
        const animalRef = db.ref(`animales/${animalId}`);
        const snapshot = await animalRef.once('value');
        const animal = snapshot.val();
        if (!animal) return;

        let updates = { 
            updatedAt: Date.now(), 
            updatedBy: currentUser?.uid || '' 
        };

        switch (tipo) {
            case TIPOS_EVENTO.PESAJE:
                const peso = parseFloat(datos.peso);
                if (!isNaN(peso) && peso > 0) {
                    if (animal.pesoActual) {
                        const pesoAnterior = parseFloat(animal.pesoActual);
                        const ganancia = peso - pesoAnterior;
                        updates.gananciaDiaria = ganancia > 0 ? `+${ganancia.toFixed(2)} kg` : `${ganancia.toFixed(2)} kg`;
                    }
                    updates.pesoActual = peso;
                }
                break;
            case TIPOS_EVENTO.INSEMINACION:
                updates.estadoReproductivo = 'Gestante';
                updates.fechaInseminacion = datos.fechaIns || new Date().toISOString().split('T')[0];
                break;
            case TIPOS_EVENTO.PARTO:
                updates.estadoReproductivo = 'Lactante';
                updates.ultimoParto = new Date().toISOString().split('T')[0];
                if (datos.vivos) updates.numeroCrias = parseInt(datos.vivos);
                break;
            case TIPOS_EVENTO.CAMBIO_CORRAL:
                if (datos.corral) {
                    updates.corralAnterior = animal.corral || '';
                    updates.corral = datos.corral;
                }
                break;
            case TIPOS_EVENTO.VENTA:
            case TIPOS_EVENTO.MUERTE:
                updates.status = 'inactivo';
                updates.fechaSalida = new Date().toISOString().split('T')[0];
                if (tipo === TIPOS_EVENTO.VENTA && datos.precio) {
                    updates.precioVenta = parseFloat(datos.precio) || 0;
                }
                if (tipo === TIPOS_EVENTO.MUERTE && datos.causa) {
                    updates.causaMuerte = datos.causa || '';
                }
                break;
            case TIPOS_EVENTO.DESTETE:
                updates.estadoReproductivo = 'Activo';
                if (datos.numeroCrias) updates.numeroCriasDestetadas = parseInt(datos.numeroCrias);
                break;
            default:
                break;
        }

        if (Object.keys(updates).length > 1) {
            await animalRef.update(updates);
            console.log('[eventos.js] Estado del animal actualizado:', updates);
        }
    } catch (error) {
        console.error('[eventos.js] Error actualizando estado:', error);
    }
}

// ===== CARGAR VISTA DE EVENTOS =====
function cargarEventos() {
    const container = document.getElementById('eventosContent');
    if (!container) return;
    
    const animales = Object.values(animalesCache).filter(a => a.status === 'activo');
    const animalOptions = animales.length > 0 ? 
        animales.map(a => `<option value="${a.id}">${a.numero} - ${a.nombre || 'Sin nombre'}</option>`).join('') :
        '<option value="">No hay animales activos</option>';

    let html = `
        <div class="card" style="border-left:4px solid var(--color-primary);">
            <div class="card-header">
                <span class="card-title">📋 Registro Rápido de Eventos</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group">
                    <label>Seleccionar animal <span style="color:var(--color-danger);">*</span></label>
                    <select id="eventoAnimalSelect" style="width:100%;">
                        <option value="">-- Elija un animal --</option>
                        ${animalOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Tipo de evento <span style="color:var(--color-danger);">*</span></label>
                    <select id="eventoTipoSelect" style="width:100%;">
                        <option value="">-- Elija un tipo --</option>
                        <option value="pesaje">⚖️ Pesaje</option>
                        <option value="vacuna">💉 Vacuna</option>
                        <option value="tratamiento">💊 Tratamiento</option>
                        <option value="inseminacion">🧬 Inseminación</option>
                        <option value="parto">🐷 Parto</option>
                        <option value="cambioCorral">🏠 Cambio de corral</option>
                        <option value="venta">💰 Venta</option>
                        <option value="muerte">⚰️ Muerte</option>
                        <option value="diagnostico">🔬 Diagnóstico</option>
                        <option value="destete">👶 Destete</option>
                    </select>
                </div>
            </div>
            <div style="margin-top:12px;">
                <button class="btn btn-primary" onclick="registrarEventoRapido()" style="width:100%;">
                    <i class="fas fa-plus"></i> Registrar Evento
                </button>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <span class="card-title">📊 Eventos Recientes</span>
                <button class="btn btn-secondary btn-sm" onclick="cargarEventosRecientes()">
                    <i class="fas fa-sync"></i> Actualizar
                </button>
            </div>
            <div id="eventosRecientesLista">
                <div class="loader" style="margin:20px auto;"></div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    cargarEventosRecientes();
}

// ===== CARGAR EVENTOS RECIENTES =====
async function cargarEventosRecientes() {
    const container = document.getElementById('eventosRecientesLista');
    if (!container) return;
    
    try {
        const snap = await db.ref('eventos').orderByChild('createdAt').limitToLast(30).once('value');
        const eventos = snap.val() || {};
        const entries = Object.entries(eventos);
        
        if (entries.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:40px;color:var(--text-light);">
                    <i class="fas fa-calendar" style="font-size:2rem;display:block;margin-bottom:10px;"></i>
                    No hay eventos registrados
                </div>
            `;
            return;
        }

        entries.sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
        const eventosMostrar = entries.slice(0, 30);

        let html = `<div class="table-responsive"><table>
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Animal</th>
                    <th>Tipo</th>
                    <th>Detalle</th>
                    <th>Registrado por</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>`;
        
        for (const [key, e] of eventosMostrar) {
            const animal = obtenerAnimalPorId(e.animalId);
            const nombreAnimal = animal ? `${animal.numero} - ${animal.nombre || ''}` : e.animalId || 'N/A';
            
            let detalle = '';
            if (e.datos) {
                const entriesDetalle = Object.entries(e.datos).filter(([k, v]) => v && v !== '');
                detalle = entriesDetalle.map(([k, v]) => `${k}: ${v}`).join(' | ');
                if (!detalle) detalle = 'Sin detalles';
            } else {
                detalle = 'Sin detalles';
            }
            
            const color = COLORES_EVENTO[e.tipoEvento] || 'var(--color-primary)';
            
            html += `<tr>
                <td style="white-space:nowrap;">${formatearFecha(e.fecha || e.createdAt)}</td>
                <td><strong>${nombreAnimal}</strong></td>
                <td><span class="badge" style="background:${color};">${e.tipoEvento}</span></td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${detalle}</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">${e.createdByEmail || 'Sistema'}</td>
                <td class="actions">
                    ${currentUser?.rol === 'admin' ? `
                        <button class="btn btn-sm btn-secondary" onclick="abrirFormularioEvento('${e.animalId}', '${e.tipoEvento}', '${key}')" title="Editar evento"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarEvento('${key}')" title="Eliminar evento"><i class="fas fa-trash"></i></button>
                    ` : ''}
                </td>
            </tr>`;
        }
        
        html += `</tbody></table></div>`;
        container.innerHTML = html;
        
    } catch (error) {
        console.error('[eventos.js] Error cargando eventos recientes:', error);
        container.innerHTML = `<p style="color:var(--color-danger);">❌ Error al cargar eventos: ${error.message}</p>`;
    }
}

// ===== REGISTRAR EVENTO RÁPIDO =====
window.registrarEventoRapido = function() {
    const animalSelect = document.getElementById('eventoAnimalSelect');
    const tipoSelect = document.getElementById('eventoTipoSelect');
    
    const animalId = animalSelect?.value;
    const tipo = tipoSelect?.value;
    
    if (!animalId) {
        mostrarToast('⚠️ Selecciona un animal', 'warning');
        animalSelect?.focus();
        return;
    }
    if (!tipo) {
        mostrarToast('⚠️ Selecciona un tipo de evento', 'warning');
        tipoSelect?.focus();
        return;
    }
    
    formularioEventoAbierto = false;
    selectorEventoAbierto = false;
    abrirFormularioEvento(animalId, tipo);
};

// ===== EXPOSICIÓN GLOBAL =====
window.cargarEventos = cargarEventos;
window.obtenerEventos = obtenerEventos;
window.abrirFormularioEvento = abrirFormularioEvento;
window.registrarEventoRapido = registrarEventoRapido;
window.actualizarEstadoAnimal = actualizarEstadoAnimal;
window.cargarEventosRecientes = cargarEventosRecientes;
window.eliminarEvento = eliminarEvento;

console.log('[eventos.js] Módulo cargado correctamente');