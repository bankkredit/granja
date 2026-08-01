/**
 * ventas.js - Módulo completo de Ventas
 * Sistema avanzado de gestión de ventas con registro automático de eventos
 * Versión 1.2 - CORREGIDO: Sintaxis y funcionamiento completo
 */

// ===== VARIABLES LOCALES =====
let ventasCache = {};
let ventasListener = null;
let clientesCacheLocal = {};
let ventaEnEdicion = null;
let modoEdicionVenta = false;
let filtrosVentas = {
    fechaInicio: '',
    fechaFin: '',
    cliente: 'todos',
    estado: 'todos',
    metodoPago: 'todos',
    busqueda: ''
};
let ordenVentas = {
    campo: 'fecha',
    direccion: 'desc'
};
let ventasStats = {
    total: 0,
    montoTotal: 0,
    montoPagado: 0,
    montoPendiente: 0,
    cantidadAnimales: 0
};

// ===== CONSTANTES =====
const ESTADOS_VENTA = {
    PENDIENTE: 'pendiente',
    CONFIRMADA: 'confirmada',
    COMPLETADA: 'completada',
    CANCELADA: 'cancelada',
    ENTREGADA: 'entregada'
};

const METODOS_PAGO = {
    EFECTIVO: 'efectivo',
    TRANSFERENCIA: 'transferencia',
    TARJETA: 'tarjeta',
    CHEQUE: 'cheque',
    DEPOSITO: 'deposito',
    MIXTO: 'mixto'
};

const COLORES_ESTADO = {
    pendiente: '#f59e0b',
    confirmada: '#3b82f6',
    completada: '#22c55e',
    cancelada: '#ef4444',
    entregada: '#8b5cf6'
};

const ICONOS_ESTADO = {
    pendiente: '⏳',
    confirmada: '✅',
    completada: '💰',
    cancelada: '❌',
    entregada: '📦'
};

const ICONOS_PAGO = {
    efectivo: '💵',
    transferencia: '🏦',
    tarjeta: '💳',
    cheque: '📝',
    deposito: '🏧',
    mixto: '🔄'
};

// ============================================================
// 1. FUNCIONES DE UTILIDAD
// ============================================================

function esAdminVentas() {
    return currentUser?.rol === 'admin' || currentUser?.email === 'vinicio@geomira.se';
}

function obtenerClientePorIdVentas(id) {
    if (!id) return null;
    if (typeof clientesCache !== 'undefined' && clientesCache) {
        if (clientesCache[id]) return clientesCache[id];
        const cliente = Object.values(clientesCache).find(c => c.id === id || c.cedula === id);
        return cliente || null;
    }
    if (clientesCacheLocal[id]) return clientesCacheLocal[id];
    const cliente = Object.values(clientesCacheLocal).find(c => c.id === id || c.cedula === id);
    return cliente || null;
}

function obtenerNombreClienteVentas(id) {
    if (!id) return 'N/A';
    const cliente = obtenerClientePorIdVentas(id);
    return cliente ? cliente.nombre : id;
}

function obtenerAnimalPorIdVentas(animalId) {
    if (!animalId) return null;
    if (typeof animalesCache !== 'undefined' && animalesCache) {
        if (animalesCache[animalId]) return animalesCache[animalId];
        const animal = Object.values(animalesCache).find(a => a.id === animalId || a.numero === animalId);
        if (animal) return animal;
    }
    return null;
}

function obtenerNumeroAnimalVentas(animalId) {
    if (!animalId) return 'N/A';
    const animal = obtenerAnimalPorIdVentas(animalId);
    return animal ? animal.numero : animalId;
}

function obtenerNombreAnimalVentas(animalId) {
    if (!animalId) return 'N/A';
    const animal = obtenerAnimalPorIdVentas(animalId);
    return animal ? `${animal.numero} - ${animal.nombre || 'Sin nombre'}` : animalId;
}

// ============================================================
// 2. INICIALIZAR MÓDULO
// ============================================================

function cargarVentas() {
    console.log('[ventas.js] Inicializando módulo de ventas...');
    const container = document.getElementById('ventasContent');
    if (!container) {
        console.error('[ventas.js] Contenedor de ventas no encontrado');
        return;
    }

    if (!currentUser) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:40px;">
                <i class="fas fa-lock" style="font-size:3rem;color:var(--text-light);display:block;margin-bottom:16px;"></i>
                <h3>Acceso Restringido</h3>
                <p style="color:var(--text-secondary);">Debes iniciar sesión para acceder al módulo de ventas.</p>
            </div>
        `;
        return;
    }

    if (!esAdminVentas()) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:40px;border:2px dashed var(--color-danger);">
                <i class="fas fa-lock" style="font-size:4rem;color:var(--color-danger);display:block;margin-bottom:16px;"></i>
                <h2 style="font-size:1.5rem;margin-bottom:8px;">Acceso Restringido</h2>
                <p style="color:var(--text-secondary);max-width:400px;margin:0 auto;">
                    Solo los administradores pueden acceder al módulo de Ventas.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;">
            <div class="loader" style="margin:20px auto;"></div>
            <p style="color:var(--text-secondary);">Cargando módulo de ventas...</p>
        </div>
    `;

    if (typeof cargarClientes === 'function') {
        cargarClientes(() => {
            cargarDatosVentas();
        });
    } else {
        cargarDatosVentas();
    }
}

// ============================================================
// 3. CARGAR DATOS DE VENTAS
// ============================================================

async function cargarDatosVentas() {
    try {
        if (typeof clientesCache === 'undefined' || !clientesCache || Object.keys(clientesCache).length === 0) {
            try {
                const clientesSnap = await db.ref('clientes').once('value');
                clientesCacheLocal = clientesSnap.val() || {};
                console.log('[ventas.js] Clientes cargados localmente:', Object.keys(clientesCacheLocal).length);
            } catch (e) {
                console.warn('[ventas.js] No se pudieron cargar clientes:', e);
            }
        } else {
            clientesCacheLocal = clientesCache;
        }

        if (ventasListener) {
            try {
                ventasListener.off();
            } catch (e) {}
            ventasListener = null;
        }

        ventasListener = db.ref('ventas').on('value', snapshot => {
            ventasCache = snapshot.val() || {};
            console.log('[ventas.js] Ventas cargadas:', Object.keys(ventasCache).length);
            renderizarVentas();
        }, error => {
            console.error('[ventas.js] Error en listener de ventas:', error);
            mostrarToast('Error al cargar ventas: ' + error.message, 'error');
        });

        renderizarVentas();
    } catch (error) {
        console.error('[ventas.js] Error:', error);
        mostrarToast('❌ Error al cargar ventas: ' + error.message, 'error');
        const container = document.getElementById('ventasContent');
        if (container) {
            container.innerHTML = `
                <div class="card" style="text-align:center;padding:40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:16px;"></i>
                    <h3>Error al cargar ventas</h3>
                    <p style="color:var(--text-secondary);">${error.message}</p>
                    <button class="btn btn-primary" onclick="cargarVentas()" style="margin-top:16px;">
                        <i class="fas fa-sync"></i> Reintentar
                    </button>
                </div>
            `;
        }
    }
}

// ============================================================
// 4. RENDERIZAR VENTAS
// ============================================================

function renderizarVentas() {
    const container = document.getElementById('ventasContent');
    if (!container) return;

    const datosFiltrados = aplicarFiltrosVentas();
    const datosOrdenados = aplicarOrdenVentas(datosFiltrados);
    calcularEstadisticasVentas(datosOrdenados);

    const isAdmin = esAdminVentas();

    const clientesLista = typeof clientesCache !== 'undefined' && clientesCache ? 
        Object.values(clientesCache) : 
        Object.values(clientesCacheLocal);

    let html = `
        <!-- Panel de filtros -->
        <div class="card" style="border-left:4px solid var(--color-success);">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-shopping-cart"></i> Gestión de Ventas</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-success" onclick="abrirFormularioVenta()">
                        <i class="fas fa-plus"></i> Nueva Venta
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="exportarVentasExcel()">
                        <i class="fas fa-file-excel"></i> Excel
                    </button>
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
                <div class="form-group">
                    <label>Buscar</label>
                    <input type="text" id="filtroBusquedaVenta" placeholder="ID, cliente, animal..." 
                        value="${filtrosVentas.busqueda}" oninput="aplicarFiltrosVentasYRenderizar()">
                </div>
                <div class="form-group">
                    <label>Fecha inicio</label>
                    <input type="date" id="filtroFechaInicioVenta" value="${filtrosVentas.fechaInicio}" 
                        onchange="aplicarFiltrosVentasYRenderizar()">
                </div>
                <div class="form-group">
                    <label>Fecha fin</label>
                    <input type="date" id="filtroFechaFinVenta" value="${filtrosVentas.fechaFin}" 
                        onchange="aplicarFiltrosVentasYRenderizar()">
                </div>
                <div class="form-group">
                    <label>Cliente</label>
                    <select id="filtroClienteVenta" onchange="aplicarFiltrosVentasYRenderizar()">
                        <option value="todos">Todos</option>
                        ${clientesLista.map(c => `
                            <option value="${c.id}" ${filtrosVentas.cliente === c.id ? 'selected' : ''}>${c.nombre}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="filtroEstadoVenta" onchange="aplicarFiltrosVentasYRenderizar()">
                        <option value="todos">Todos</option>
                        ${Object.entries(ESTADOS_VENTA).map(([key, value]) => `
                            <option value="${value}" ${filtrosVentas.estado === value ? 'selected' : ''}>${capitalize(value)}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Método de pago</label>
                    <select id="filtroMetodoPagoVenta" onchange="aplicarFiltrosVentasYRenderizar()">
                        <option value="todos">Todos</option>
                        ${Object.entries(METODOS_PAGO).map(([key, value]) => `
                            <option value="${value}" ${filtrosVentas.metodoPago === value ? 'selected' : ''}>${capitalize(value)}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        </div>

        <!-- Estadísticas -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-primary);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-primary);">${ventasStats.total}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Total Ventas</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-success);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-success);">${formatearMoneda(ventasStats.montoTotal)}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Monto Total</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-info);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-info);">${formatearMoneda(ventasStats.montoPagado)}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Pagado</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-warning);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-warning);">${formatearMoneda(ventasStats.montoPendiente)}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Pendiente</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-purple);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-purple);">${ventasStats.cantidadAnimales}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Animales Vendidos</div>
            </div>
        </div>

        <!-- Lista de ventas -->
        <div class="card">
            <div class="card-header">
                <span class="card-title">📋 Lista de Ventas (${datosOrdenados.length})</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <select id="ordenCampoVenta" onchange="aplicarOrdenVentasYRenderizar()" 
                        style="padding:4px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;">
                        <option value="fecha" ${ordenVentas.campo === 'fecha' ? 'selected' : ''}>Fecha</option>
                        <option value="numero" ${ordenVentas.campo === 'numero' ? 'selected' : ''}>Nº Venta</option>
                        <option value="clienteNombre" ${ordenVentas.campo === 'clienteNombre' ? 'selected' : ''}>Cliente</option>
                        <option value="total" ${ordenVentas.campo === 'total' ? 'selected' : ''}>Monto</option>
                        <option value="estado" ${ordenVentas.campo === 'estado' ? 'selected' : ''}>Estado</option>
                    </select>
                    <button class="btn btn-secondary btn-sm" onclick="cambiarOrdenVentasDireccion()">
                        <i class="fas ${ordenVentas.direccion === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="resetearFiltrosVentas()">
                        <i class="fas fa-undo"></i> Resetear
                    </button>
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Nº Venta</th>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Animal</th>
                            <th>Cantidad</th>
                            <th>Total</th>
                            <th>Pagado</th>
                            <th>Estado</th>
                            <th>Método</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${datosOrdenados.length === 0 ? `
                            <tr>
                                <td colspan="10" style="text-align:center;padding:40px;color:var(--text-light);">
                                    <i class="fas fa-shopping-cart" style="font-size:2rem;display:block;margin-bottom:10px;"></i>
                                    No hay ventas registradas. ¡Haz clic en "Nueva Venta" para comenzar!
                                </td>
                            </tr>
                        ` : datosOrdenados.map(v => `
                            <tr style="${v.estado === 'cancelada' ? 'opacity:0.5;' : ''}">
                                <td><strong style="color:var(--color-success);">#${v.numero}</strong></td>
                                <td>${formatearFecha(v.fecha)}</td>
                                <td>${v.clienteNombre || v.clienteId || 'N/A'}</td>
                                <td>${v.animalId ? obtenerNumeroAnimalVentas(v.animalId) : (v.animales ? v.animales.length : 'N/A')}</td>
                                <td>${v.cantidad || 1}</td>
                                <td><strong>${formatearMoneda(v.total)}</strong></td>
                                <td>${formatearMoneda(v.pagado || 0)}</td>
                                <td>
                                    <span class="badge" style="background:${COLORES_ESTADO[v.estado] || '#3b82f6'};">
                                        ${ICONOS_ESTADO[v.estado] || '📋'} ${capitalize(v.estado)}
                                    </span>
                                </td>
                                <td>
                                    <span style="font-size:0.8rem;">
                                        ${ICONOS_PAGO[v.metodoPago] || '💵'} ${capitalize(v.metodoPago || 'efectivo')}
                                    </span>
                                </td>
                                <td class="actions" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;">
                                    <button class="btn btn-sm btn-primary" onclick="verDetalleVenta('${v.id}')" title="Ver detalle">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="abrirFormularioVenta('${v.id}')" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    ${isAdmin ? `
                                        <button class="btn btn-sm btn-danger" onclick="eliminarVenta('${v.id}')" title="Eliminar">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
    actualizarFiltrosVentasDesdeDOM();
}

// ============================================================
// 5. FILTROS Y ORDEN
// ============================================================

function aplicarFiltrosVentas() {
    let datos = Object.values(ventasCache);

    if (filtrosVentas.busqueda) {
        const busq = filtrosVentas.busqueda.toLowerCase();
        datos = datos.filter(v => 
            (v.numero && v.numero.toLowerCase().includes(busq)) ||
            (v.clienteNombre && v.clienteNombre.toLowerCase().includes(busq)) ||
            (v.clienteId && v.clienteId.toLowerCase().includes(busq)) ||
            (v.animalId && obtenerNumeroAnimalVentas(v.animalId).toLowerCase().includes(busq))
        );
    }

    if (filtrosVentas.fechaInicio) {
        const fechaInicio = new Date(filtrosVentas.fechaInicio);
        datos = datos.filter(v => new Date(v.fecha) >= fechaInicio);
    }

    if (filtrosVentas.fechaFin) {
        const fechaFin = new Date(filtrosVentas.fechaFin);
        fechaFin.setHours(23, 59, 59);
        datos = datos.filter(v => new Date(v.fecha) <= fechaFin);
    }

    if (filtrosVentas.cliente !== 'todos') {
        datos = datos.filter(v => v.clienteId === filtrosVentas.cliente);
    }

    if (filtrosVentas.estado !== 'todos') {
        datos = datos.filter(v => v.estado === filtrosVentas.estado);
    }

    if (filtrosVentas.metodoPago !== 'todos') {
        datos = datos.filter(v => v.metodoPago === filtrosVentas.metodoPago);
    }

    return datos;
}

function aplicarOrdenVentas(datos) {
    const campo = ordenVentas.campo;
    const direccion = ordenVentas.direccion;

    return datos.sort((a, b) => {
        let valA = a[campo] || '';
        let valB = b[campo] || '';

        if (campo === 'fecha' || campo === 'total' || campo === 'pagado') {
            valA = valA || 0;
            valB = valB || 0;
            return direccion === 'asc' ? valA - valB : valB - valA;
        }

        if (campo === 'clienteNombre') {
            valA = (a.clienteNombre || '').toLowerCase();
            valB = (b.clienteNombre || '').toLowerCase();
        }

        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        return direccion === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
}

function calcularEstadisticasVentas(datos) {
    ventasStats.total = datos.length;
    ventasStats.montoTotal = datos.reduce((sum, v) => sum + (v.total || 0), 0);
    ventasStats.montoPagado = datos.reduce((sum, v) => sum + (v.pagado || 0), 0);
    ventasStats.montoPendiente = ventasStats.montoTotal - ventasStats.montoPagado;
    ventasStats.cantidadAnimales = datos.reduce((sum, v) => sum + (v.cantidad || 1), 0);
}

function actualizarFiltrosVentasDesdeDOM() {
    const busqueda = document.getElementById('filtroBusquedaVenta');
    const fechaInicio = document.getElementById('filtroFechaInicioVenta');
    const fechaFin = document.getElementById('filtroFechaFinVenta');
    const cliente = document.getElementById('filtroClienteVenta');
    const estado = document.getElementById('filtroEstadoVenta');
    const metodoPago = document.getElementById('filtroMetodoPagoVenta');

    if (busqueda) filtrosVentas.busqueda = busqueda.value;
    if (fechaInicio) filtrosVentas.fechaInicio = fechaInicio.value;
    if (fechaFin) filtrosVentas.fechaFin = fechaFin.value;
    if (cliente) filtrosVentas.cliente = cliente.value;
    if (estado) filtrosVentas.estado = estado.value;
    if (metodoPago) filtrosVentas.metodoPago = metodoPago.value;
}

function aplicarFiltrosVentasYRenderizar() {
    actualizarFiltrosVentasDesdeDOM();
    renderizarVentas();
}

function aplicarOrdenVentasYRenderizar() {
    const campoSelect = document.getElementById('ordenCampoVenta');
    if (campoSelect) {
        ordenVentas.campo = campoSelect.value;
    }
    renderizarVentas();
}

function cambiarOrdenVentasDireccion() {
    ordenVentas.direccion = ordenVentas.direccion === 'asc' ? 'desc' : 'asc';
    renderizarVentas();
}

function resetearFiltrosVentas() {
    filtrosVentas = {
        fechaInicio: '',
        fechaFin: '',
        cliente: 'todos',
        estado: 'todos',
        metodoPago: 'todos',
        busqueda: ''
    };
    ordenVentas = {
        campo: 'fecha',
        direccion: 'desc'
    };
    renderizarVentas();
}

// ============================================================
// 6. CREAR/EDITAR VENTA
// ============================================================

async function abrirFormularioVenta(ventaId = null) {
    console.log('[ventas.js] abrirFormularioVenta() llamado:', ventaId);

    if (!esAdminVentas()) {
        mostrarToast('⛔ Solo administradores pueden gestionar ventas', 'error');
        return;
    }

    let venta = null;
    if (ventaId) {
        venta = ventasCache[ventaId];
        if (!venta) {
            mostrarToast('❌ Venta no encontrada', 'error');
            return;
        }
        ventaEnEdicion = { id: ventaId, ...venta };
        modoEdicionVenta = true;
    } else {
        ventaEnEdicion = null;
        modoEdicionVenta = false;
    }

    let animalesActivos = [];
    if (typeof animalesCache !== 'undefined' && animalesCache) {
        animalesActivos = Object.values(animalesCache).filter(a => a.status === 'activo');
    }

    let clientesLista = [];
    if (typeof clientesCache !== 'undefined' && clientesCache) {
        clientesLista = Object.values(clientesCache);
    } else {
        clientesLista = Object.values(clientesCacheLocal);
    }

    const getVal = (campo, defaultValue = '') => {
        if (venta && venta[campo] !== undefined && venta[campo] !== null) {
            return venta[campo];
        }
        return defaultValue;
    };

    const fechaValue = venta ? formatearFechaInput(venta.fecha) : new Date().toISOString().split('T')[0];
    const titulo = modoEdicionVenta ? '✏️ Editar Venta' : '💰 Nueva Venta';

    let animalOptions = '<option value="">Seleccionar animal</option>';
    if (animalesActivos.length === 0) {
        animalOptions = '<option value="">No hay animales activos</option>';
    } else {
        animalesActivos.forEach(a => {
            const selected = venta && venta.animalId === a.id ? 'selected' : '';
            animalOptions += `<option value="${a.id}" ${selected}>${a.numero} - ${a.nombre || 'Sin nombre'} (${a.categoria || 'N/A'})</option>`;
        });
    }

    let clienteOptions = '<option value="">Seleccionar cliente</option>';
    if (clientesLista.length === 0) {
        clienteOptions = '<option value="">No hay clientes registrados</option>';
    } else {
        clientesLista.forEach(c => {
            const selected = venta && venta.clienteId === c.id ? 'selected' : '';
            clienteOptions += `<option value="${c.id}" ${selected}>${c.nombre} - ${c.ruc || c.cedula || c.telefono || ''}</option>`;
        });
    }

    const estadoOptions = Object.entries(ESTADOS_VENTA).map(([key, value]) => {
        const selected = venta && venta.estado === value ? 'selected' : '';
        return `<option value="${value}" ${selected}>${capitalize(value)}</option>`;
    }).join('');

    const metodoOptions = Object.entries(METODOS_PAGO).map(([key, value]) => {
        const selected = venta && venta.metodoPago === value ? 'selected' : '';
        return `<option value="${value}" ${selected}>${capitalize(value)}</option>`;
    }).join('');

    const html = `
        <form id="formVenta" novalidate>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group">
                    <label>Fecha <span style="color:var(--color-danger);">*</span></label>
                    <input type="date" id="vFecha" value="${fechaValue}" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Nº de Venta</label>
                    <input type="text" id="vNumero" value="${getVal('numero', '')}" class="form-control" placeholder="Auto-generado" readonly>
                </div>
                <div class="form-group">
                    <label>Cliente <span style="color:var(--color-danger);">*</span></label>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <select id="vCliente" class="form-control" style="flex:1;" required>
                            ${clienteOptions}
                        </select>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="abrirFormularioCliente()" title="Nuevo cliente">
                            <i class="fas fa-user-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Animal <span style="color:var(--color-danger);">*</span></label>
                    <select id="vAnimal" class="form-control" required>
                        ${animalOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Cantidad</label>
                    <input type="number" id="vCantidad" value="${getVal('cantidad', 1)}" class="form-control" min="1" step="1">
                </div>
                <div class="form-group">
                    <label>Precio Unitario <span style="color:var(--color-danger);">*</span></label>
                    <input type="number" id="vPrecioUnitario" value="${getVal('precioUnitario', '')}" class="form-control" step="0.01" min="0" required placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Total <span style="color:var(--color-danger);">*</span></label>
                    <input type="number" id="vTotal" value="${getVal('total', '')}" class="form-control" step="0.01" min="0" required placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Monto Pagado</label>
                    <input type="number" id="vPagado" value="${getVal('pagado', 0)}" class="form-control" step="0.01" min="0" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Estado <span style="color:var(--color-danger);">*</span></label>
                    <select id="vEstado" class="form-control" required>
                        ${estadoOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Método de Pago <span style="color:var(--color-danger);">*</span></label>
                    <select id="vMetodoPago" class="form-control" required>
                        ${metodoOptions}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <textarea id="vObservaciones" rows="2" class="form-control">${getVal('observaciones', '')}</textarea>
            </div>
            <div id="formMessageVenta" style="margin-top:12px;display:none;"></div>
            ${modoEdicionVenta ? `<input type="hidden" id="ventaIdEdit" value="${ventaId}">` : ''}
        </form>
    `;

    await mostrarModal(titulo, html, {
        confirmText: modoEdicionVenta ? '💾 Actualizar Venta' : '💾 Guardar Venta',
        cancelText: '❌ Cancelar',
        showConfirm: true,
        showCancel: true,
        onConfirm: async function () {
            if (modoEdicionVenta) {
                await actualizarVentaDesdeFormulario();
            } else {
                await guardarVentaDesdeFormulario();
            }
        }
    });
}

async function guardarVentaDesdeFormulario() {
    console.log('[ventas.js] guardarVentaDesdeFormulario() iniciado');

    if (!currentUser) {
        mostrarToast('⛔ Debes iniciar sesión.', 'error');
        return false;
    }

    try {
        const fecha = document.getElementById('vFecha')?.value;
        const clienteId = document.getElementById('vCliente')?.value;
        const animalId = document.getElementById('vAnimal')?.value;
        const cantidad = parseFloat(document.getElementById('vCantidad')?.value) || 1;
        const precioUnitario = parseFloat(document.getElementById('vPrecioUnitario')?.value) || 0;
        const total = parseFloat(document.getElementById('vTotal')?.value) || 0;
        const pagado = parseFloat(document.getElementById('vPagado')?.value) || 0;
        const estado = document.getElementById('vEstado')?.value;
        const metodoPago = document.getElementById('vMetodoPago')?.value;
        const observaciones = document.getElementById('vObservaciones')?.value.trim() || '';

        const errors = [];
        if (!fecha) errors.push('La fecha es obligatoria');
        if (!clienteId) errors.push('Selecciona un cliente');
        if (!animalId) errors.push('Selecciona un animal');
        if (precioUnitario <= 0) errors.push('El precio unitario debe ser mayor a 0');
        if (total <= 0) errors.push('El total debe ser mayor a 0');
        if (!estado) errors.push('Selecciona un estado');
        if (!metodoPago) errors.push('Selecciona un método de pago');
        if (pagado > total) errors.push('El monto pagado no puede ser mayor al total');

        if (errors.length > 0) {
            const msgDiv = document.getElementById('formMessageVenta');
            if (msgDiv) {
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:12px;border-radius:8px;">
                    <i class="fas fa-exclamation-circle"></i> ${errors.join('. ')}
                </div>`;
            }
            mostrarToast('❌ ' + errors.join('. '), 'error');
            return false;
        }

        const numero = await generarId('VEN');
        const cliente = obtenerClientePorIdVentas(clienteId);
        const clienteNombre = cliente ? cliente.nombre : 'N/A';

        const ventaRef = db.ref('ventas').push();
        await ventaRef.set({
            id: ventaRef.key,
            numero: numero,
            fecha: fecha,
            clienteId: clienteId,
            clienteNombre: clienteNombre,
            animalId: animalId,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            total: total,
            pagado: pagado,
            estado: estado,
            metodoPago: metodoPago,
            observaciones: observaciones,
            createdAt: Date.now(),
            createdBy: currentUser?.uid || '',
            createdByEmail: currentUser?.email || '',
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            updatedByEmail: currentUser?.email || ''
        });

        // Marcar animal como vendido
        try {
            await db.ref(`animales/${animalId}`).update({
                status: 'vendido',
                updatedAt: Date.now(),
                updatedBy: currentUser?.uid || '',
                updatedByEmail: currentUser?.email || ''
            });
        } catch (e) {
            console.warn('[ventas.js] No se pudo actualizar estado del animal:', e);
        }

        mostrarToast(`✅ Venta #${numero} registrada exitosamente`, 'success');
        renderizarVentas();
        return true;

    } catch (error) {
        console.error('[ventas.js] Error al guardar:', error);
        mostrarToast('❌ Error al guardar la venta: ' + error.message, 'error');
        return false;
    }
}

async function actualizarVentaDesdeFormulario() {
    console.log('[ventas.js] actualizarVentaDesdeFormulario() iniciado');

    const ventaId = document.getElementById('ventaIdEdit')?.value;
    if (!ventaId) {
        mostrarToast('❌ ID de venta no encontrado', 'error');
        return false;
    }

    if (!esAdminVentas()) {
        mostrarToast('⛔ No autorizado.', 'error');
        return false;
    }

    try {
        const fecha = document.getElementById('vFecha')?.value;
        const clienteId = document.getElementById('vCliente')?.value;
        const animalId = document.getElementById('vAnimal')?.value;
        const cantidad = parseFloat(document.getElementById('vCantidad')?.value) || 1;
        const precioUnitario = parseFloat(document.getElementById('vPrecioUnitario')?.value) || 0;
        const total = parseFloat(document.getElementById('vTotal')?.value) || 0;
        const pagado = parseFloat(document.getElementById('vPagado')?.value) || 0;
        const estado = document.getElementById('vEstado')?.value;
        const metodoPago = document.getElementById('vMetodoPago')?.value;
        const observaciones = document.getElementById('vObservaciones')?.value.trim() || '';

        const errors = [];
        if (!fecha) errors.push('La fecha es obligatoria');
        if (!clienteId) errors.push('Selecciona un cliente');
        if (!animalId) errors.push('Selecciona un animal');
        if (precioUnitario <= 0) errors.push('El precio unitario debe ser mayor a 0');
        if (total <= 0) errors.push('El total debe ser mayor a 0');
        if (pagado > total) errors.push('El monto pagado no puede ser mayor al total');

        if (errors.length > 0) {
            const msgDiv = document.getElementById('formMessageVenta');
            if (msgDiv) {
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = `<div style="background:var(--color-danger);color:white;padding:12px;border-radius:8px;">
                    <i class="fas fa-exclamation-circle"></i> ${errors.join('. ')}
                </div>`;
            }
            mostrarToast('❌ ' + errors.join('. '), 'error');
            return false;
        }

        const cliente = obtenerClientePorIdVentas(clienteId);
        const clienteNombre = cliente ? cliente.nombre : 'N/A';

        // Obtener animal anterior para restaurar estado si es necesario
        const ventaActual = ventasCache[ventaId];
        const animalAnterior = ventaActual?.animalId;

        await db.ref(`ventas/${ventaId}`).update({
            fecha: fecha,
            clienteId: clienteId,
            clienteNombre: clienteNombre,
            animalId: animalId,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            total: total,
            pagado: pagado,
            estado: estado,
            metodoPago: metodoPago,
            observaciones: observaciones,
            updatedAt: Date.now(),
            updatedBy: currentUser?.uid || '',
            updatedByEmail: currentUser?.email || ''
        });

        // Si cambió el animal, actualizar estados
        if (animalAnterior && animalAnterior !== animalId) {
            try {
                await db.ref(`animales/${animalAnterior}`).update({
                    status: 'activo',
                    updatedAt: Date.now()
                });
            } catch (e) {}
            try {
                await db.ref(`animales/${animalId}`).update({
                    status: 'vendido',
                    updatedAt: Date.now()
                });
            } catch (e) {}
        }

        mostrarToast(`✅ Venta #${ventaActual?.numero || 'N/A'} actualizada exitosamente`, 'success');
        renderizarVentas();
        return true;

    } catch (error) {
        console.error('[ventas.js] Error al actualizar:', error);
        mostrarToast('❌ Error al actualizar la venta: ' + error.message, 'error');
        return false;
    }
}

// ============================================================
// 7. VER DETALLE DE VENTA
// ============================================================

async function verDetalleVenta(ventaId) {
    try {
        const venta = ventasCache[ventaId];
        if (!venta) {
            mostrarToast('❌ Venta no encontrada', 'error');
            return;
        }

        const cliente = obtenerClientePorIdVentas(venta.clienteId);
        const animal = obtenerAnimalPorIdVentas(venta.animalId);
        const nombreCliente = cliente ? cliente.nombre : venta.clienteNombre || 'N/A';
        const nombreAnimal = animal ? `${animal.numero} - ${animal.nombre || 'Sin nombre'}` : venta.animalId || 'N/A';

        const html = `
            <div style="padding:10px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div style="background:var(--bg-primary);border-radius:8px;padding:16px;">
                        <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                            <i class="fas fa-shopping-cart"></i> Venta #${venta.numero}
                            <span class="badge" style="background:${COLORES_ESTADO[venta.estado] || '#3b82f6'};">${ICONOS_ESTADO[venta.estado] || '📋'} ${capitalize(venta.estado)}</span>
                        </h4>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.9rem;">
                            <div><strong>Fecha:</strong> ${formatearFecha(venta.fecha)}</div>
                            <div><strong>Cliente:</strong> ${escapeHTML(nombreCliente)}</div>
                            <div><strong>Animal:</strong> ${escapeHTML(nombreAnimal)}</div>
                            <div><strong>Cantidad:</strong> ${venta.cantidad || 1}</div>
                            <div><strong>Precio Unitario:</strong> ${formatearMoneda(venta.precioUnitario || 0)}</div>
                            <div><strong>Total:</strong> ${formatearMoneda(venta.total)}</div>
                            <div><strong>Pagado:</strong> ${formatearMoneda(venta.pagado || 0)}</div>
                            <div><strong>Pendiente:</strong> ${formatearMoneda((venta.total || 0) - (venta.pagado || 0))}</div>
                            <div><strong>Método Pago:</strong> ${ICONOS_PAGO[venta.metodoPago] || '💵'} ${capitalize(venta.metodoPago || 'efectivo')}</div>
                        </div>
                        ${venta.observaciones ? `
                            <div style="margin-top:12px;padding:8px;background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:0.85rem;">
                                <strong>Observaciones:</strong> ${escapeHTML(venta.observaciones)}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                    <button class="btn btn-secondary btn-sm" onclick="cerrarModal()">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                    ${esAdminVentas() ? `
                        <button class="btn btn-secondary btn-sm" onclick="abrirFormularioVenta('${ventaId}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        await mostrarModal(`📋 Detalle de Venta #${venta.numero}`, html, {
            confirmText: 'Cerrar',
            showConfirm: true,
            showCancel: false
        });

    } catch (error) {
        console.error('[ventas.js] Error al ver detalle:', error);
        mostrarToast('❌ Error al cargar detalle: ' + error.message, 'error');
    }
}

// ============================================================
// 8. ELIMINAR VENTA
// ============================================================

window.eliminarVenta = async function(ventaId) {
    if (!esAdminVentas()) {
        mostrarToast('⛔ No autorizado. Solo administradores.', 'error');
        return;
    }

    const venta = ventasCache[ventaId];
    if (!venta) {
        mostrarToast('❌ Venta no encontrada', 'error');
        return;
    }

    const html = `
        <div style="text-align:center;padding:20px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:12px;"></i>
            <p style="font-size:1.1rem;font-weight:500;">¿Estás seguro de eliminar esta venta?</p>
            <div style="background:var(--bg-primary);border-radius:8px;padding:16px;margin:16px 0;text-align:left;">
                <p><strong>Nº Venta:</strong> #${venta.numero}</p>
                <p><strong>Cliente:</strong> ${venta.clienteNombre || 'N/A'}</p>
                <p><strong>Total:</strong> ${formatearMoneda(venta.total)}</p>
                <p><strong>Estado:</strong> ${capitalize(venta.estado)}</p>
            </div>
            <p style="color:var(--text-danger);font-size:0.9rem;">⚠️ Esta acción no se puede deshacer. El animal volverá a estado activo.</p>
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
        // Restaurar animal a activo
        if (venta.animalId) {
            try {
                await db.ref(`animales/${venta.animalId}`).update({
                    status: 'activo',
                    updatedAt: Date.now()
                });
            } catch (e) {}
        }

        await db.ref(`ventas/${ventaId}`).remove();
        mostrarToast(`✅ Venta #${venta.numero} eliminada correctamente`, 'success');
        renderizarVentas();
    } catch (error) {
        console.error('[ventas.js] Error al eliminar:', error);
        mostrarToast('❌ Error al eliminar: ' + error.message, 'error');
    }
};

// ============================================================
// 9. EXPORTAR VENTAS
// ============================================================

function exportarVentasExcel() {
    const ventasLista = Object.values(ventasCache);
    if (ventasLista.length === 0) {
        mostrarToast('No hay ventas para exportar', 'warning');
        return;
    }

    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Nº Venta</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Animal</th>
            <th>Cantidad</th>
            <th>Precio Unitario</th>
            <th>Total</th>
            <th>Pagado</th>
            <th>Pendiente</th>
            <th>Estado</th>
            <th>Método Pago</th>
            <th>Observaciones</th>
        </tr>
    `;
    const tbody = document.createElement('tbody');
    ventasLista.forEach(v => {
        const cliente = obtenerClientePorIdVentas(v.clienteId);
        const animal = obtenerAnimalPorIdVentas(v.animalId);
        tbody.innerHTML += `
            <tr>
                <td>${v.numero || ''}</td>
                <td>${formatearFecha(v.fecha)}</td>
                <td>${cliente ? cliente.nombre : v.clienteNombre || ''}</td>
                <td>${animal ? animal.numero : v.animalId || ''}</td>
                <td>${v.cantidad || 1}</td>
                <td>${v.precioUnitario || 0}</td>
                <td>${v.total || 0}</td>
                <td>${v.pagado || 0}</td>
                <td>${(v.total || 0) - (v.pagado || 0)}</td>
                <td>${v.estado || ''}</td>
                <td>${v.metodoPago || ''}</td>
                <td>${v.observaciones || ''}</td>
            </tr>
        `;
    });
    tabla.appendChild(thead);
    tabla.appendChild(tbody);

    const nombreArchivo = `Ventas_${new Date().toISOString().split('T')[0]}`;
    exportarExcel(tabla, nombreArchivo);
}

// ============================================================
// 10. EXPOSICIÓN GLOBAL
// ============================================================

window.cargarVentas = cargarVentas;
window.abrirFormularioVenta = abrirFormularioVenta;
window.verDetalleVenta = verDetalleVenta;
window.eliminarVenta = window.eliminarVenta;
window.exportarVentasExcel = exportarVentasExcel;
window.aplicarFiltrosVentasYRenderizar = aplicarFiltrosVentasYRenderizar;
window.aplicarOrdenVentasYRenderizar = aplicarOrdenVentasYRenderizar;
window.cambiarOrdenVentasDireccion = cambiarOrdenVentasDireccion;
window.resetearFiltrosVentas = resetearFiltrosVentas;
window.obtenerNombreClienteVentas = obtenerNombreClienteVentas;
window.obtenerNumeroAnimalVentas = obtenerNumeroAnimalVentas;

console.log('[ventas.js] Módulo de ventas v1.2 cargado correctamente');