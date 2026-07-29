/**
 * reportes.js - Módulo avanzado de reportes y análisis
 * Sistema completo de generación de reportes con múltiples formatos y filtros
 * Versión 2.0 - PDF completamente funcional
 */

// ===== VARIABLES LOCALES =====
let reportesData = {
    animales: [],
    eventos: [],
    configuraciones: {}
};
let reportesFiltros = {
    categoria: 'todos',
    sexo: 'todos',
    estado: 'todos',
    corral: 'todos',
    raza: 'todos',
    fechaInicio: '',
    fechaFin: '',
    busqueda: ''
};
let reportesOrden = {
    campo: 'numero',
    direccion: 'asc'
};
let reportesVista = 'tabla';
let reportesGrafico = null;
let datosFiltradosGlobal = [];

// ===== CONSTANTES =====
const COLORES_GRAFICOS = [
    '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
];

// ===== INICIALIZAR MÓDULO =====
function cargarReportes() {
    console.log('[reportes.js] Inicializando módulo de reportes...');
    const container = document.getElementById('reportesContent');
    if (!container) {
        console.error('[reportes.js] Contenedor de reportes no encontrado');
        return;
    }

    if (!currentUser) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:40px;">
                <i class="fas fa-lock" style="font-size:3rem;color:var(--text-light);display:block;margin-bottom:16px;"></i>
                <h3>Acceso Restringido</h3>
                <p style="color:var(--text-secondary);">Debes iniciar sesión para acceder a los reportes.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;">
            <div class="loader" style="margin:20px auto;"></div>
            <p style="color:var(--text-secondary);">Cargando datos para reportes...</p>
        </div>
    `;

    cargarDatosReportes();
}

// ===== CARGAR DATOS =====
async function cargarDatosReportes() {
    try {
        const animalesSnap = await db.ref('animales').once('value');
        const animales = animalesSnap.val() || {};
        reportesData.animales = Object.values(animales).filter(a => a.status !== 'inactivo');

        const eventosSnap = await db.ref('eventos').once('value');
        const eventos = eventosSnap.val() || {};
        reportesData.eventos = Object.values(eventos);

        const configSnap = await db.ref('configuraciones').once('value');
        reportesData.configuraciones = configSnap.val() || {};

        renderizarReportes();
    } catch (error) {
        console.error('[reportes.js] Error cargando datos:', error);
        mostrarToast('❌ Error al cargar datos para reportes: ' + error.message, 'error');
        document.getElementById('reportesContent').innerHTML = `
            <div class="card" style="text-align:center;padding:40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-danger);display:block;margin-bottom:16px;"></i>
                <h3>Error al cargar datos</h3>
                <p style="color:var(--text-secondary);">${error.message}</p>
                <button class="btn btn-primary" onclick="cargarReportes()" style="margin-top:16px;">
                    <i class="fas fa-sync"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// ===== RENDERIZAR REPORTES =====
function renderizarReportes() {
    const container = document.getElementById('reportesContent');
    if (!container) return;

    const datosFiltrados = aplicarFiltros();
    datosFiltradosGlobal = datosFiltrados;
    const datosOrdenados = aplicarOrden(datosFiltrados);

    // Construir HTML
    const html = `
        <!-- Panel de filtros -->
        <div class="card" style="border-left:4px solid var(--color-primary);">
            <div class="card-header">
                <span class="card-title">🔍 Filtros y Configuración</span>
                <button class="btn btn-secondary btn-sm" onclick="resetearFiltros()">
                    <i class="fas fa-undo"></i> Resetear
                </button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
                <div class="form-group">
                    <label>Buscar</label>
                    <input type="text" id="filtroBusqueda" placeholder="ID, nombre..." value="${reportesFiltros.busqueda}" oninput="aplicarFiltrosYRenderizar()">
                </div>
                <div class="form-group">
                    <label>Categoría</label>
                    <select id="filtroCategoria" onchange="aplicarFiltrosYRenderizar()">
                        <option value="todos">Todas</option>
                        ${reportesData.configuraciones.categorias?.map(c => `
                            <option value="${c.nombre}" ${reportesFiltros.categoria === c.nombre ? 'selected' : ''}>${c.nombre}</option>
                        `).join('') || '<option value="todos">Sin categorías</option>'}
                    </select>
                </div>
                <div class="form-group">
                    <label>Sexo</label>
                    <select id="filtroSexo" onchange="aplicarFiltrosYRenderizar()">
                        <option value="todos">Todos</option>
                        <option value="Macho" ${reportesFiltros.sexo === 'Macho' ? 'selected' : ''}>♂️ Macho</option>
                        <option value="Hembra" ${reportesFiltros.sexo === 'Hembra' ? 'selected' : ''}>♀️ Hembra</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="filtroEstado" onchange="aplicarFiltrosYRenderizar()">
                        <option value="todos">Todos</option>
                        <option value="activo" ${reportesFiltros.estado === 'activo' ? 'selected' : ''}>Activo</option>
                        <option value="vendido" ${reportesFiltros.estado === 'vendido' ? 'selected' : ''}>Vendido</option>
                        <option value="muerto" ${reportesFiltros.estado === 'muerto' ? 'selected' : ''}>Muerto</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Corral</label>
                    <select id="filtroCorral" onchange="aplicarFiltrosYRenderizar()">
                        <option value="todos">Todos</option>
                        ${reportesData.configuraciones.corrales?.map(c => `
                            <option value="${c.nombre}" ${reportesFiltros.corral === c.nombre ? 'selected' : ''}>${c.nombre}</option>
                        `).join('') || '<option value="todos">Sin corrales</option>'}
                    </select>
                </div>
                <div class="form-group">
                    <label>Raza</label>
                    <select id="filtroRaza" onchange="aplicarFiltrosYRenderizar()">
                        <option value="todos">Todas</option>
                        ${reportesData.configuraciones.razas?.map(r => `
                            <option value="${r.nombre}" ${reportesFiltros.raza === r.nombre ? 'selected' : ''}>${r.nombre}</option>
                        `).join('') || '<option value="todos">Sin razas</option>'}
                    </select>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
                <div class="form-group">
                    <label>Fecha inicio</label>
                    <input type="date" id="filtroFechaInicio" value="${reportesFiltros.fechaInicio}" onchange="aplicarFiltrosYRenderizar()">
                </div>
                <div class="form-group">
                    <label>Fecha fin</label>
                    <input type="date" id="filtroFechaFin" value="${reportesFiltros.fechaFin}" onchange="aplicarFiltrosYRenderizar()">
                </div>
            </div>
        </div>

        <!-- Estadísticas -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px;">
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-primary);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-primary);">${datosOrdenados.length}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Total animales</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-success);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-success);">${datosOrdenados.filter(a => a.sexo === 'Hembra').length}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">♀️ Hembras</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-warning);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-warning);">${datosOrdenados.filter(a => a.sexo === 'Macho').length}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">♂️ Machos</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-purple);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-purple);">${datosOrdenados.filter(a => a.estadoReproductivo === 'Gestante').length}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Gestantes</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-info);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-info);">${datosOrdenados.filter(a => a.status === 'activo').length}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Activos</div>
            </div>
            <div class="card" style="text-align:center;padding:12px;border-left:4px solid var(--color-danger);">
                <div style="font-size:1.8rem;font-weight:700;color:var(--color-danger);">${datosOrdenados.filter(a => a.status !== 'activo').length}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">Inactivos</div>
            </div>
        </div>

        <!-- Barra de herramientas -->
        <div class="card">
            <div class="card-header">
                <span class="card-title">📋 Resultados (${datosOrdenados.length})</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="cambiarVista('tabla')" title="Vista tabla">
                        <i class="fas fa-table"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="cambiarVista('tarjetas')" title="Vista tarjetas">
                        <i class="fas fa-th-large"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="cambiarVista('grafico')" title="Vista gráfica">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    <select id="ordenCampo" onchange="aplicarOrdenYRenderizar()" style="padding:4px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;">
                        <option value="numero" ${reportesOrden.campo === 'numero' ? 'selected' : ''}>ID</option>
                        <option value="nombre" ${reportesOrden.campo === 'nombre' ? 'selected' : ''}>Nombre</option>
                        <option value="categoria" ${reportesOrden.campo === 'categoria' ? 'selected' : ''}>Categoría</option>
                        <option value="nacimiento" ${reportesOrden.campo === 'nacimiento' ? 'selected' : ''}>Nacimiento</option>
                        <option value="pesoActual" ${reportesOrden.campo === 'pesoActual' ? 'selected' : ''}>Peso</option>
                        <option value="createdAt" ${reportesOrden.campo === 'createdAt' ? 'selected' : ''}>Fecha registro</option>
                    </select>
                    <button class="btn btn-secondary btn-sm" onclick="cambiarOrdenDireccion()">
                        <i class="fas ${reportesOrden.direccion === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"></i>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="exportarExcelAvanzado()">
                        <i class="fas fa-file-excel"></i> Excel
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="exportarPDFAvanzado()">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="imprimirReporte()">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="exportarJSON()">
                        <i class="fas fa-file-code"></i> JSON
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="exportarCSV()">
                        <i class="fas fa-file-csv"></i> CSV
                    </button>
                </div>
            </div>
            <div id="vistaReportes">
                ${renderizarVista(datosOrdenados)}
            </div>
        </div>
    `;

    container.innerHTML = html;

    actualizarFiltrosDesdeDOM();

    if (reportesVista === 'grafico') {
        setTimeout(() => {
            renderizarGrafico(datosOrdenados);
        }, 300);
    }
}

// ===== ACTUALIZAR FILTROS DESDE DOM =====
function actualizarFiltrosDesdeDOM() {
    const busqueda = document.getElementById('filtroBusqueda');
    const categoria = document.getElementById('filtroCategoria');
    const sexo = document.getElementById('filtroSexo');
    const estado = document.getElementById('filtroEstado');
    const corral = document.getElementById('filtroCorral');
    const raza = document.getElementById('filtroRaza');
    const fechaInicio = document.getElementById('filtroFechaInicio');
    const fechaFin = document.getElementById('filtroFechaFin');

    if (busqueda) reportesFiltros.busqueda = busqueda.value;
    if (categoria) reportesFiltros.categoria = categoria.value;
    if (sexo) reportesFiltros.sexo = sexo.value;
    if (estado) reportesFiltros.estado = estado.value;
    if (corral) reportesFiltros.corral = corral.value;
    if (raza) reportesFiltros.raza = raza.value;
    if (fechaInicio) reportesFiltros.fechaInicio = fechaInicio.value;
    if (fechaFin) reportesFiltros.fechaFin = fechaFin.value;
}

// ===== APLICAR FILTROS =====
function aplicarFiltros() {
    let datos = [...reportesData.animales];

    if (reportesFiltros.busqueda) {
        const busq = reportesFiltros.busqueda.toLowerCase();
        datos = datos.filter(a =>
            (a.numero && a.numero.toLowerCase().includes(busq)) ||
            (a.nombre && a.nombre.toLowerCase().includes(busq)) ||
            (a.raza && a.raza.toLowerCase().includes(busq)) ||
            (a.corral && a.corral.toLowerCase().includes(busq)) ||
            (a.categoria && a.categoria.toLowerCase().includes(busq))
        );
    }

    if (reportesFiltros.categoria !== 'todos') {
        datos = datos.filter(a => a.categoria === reportesFiltros.categoria);
    }

    if (reportesFiltros.sexo !== 'todos') {
        datos = datos.filter(a => a.sexo === reportesFiltros.sexo);
    }

    if (reportesFiltros.estado !== 'todos') {
        datos = datos.filter(a => a.status === reportesFiltros.estado);
    }

    if (reportesFiltros.corral !== 'todos') {
        datos = datos.filter(a => a.corral === reportesFiltros.corral);
    }

    if (reportesFiltros.raza !== 'todos') {
        datos = datos.filter(a => a.raza === reportesFiltros.raza);
    }

    if (reportesFiltros.fechaInicio) {
        const fechaInicio = new Date(reportesFiltros.fechaInicio);
        datos = datos.filter(a => {
            if (!a.nacimiento) return true;
            return new Date(a.nacimiento) >= fechaInicio;
        });
    }
    if (reportesFiltros.fechaFin) {
        const fechaFin = new Date(reportesFiltros.fechaFin);
        datos = datos.filter(a => {
            if (!a.nacimiento) return true;
            return new Date(a.nacimiento) <= fechaFin;
        });
    }

    datosFiltradosGlobal = datos;
    return datos;
}

// ===== APLICAR ORDEN =====
function aplicarOrden(datos) {
    const campo = reportesOrden.campo;
    const direccion = reportesOrden.direccion;

    return datos.sort((a, b) => {
        let valA = a[campo] || '';
        let valB = b[campo] || '';

        if (campo === 'pesoActual' || campo === 'createdAt' || campo === 'nacimiento') {
            valA = valA || 0;
            valB = valB || 0;
            return direccion === 'asc' ? valA - valB : valB - valA;
        }

        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        return direccion === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
}

// ===== RENDERIZAR VISTA =====
function renderizarVista(datos) {
    switch (reportesVista) {
        case 'tarjetas':
            return renderizarTarjetas(datos);
        case 'grafico':
            return renderizarGraficoVista(datos);
        default:
            return renderizarTabla(datos);
    }
}

// ===== RENDERIZAR TABLA =====
function renderizarTabla(datos) {
    if (datos.length === 0) {
        return `
            <div style="text-align:center;padding:40px;color:var(--text-light);">
                <i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:10px;"></i>
                No se encontraron animales con los filtros aplicados
            </div>
        `;
    }

    const pesos = datos.filter(a => a.pesoActual && a.pesoActual > 0);
    const pesoPromedio = pesos.length > 0 ? 
        (pesos.reduce((sum, a) => sum + a.pesoActual, 0) / pesos.length).toFixed(1) : 
        'N/A';

    return `
        <div style="margin-bottom:12px;display:flex;gap:16px;flex-wrap:wrap;font-size:0.9rem;color:var(--text-secondary);">
            <span>📊 Peso promedio: <strong>${pesoPromedio} kg</strong></span>
            <span>📋 Total registros: <strong>${datos.length}</strong></span>
        </div>
        <div class="table-responsive" id="tablaReportes">
            <table>
                <thead>
                    <tr>
                        <th onclick="ordenarPor('numero')" style="cursor:pointer;">ID ↕</th>
                        <th onclick="ordenarPor('nombre')" style="cursor:pointer;">Nombre ↕</th>
                        <th onclick="ordenarPor('categoria')" style="cursor:pointer;">Categoría ↕</th>
                        <th>Sexo</th>
                        <th onclick="ordenarPor('raza')" style="cursor:pointer;">Raza ↕</th>
                        <th>Color</th>
                        <th>Estado</th>
                        <th onclick="ordenarPor('corral')" style="cursor:pointer;">Corral ↕</th>
                        <th>Reproductivo</th>
                        <th onclick="ordenarPor('nacimiento')" style="cursor:pointer;">Edad ↕</th>
                        <th onclick="ordenarPor('pesoActual')" style="cursor:pointer;">Peso (kg) ↕</th>
                    </tr>
                </thead>
                <tbody>
                    ${datos.map(a => `
                        <tr>
                            <td><strong style="color:var(--color-primary);">${a.numero}</strong></td>
                            <td>${a.nombre || '-'}</td>
                            <td><span class="badge">${a.categoria || '-'}</span></td>
                            <td>${a.sexo === 'Macho' ? '♂️' : '♀️'} ${a.sexo || '-'}</td>
                            <td>${a.raza || '-'}</td>
                            <td>${a.color || '-'}</td>
                            <td><span class="badge ${a.status === 'activo' ? 'badge-success' : a.status === 'vendido' ? 'badge-warning' : 'badge-danger'}">${a.status || '-'}</span></td>
                            <td>${a.corral || '-'}</td>
                            <td><span class="badge badge-purple">${a.estadoReproductivo || '-'}</span></td>
                            <td>${calcularEdad(a.nacimiento)}</td>
                            <td>${a.pesoActual ? a.pesoActual + ' kg' : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ===== RENDERIZAR TARJETAS =====
function renderizarTarjetas(datos) {
    if (datos.length === 0) {
        return `
            <div style="text-align:center;padding:40px;color:var(--text-light);">
                <i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:10px;"></i>
                No se encontraron animales con los filtros aplicados
            </div>
        `;
    }

    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;">
            ${datos.map(a => `
                <div class="card" style="padding:16px;border-left:4px solid ${a.status === 'activo' ? 'var(--color-success)' : 'var(--color-danger)'};">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                        ${a.fotoPrincipal ? 
                            `<img src="${a.fotoPrincipal}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">` :
                            `<div style="width:50px;height:50px;border-radius:50%;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🐖</div>`
                        }
                        <div>
                            <div style="font-weight:700;color:var(--color-primary);">${a.numero}</div>
                            <div style="font-size:0.9rem;">${a.nombre || 'Sin nombre'}</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:0.85rem;">
                        <div><strong>Categoría:</strong> ${a.categoria || '-'}</div>
                        <div><strong>Sexo:</strong> ${a.sexo || '-'}</div>
                        <div><strong>Raza:</strong> ${a.raza || '-'}</div>
                        <div><strong>Color:</strong> ${a.color || '-'}</div>
                        <div><strong>Corral:</strong> ${a.corral || '-'}</div>
                        <div><strong>Peso:</strong> ${a.pesoActual ? a.pesoActual + ' kg' : '-'}</div>
                        <div><strong>Edad:</strong> ${calcularEdad(a.nacimiento)}</div>
                        <div><strong>Estado:</strong> <span class="badge ${a.status === 'activo' ? 'badge-success' : 'badge-danger'}">${a.status || '-'}</span></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ===== RENDERIZAR GRÁFICO =====
function renderizarGraficoVista(datos) {
    return `
        <div style="text-align:center;padding:10px;">
            <canvas id="graficoReportes" style="max-height:400px;width:100%;"></canvas>
        </div>
    `;
}

// ===== RENDERIZAR GRÁFICO =====
function renderizarGrafico(datos) {
    const canvas = document.getElementById('graficoReportes');
    if (!canvas) return;

    if (reportesGrafico) {
        reportesGrafico.destroy();
        reportesGrafico = null;
    }

    const categorias = {};
    datos.forEach(a => {
        const cat = a.categoria || 'Sin categoría';
        categorias[cat] = (categorias[cat] || 0) + 1;
    });

    const labels = Object.keys(categorias);
    const values = Object.values(categorias);

    const ctx = canvas.getContext('2d');
    reportesGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distribución por categoría',
                data: values,
                backgroundColor: labels.map((_, i) => COLORES_GRAFICOS[i % COLORES_GRAFICOS.length]),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const porcentaje = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
                            return `${context.parsed.y} animales (${porcentaje}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// ===== CAMBIAR VISTA =====
function cambiarVista(vista) {
    reportesVista = vista;
    aplicarFiltrosYRenderizar();
}

// ===== ORDENAR POR =====
function ordenarPor(campo) {
    if (reportesOrden.campo === campo) {
        reportesOrden.direccion = reportesOrden.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        reportesOrden.campo = campo;
        reportesOrden.direccion = 'asc';
    }
    aplicarOrdenYRenderizar();
}

// ===== CAMBIAR DIRECCIÓN DE ORDEN =====
function cambiarOrdenDireccion() {
    reportesOrden.direccion = reportesOrden.direccion === 'asc' ? 'desc' : 'asc';
    aplicarOrdenYRenderizar();
}

// ===== APLICAR FILTROS Y RENDERIZAR =====
function aplicarFiltrosYRenderizar() {
    actualizarFiltrosDesdeDOM();
    renderizarReportes();
}

// ===== APLICAR ORDEN Y RENDERIZAR =====
function aplicarOrdenYRenderizar() {
    const container = document.getElementById('reportesContent');
    if (!container) return;

    const datosFiltrados = aplicarFiltros();
    const datosOrdenados = aplicarOrden(datosFiltrados);

    const vistaContainer = document.getElementById('vistaReportes');
    if (vistaContainer) {
        vistaContainer.innerHTML = renderizarVista(datosOrdenados);
        if (reportesVista === 'grafico') {
            setTimeout(() => {
                renderizarGrafico(datosOrdenados);
            }, 300);
        }
    }

    // Actualizar estadísticas
    actualizarEstadisticas(datosOrdenados);
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarEstadisticas(datos) {
    // Esta función se puede expandir para actualizar solo las estadísticas
    // sin recargar toda la página
}

// ===== RESETEAR FILTROS =====
function resetearFiltros() {
    reportesFiltros = {
        categoria: 'todos',
        sexo: 'todos',
        estado: 'todos',
        corral: 'todos',
        raza: 'todos',
        fechaInicio: '',
        fechaFin: '',
        busqueda: ''
    };
    reportesOrden = {
        campo: 'numero',
        direccion: 'asc'
    };
    renderizarReportes();
}

// ===== EXPORTAR EXCEL AVANZADO =====
function exportarExcelAvanzado() {
    const datos = aplicarOrden(aplicarFiltros());
    if (datos.length === 0) {
        mostrarToast('No hay datos para exportar', 'warning');
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
            <th>Edad</th>
            <th>Peso (kg)</th>
            <th>Origen</th>
            <th>Proveedor</th>
            <th>Madre</th>
            <th>Padre</th>
            <th>Observaciones</th>
        </tr>
    `;
    const tbody = document.createElement('tbody');
    datos.forEach(a => {
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
                <td>${calcularEdad(a.nacimiento)}</td>
                <td>${a.pesoActual || ''}</td>
                <td>${a.origen || ''}</td>
                <td>${a.proveedor || ''}</td>
                <td>${a.madre || ''}</td>
                <td>${a.padre || ''}</td>
                <td>${a.observaciones || ''}</td>
            </tr>
        `;
    });
    tabla.appendChild(thead);
    tabla.appendChild(tbody);

    const nombreArchivo = `Reporte_Granja_${new Date().toISOString().split('T')[0]}`;
    exportarExcel(tabla, nombreArchivo);
}

// ===== EXPORTAR PDF AVANZADO (CORREGIDO) =====
async function exportarPDFAvanzado() {
    const datos = aplicarOrden(aplicarFiltros());
    if (datos.length === 0) {
        mostrarToast('No hay datos para exportar', 'warning');
        return;
    }

    try {
        mostrarToast('📄 Generando PDF...', 'info');

        // Obtener la tabla actual
        const tablaElement = document.querySelector('#tablaReportes table');
        if (!tablaElement) {
            mostrarToast('No se encontró la tabla para exportar', 'error');
            return;
        }

        // Crear contenedor para el PDF
        const container = document.createElement('div');
        container.style.cssText = `
            padding: 30px;
            font-family: 'Arial', sans-serif;
            background: #ffffff;
            color: #000000;
            max-width: 1000px;
            margin: 0 auto;
        `;

        // Título
        container.innerHTML = `
            <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #3b82f6;padding-bottom:15px;">
                <h1 style="color:#3b82f6;font-size:24px;margin:0;">🐖 Reporte de Animales - Granja Porcina</h1>
                <p style="color:#666;font-size:14px;margin:5px 0;">
                    Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                <p style="color:#666;font-size:12px;margin:0;">
                    Total de registros: <strong>${datos.length}</strong> | Filtros aplicados: ${reportesFiltros.busqueda || 'Ninguno'}
                </p>
                <p style="color:#999;font-size:11px;margin-top:5px;">
                    ${reportesFiltros.categoria !== 'todos' ? `Categoría: ${reportesFiltros.categoria} | ` : ''}
                    ${reportesFiltros.sexo !== 'todos' ? `Sexo: ${reportesFiltros.sexo} | ` : ''}
                    ${reportesFiltros.estado !== 'todos' ? `Estado: ${reportesFiltros.estado}` : ''}
                </p>
            </div>
        `;

        // Clonar la tabla y estilizarla
        const tablaClone = tablaElement.cloneNode(true);
        tablaClone.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 10px;
        `;
        
        // Estilizar celdas de la tabla clonada
        const ths = tablaClone.querySelectorAll('th');
        ths.forEach(th => {
            th.style.cssText = `
                background: #3b82f6;
                color: white;
                padding: 8px 10px;
                text-align: left;
                font-weight: bold;
            `;
        });

        const tds = tablaClone.querySelectorAll('td');
        tds.forEach(td => {
            td.style.cssText = `
                padding: 6px 10px;
                border-bottom: 1px solid #e5e7eb;
            `;
        });

        // Añadir colores a los badges
        const badges = tablaClone.querySelectorAll('.badge');
        badges.forEach(badge => {
            const text = badge.textContent;
            badge.style.cssText = `
                display: inline-block;
                padding: 1px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: bold;
                color: white;
            `;
            if (text === 'activo' || text === 'Activo') {
                badge.style.background = '#22c55e';
            } else if (text === 'vendido' || text === 'Vendido') {
                badge.style.background = '#f59e0b';
            } else if (text === 'muerto' || text === 'Muerto') {
                badge.style.background = '#ef4444';
            } else if (text === 'Gestante' || text === 'gestante') {
                badge.style.background = '#8b5cf6';
            } else {
                badge.style.background = '#3b82f6';
            }
        });

        container.appendChild(tablaClone);

        // Pie de página
        const footer = document.createElement('div');
        footer.style.cssText = `
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 10px;
            color: #999;
        `;
        footer.innerHTML = `
            Reporte generado automáticamente desde Sistema de Gestión de Granja Porcina<br>
            ${new Date().toLocaleString('es-ES')}
        `;
        container.appendChild(footer);

        // Añadir el contenedor al DOM temporalmente
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;';
        tempDiv.appendChild(container);
        document.body.appendChild(tempDiv);

        // Generar PDF
        const nombreArchivo = `Reporte_Granja_${new Date().toISOString().split('T')[0]}`;
        await exportarPDF(container, nombreArchivo);

        // Limpiar
        document.body.removeChild(tempDiv);
        mostrarToast('✅ PDF exportado correctamente', 'success');

    } catch (error) {
        console.error('[reportes.js] Error exportando PDF:', error);
        mostrarToast('❌ Error al exportar PDF: ' + error.message, 'error');
    }
}

// ===== IMPRIMIR REPORTE =====
function imprimirReporte() {
    const datos = aplicarOrden(aplicarFiltros());
    if (datos.length === 0) {
        mostrarToast('No hay datos para imprimir', 'warning');
        return;
    }

    const tablaElement = document.querySelector('#tablaReportes table');
    if (!tablaElement) {
        mostrarToast('No se encontró la tabla para imprimir', 'error');
        return;
    }

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
            <head>
                <title>Reporte de Animales - Granja Porcina</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; max-width: 1000px; margin: 0 auto; }
                    h1 { color: #3b82f6; text-align: center; font-size: 24px; }
                    .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
                    .header p { color: #666; margin: 5px 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
                    th { background: #3b82f6; color: white; padding: 8px 10px; text-align: left; font-weight: bold; }
                    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
                    .badge { display: inline-block; padding: 1px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; color: white; }
                    .badge-success { background: #22c55e; }
                    .badge-warning { background: #f59e0b; }
                    .badge-danger { background: #ef4444; }
                    .badge-purple { background: #8b5cf6; }
                    .badge-primary { background: #3b82f6; }
                    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #999; }
                    @media print {
                        .no-print { display: none; }
                        body { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🐖 Reporte de Animales - Granja Porcina</h1>
                    <p>Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    <p>Total de registros: <strong>${datos.length}</strong></p>
                </div>
                ${tablaElement.outerHTML}
                <div class="footer">
                    Reporte generado automáticamente desde Sistema de Gestión de Granja Porcina<br>
                    ${new Date().toLocaleString('es-ES')}
                </div>
                <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:5px;cursor:pointer;">
                    🖨️ Imprimir
                </button>
            </body>
        </html>
    `);
    ventana.document.close();
}

// ===== EXPORTAR JSON =====
function exportarJSON() {
    const datos = aplicarOrden(aplicarFiltros());
    if (datos.length === 0) {
        mostrarToast('No hay datos para exportar', 'warning');
        return;
    }

    const json = JSON.stringify(datos, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Granja_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('✅ JSON exportado correctamente', 'success');
}

// ===== EXPORTAR CSV =====
function exportarCSV() {
    const datos = aplicarOrden(aplicarFiltros());
    if (datos.length === 0) {
        mostrarToast('No hay datos para exportar', 'warning');
        return;
    }

    const headers = ['ID', 'Nombre', 'Categoría', 'Sexo', 'Raza', 'Color', 'Estado', 'Corral', 'Lote', 'Estado Reproductivo', 'Fecha Nacimiento', 'Peso (kg)'];
    let csv = headers.join(',') + '\n';

    datos.forEach(a => {
        const row = [
            a.numero || '',
            a.nombre || '',
            a.categoria || '',
            a.sexo || '',
            a.raza || '',
            a.color || '',
            a.status || '',
            a.corral || '',
            a.lote || '',
            a.estadoReproductivo || '',
            a.nacimiento || '',
            a.pesoActual || ''
        ];
        csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Granja_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('✅ CSV exportado correctamente', 'success');
}

// ===== EXPOSICIÓN GLOBAL =====
window.cargarReportes = cargarReportes;
window.aplicarFiltrosYRenderizar = aplicarFiltrosYRenderizar;
window.aplicarOrdenYRenderizar = aplicarOrdenYRenderizar;
window.resetearFiltros = resetearFiltros;
window.cambiarVista = cambiarVista;
window.ordenarPor = ordenarPor;
window.cambiarOrdenDireccion = cambiarOrdenDireccion;
window.exportarExcelAvanzado = exportarExcelAvanzado;
window.exportarPDFAvanzado = exportarPDFAvanzado;
window.imprimirReporte = imprimirReporte;
window.exportarJSON = exportarJSON;
window.exportarCSV = exportarCSV;

console.log('[reportes.js] Módulo cargado correctamente');