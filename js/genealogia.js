/**
 * genealogia.js - Módulo de Árbol Genealógico
 * Visualización interactiva del linaje de los animales
 * Versión 1.2 - Corregido con obtenerAnimalPorId
 */

// ===== VARIABLES LOCALES =====
let genealogiaData = {
    animalSeleccionado: null,
    arbol: null,
    nivelMaximo: 5,
    cargando: false
};

// ===== CARGAR VISTA DE GENEALOGÍA =====
function cargarGenealogia() {
    console.log('[genealogia.js] Cargando módulo de genealogía...');
    const container = document.getElementById('genealogiaContent');
    if (!container) {
        console.error('[genealogia.js] Contenedor no encontrado');
        return;
    }

    // Mostrar loader mientras se cargan los datos
    container.innerHTML = `
        <div class="card" style="text-align:center;padding:60px;">
            <div class="loader" style="margin:20px auto;"></div>
            <p style="color:var(--text-secondary);">Cargando animales...</p>
        </div>
    `;

    // Esperar a que los animales estén cargados
    if (!animalesCache || Object.keys(animalesCache).length === 0) {
        console.log('[genealogia.js] Esperando carga de animales...');
        if (typeof window.cargarAnimales === 'function') {
            window.cargarAnimales();
        }
        // Reintentar después de un tiempo
        setTimeout(() => {
            if (animalesCache && Object.keys(animalesCache).length > 0) {
                renderizarGenealogia();
            } else {
                container.innerHTML = `
                    <div class="card" style="text-align:center;padding:40px;border:2px dashed var(--color-warning);">
                        <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-warning);display:block;margin-bottom:16px;"></i>
                        <h3>No hay animales disponibles</h3>
                        <p style="color:var(--text-secondary);">Registra animales en el módulo de Animales para ver el árbol genealógico.</p>
                        <button class="btn btn-primary" onclick="mostrarVista('animales')">
                            <i class="fas fa-plus"></i> Ir a Animales
                        </button>
                    </div>
                `;
            }
        }, 1500);
        return;
    }

    renderizarGenealogia();
}

// ===== RENDERIZAR GENEALOGÍA =====
function renderizarGenealogia() {
    const container = document.getElementById('genealogiaContent');
    if (!container) return;

    const animales = Object.values(animalesCache).filter(a => a.status === 'activo');
    
    if (animales.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:60px;">
                <i class="fas fa-tree" style="font-size:3rem;color:var(--text-light);display:block;margin-bottom:16px;"></i>
                <h3>No hay animales registrados</h3>
                <p style="color:var(--text-secondary);">Registra animales para comenzar a construir el árbol genealógico.</p>
                <button class="btn btn-primary" onclick="mostrarVista('animales')">
                    <i class="fas fa-plus"></i> Ir a Animales
                </button>
            </div>
        `;
        return;
    }

    const conPadres = animales.filter(a => a.padre || a.madre);
    const mensajePadres = conPadres.length > 0 ? 
        `<span class="badge badge-success">${conPadres.length} con padres registrados</span>` :
        `<span class="badge badge-warning">Sin relaciones familiares aún</span>`;

    container.innerHTML = `
        <div class="card" style="border-left:4px solid var(--color-primary);">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-tree"></i> Árbol Genealógico</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="expandirTodo()">
                        <i class="fas fa-expand"></i> Expandir todo
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="colapsarTodo()">
                        <i class="fas fa-compress"></i> Colapsar todo
                    </button>
                    <button class="btn btn-success btn-sm" onclick="exportarGenealogia()" id="btnExportarGenealogia" disabled>
                        <i class="fas fa-download"></i> Exportar
                    </button>
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group">
                    <label>Seleccionar animal raíz</label>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <select id="selectAnimalGenealogia" style="flex:1;min-width:200px;padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);">
                            <option value="">-- Seleccionar animal --</option>
                            ${animales.map(a => `
                                <option value="${a.id}">${a.numero} - ${a.nombre || 'Sin nombre'} (${a.categoria || 'N/A'}) ${a.padre || a.madre ? '👪' : ''}</option>
                            `).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="cargarArbolGenealogia()">
                            <i class="fas fa-sitemap"></i> Ver árbol
                        </button>
                    </div>
                    <small style="color:var(--text-light);">Selecciona un animal para ver su árbol genealógico completo</small>
                </div>
                <div style="display:flex;align-items:center;gap:12px;padding:8px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                    <span style="font-weight:500;">📊 Estadísticas:</span>
                    <span><strong>${animales.length}</strong> animales</span>
                    ${mensajePadres}
                    <span class="badge badge-outline">Máx. ${genealogiaData.nivelMaximo} niveles</span>
                </div>
            </div>
        </div>
        
        <div id="arbolGenealogiaContainer">
            <div class="card" style="text-align:center;padding:60px;border:2px dashed var(--border-color);">
                <i class="fas fa-sitemap" style="font-size:4rem;color:var(--text-light);display:block;margin-bottom:16px;"></i>
                <h3 style="color:var(--text-secondary);">Selecciona un animal para ver su árbol genealógico</h3>
                <p style="color:var(--text-light);">El árbol mostrará padres, abuelos y ascendientes</p>
                <p style="color:var(--text-light);font-size:0.8rem;margin-top:8px;">
                    <i class="fas fa-info-circle"></i> Los animales sin padres registrados no mostrarán ascendientes
                </p>
            </div>
        </div>
    `;

    const btnExportar = document.getElementById('btnExportarGenealogia');
    if (btnExportar) {
        btnExportar.disabled = true;
    }

    document.getElementById('selectAnimalGenealogia').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            cargarArbolGenealogia();
        }
    });
}

// ===== OBTENER ANIMAL POR ID (USANDO LA FUNCIÓN GLOBAL) =====
function obtenerAnimalGenealogia(id) {
    // Usar la función global de animales.js si existe
    if (typeof window.obtenerAnimalPorId === 'function') {
        return window.obtenerAnimalPorId(id);
    }
    
    // Fallback: buscar en animalesCache
    if (animalesCache[id]) {
        return animalesCache[id];
    }
    
    // Buscar por número
    const animal = Object.values(animalesCache).find(a => a.numero === id || a.id === id);
    return animal || null;
}

// ===== CARGAR ÁRBOL GENEALÓGICO =====
async function cargarArbolGenealogia() {
    const select = document.getElementById('selectAnimalGenealogia');
    const animalId = select.value;
    
    if (!animalId) {
        mostrarToast('⚠️ Selecciona un animal para ver su árbol', 'warning');
        select.focus();
        return;
    }

    console.log('[genealogia.js] Buscando animal con ID:', animalId);
    console.log('[genealogia.js] animalesCache keys:', Object.keys(animalesCache));

    // Buscar el animal usando la función auxiliar
    const animal = obtenerAnimalGenealogia(animalId);
    
    if (!animal) {
        console.error('[genealogia.js] Animal no encontrado para ID:', animalId);
        mostrarToast('❌ Animal no encontrado. Verifica que exista en la base de datos.', 'error');
        return;
    }

    console.log('[genealogia.js] Animal encontrado:', animal.numero, animal.nombre);

    mostrarToast('🌳 Cargando árbol genealógico de ' + (animal.nombre || animal.numero) + '...', 'info');

    try {
        const arbol = await construirArbolGenealogico(animal.id, 0);
        genealogiaData.animalSeleccionado = animal;
        genealogiaData.arbol = arbol;
        
        const btnExportar = document.getElementById('btnExportarGenealogia');
        if (btnExportar) {
            btnExportar.disabled = false;
        }
        
        renderizarArbolGenealogico(arbol, animal);
    } catch (error) {
        console.error('[genealogia.js] Error al construir árbol:', error);
        mostrarToast('❌ Error al cargar el árbol: ' + error.message, 'error');
    }
}

// ===== CONSTRUIR ÁRBOL GENEALÓGICO =====
async function construirArbolGenealogico(animalId, nivel) {
    if (nivel > genealogiaData.nivelMaximo) {
        return null;
    }

    // Usar la función auxiliar para obtener el animal
    const animal = obtenerAnimalGenealogia(animalId);
    if (!animal) {
        console.log('[genealogia.js] Animal no encontrado en nivel', nivel, 'ID:', animalId);
        return null;
    }

    const nodo = {
        id: animal.id,
        numero: animal.numero,
        nombre: animal.nombre || 'Sin nombre',
        sexo: animal.sexo || 'N/A',
        categoria: animal.categoria || 'N/A',
        raza: animal.raza || 'N/A',
        foto: animal.fotoPrincipal || null,
        nivel: nivel,
        padre: null,
        madre: null,
        tieneDescendientes: false
    };

    // Buscar padre
    if (animal.padre) {
        const padre = obtenerAnimalGenealogia(animal.padre);
        if (padre && padre.status === 'activo') {
            nodo.padre = await construirArbolGenealogico(animal.padre, nivel + 1);
        } else {
            console.log('[genealogia.js] Padre no encontrado o inactivo:', animal.padre);
        }
    }

    // Buscar madre
    if (animal.madre) {
        const madre = obtenerAnimalGenealogia(animal.madre);
        if (madre && madre.status === 'activo') {
            nodo.madre = await construirArbolGenealogico(animal.madre, nivel + 1);
        } else {
            console.log('[genealogia.js] Madre no encontrada o inactiva:', animal.madre);
        }
    }

    // Verificar si tiene descendientes
    const descendientes = Object.values(animalesCache).filter(a => 
        a.status === 'activo' && (a.padre === animal.id || a.madre === animal.id)
    );
    nodo.tieneDescendientes = descendientes.length > 0;

    return nodo;
}

// ===== RENDERIZAR ÁRBOL GENEALÓGICO =====
function renderizarArbolGenealogico(arbol, animal) {
    const container = document.getElementById('arbolGenealogiaContainer');
    if (!container) return;

    if (!arbol) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-warning);display:block;margin-bottom:16px;"></i>
                <h3>No se encontró información genealógica</h3>
                <p style="color:var(--text-secondary);">El animal ${animal.numero} - ${animal.nombre || 'Sin nombre'} no tiene padres registrados.</p>
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px;">
                    <button class="btn btn-primary" onclick="editarAnimalParaGenealogia('${animal.id}')">
                        <i class="fas fa-edit"></i> Registrar padres
                    </button>
                    <button class="btn btn-secondary" onclick="cargarArbolGenealogia()">
                        <i class="fas fa-sync"></i> Reintentar
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const totalNodos = contarNodos(arbol);
    const niveles = calcularNiveles(arbol);

    const html = `
        <div class="card" style="overflow-x:auto;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
                <div>
                    <h3 style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <i class="fas fa-${animal.sexo === 'Macho' ? 'mars' : 'venus'}" 
                           style="color:${animal.sexo === 'Macho' ? 'var(--color-primary)' : 'var(--color-pink)'};"></i>
                        ${animal.numero} - ${animal.nombre || 'Sin nombre'}
                        <span class="badge badge-purple">${animal.categoria || 'N/A'}</span>
                        <span class="badge badge-outline">${animal.raza || 'N/A'}</span>
                        <span class="badge badge-success">${totalNodos} nodos</span>
                        <span class="badge badge-info">${niveles} niveles</span>
                    </h3>
                    <p style="color:var(--text-secondary);font-size:0.9rem;">
                        <i class="fas fa-arrow-up"></i> Ascendientes: ${totalNodos - 1}
                    </p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-primary btn-sm" onclick="editarAnimalParaGenealogia('${animal.id}')">
                        <i class="fas fa-edit"></i> Editar padres
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="expandirTodo()">
                        <i class="fas fa-expand"></i> Expandir
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="colapsarTodo()">
                        <i class="fas fa-compress"></i> Colapsar
                    </button>
                </div>
            </div>
            
            <div class="arbol-genealogico" id="arbolGenealogico" style="min-width:300px;">
                ${renderizarNodo(arbol, 0)}
            </div>
            
            <div style="margin-top:16px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-secondary);display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
                <div><i class="fas fa-info-circle"></i> <strong>Leyenda:</strong></div>
                <span style="color:var(--color-primary);">■ Macho</span>
                <span style="color:var(--color-pink);">■ Hembra</span>
                <span style="color:var(--color-success);">■ Animal seleccionado</span>
                <span>👪 Tiene descendientes</span>
                <span style="font-size:0.7rem;color:var(--text-light);">Click en cualquier nodo para ver detalle</span>
            </div>
        </div>
    `;

    container.innerHTML = html;
    aplicarEstilosArbol();
}

// ===== RENDERIZAR NODO =====
function renderizarNodo(nodo, nivel) {
    if (!nodo) return '';

    const color = nodo.sexo === 'Macho' ? 'var(--color-primary)' : 'var(--color-pink)';
    const isRaiz = nivel === 0;
    const esMiembro = nodo.id === genealogiaData.animalSeleccionado?.id;
    const tieneDescendientes = nodo.tieneDescendientes;

    let html = `
        <div class="nodo-genealogico" data-nivel="${nivel}" data-id="${nodo.id}" style="position:relative;padding:4px;margin:2px 0;">
            <div class="nodo-contenido" style="
                display:inline-flex;
                align-items:center;
                gap:6px;
                padding:6px 12px;
                background: ${esMiembro ? 'var(--color-success)' : 'var(--bg-secondary)'};
                color: ${esMiembro ? 'white' : 'var(--text-primary)'};
                border: 2px solid ${esMiembro ? 'var(--color-success)' : color};
                border-radius: var(--radius-sm);
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: ${esMiembro ? '0 4px 12px rgba(34,197,94,0.3)' : 'var(--shadow-sm)'};
                ${isRaiz ? 'font-weight:700;' : ''}
                font-size: 0.85rem;
            " 
            onclick="verDetalleAnimal('${nodo.id}')"
            onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='var(--shadow-lg)';"
            onmouseout="this.style.transform='scale(1)';this.style.boxShadow='${esMiembro ? '0 4px 12px rgba(34,197,94,0.3)' : 'var(--shadow-sm)'}';"
            title="Haz clic para ver detalle">
                ${nodo.foto ? 
                    `<img src="${nodo.foto}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid ${color};" alt="${nodo.numero}">` :
                    `<span style="font-size:1rem;">${nodo.sexo === 'Macho' ? '🐗' : '🐖'}</span>`
                }
                <span style="font-weight:600;">${nodo.numero}</span>
                <span style="font-size:0.7rem;opacity:0.8;">${nodo.nombre || ''}</span>
                <span class="badge" style="font-size:0.55rem;background:${color};color:white;padding:1px 6px;">${nodo.sexo}</span>
                ${tieneDescendientes ? '<span style="font-size:0.7rem;">👪</span>' : ''}
                ${esMiembro ? '<span style="font-size:0.55rem;background:white;color:var(--color-success);padding:0 6px;border-radius:10px;font-weight:700;">RAÍZ</span>' : ''}
                ${nivel > 0 ? `<span style="font-size:0.55rem;color:var(--text-light);">N${nivel}</span>` : ''}
            </div>
            
            <div class="nodo-hijos" style="display:flex;flex-direction:column;padding-left:30px;border-left:2px dashed ${color}30;margin-left:15px;position:relative;">
                ${nodo.padre || nodo.madre ? `<div style="position:absolute;left:-16px;top:0;width:15px;height:20px;border-bottom:2px dashed ${color}30;border-left:2px dashed ${color}30;"></div>` : ''}
                <div class="nodo-padre" style="margin-top:4px;">
                    ${nodo.padre ? `
                        <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--text-secondary);">
                            <span style="font-weight:600;color:var(--color-primary);">👨 Padre:</span>
                            ${renderizarNodo(nodo.padre, nivel + 1)}
                        </div>
                    ` : ''}
                </div>
                <div class="nodo-madre" style="margin-top:4px;">
                    ${nodo.madre ? `
                        <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--text-secondary);">
                            <span style="font-weight:600;color:var(--color-pink);">👩 Madre:</span>
                            ${renderizarNodo(nodo.madre, nivel + 1)}
                        </div>
                    ` : ''}
                </div>
                ${!nodo.padre && !nodo.madre ? `
                    <div style="font-size:0.7rem;color:var(--text-light);padding:2px 0;">
                        <i class="fas fa-info-circle"></i> Sin información de padres
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    return html;
}

// ===== CONTAR NODOS =====
function contarNodos(nodo) {
    if (!nodo) return 0;
    let count = 1;
    if (nodo.padre) count += contarNodos(nodo.padre);
    if (nodo.madre) count += contarNodos(nodo.madre);
    return count;
}

// ===== CALCULAR NIVELES =====
function calcularNiveles(nodo) {
    if (!nodo) return 0;
    let niveles = 1;
    if (nodo.padre) niveles = Math.max(niveles, 1 + calcularNiveles(nodo.padre));
    if (nodo.madre) niveles = Math.max(niveles, 1 + calcularNiveles(nodo.madre));
    return niveles;
}

// ===== EXPANDIR TODO =====
function expandirTodo() {
    document.querySelectorAll('.nodo-hijos').forEach(el => {
        el.style.display = 'flex';
    });
    document.querySelectorAll('.nodo-genealogico').forEach(el => {
        el.style.opacity = '1';
    });
    mostrarToast('🌳 Árbol expandido', 'info');
}

// ===== COLAPSAR TODO =====
function colapsarTodo() {
    document.querySelectorAll('.nodo-hijos').forEach((el, index) => {
        if (index > 0) {
            el.style.display = 'none';
        }
    });
    mostrarToast('📋 Árbol colapsado', 'info');
}

// ===== EDITAR ANIMAL PARA GENEALOGÍA =====
function editarAnimalParaGenealogia(animalId) {
    cerrarModal();
    setTimeout(() => {
        mostrarVista('animales');
        setTimeout(() => {
            if (typeof window.abrirFormularioAnimal === 'function') {
                window.abrirFormularioAnimal(animalId);
            }
        }, 300);
    }, 300);
}

// ===== APLICAR ESTILOS CSS =====
function aplicarEstilosArbol() {
    const style = document.createElement('style');
    style.id = 'estilos-arbol';
    style.textContent = `
        .nodo-genealogico {
            transition: all 0.3s ease;
        }
        .nodo-genealogico .nodo-hijos {
            transition: all 0.3s ease;
        }
        .nodo-genealogico .nodo-contenido:hover {
            transform: scale(1.02);
        }
        @media (max-width: 768px) {
            .nodo-genealogico .nodo-hijos {
                padding-left: 12px;
            }
            .nodo-genealogico .nodo-contenido {
                font-size: 0.7rem;
                padding: 4px 8px;
            }
            .nodo-genealogico .nodo-contenido span {
                font-size: 0.6rem;
            }
        }
    `;
    
    const oldStyle = document.getElementById('estilos-arbol');
    if (oldStyle) oldStyle.remove();
    document.head.appendChild(style);
}

// ===== EXPORTAR GENEALOGÍA =====
function exportarGenealogia() {
    if (!genealogiaData.arbol) {
        mostrarToast('⚠️ Primero carga un árbol genealógico', 'warning');
        return;
    }

    const animal = genealogiaData.animalSeleccionado;
    if (!animal) {
        mostrarToast('⚠️ No hay animal seleccionado', 'warning');
        return;
    }

    const texto = generarTextoArbol(genealogiaData.arbol, 0);
    const totalNodos = contarNodos(genealogiaData.arbol);
    const niveles = calcularNiveles(genealogiaData.arbol);
    
    const contenido = `
╔═══════════════════════════════════════════════════════╗
║        🌳 ÁRBOL GENEALÓGICO - GRANJA PORCINA         ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  Animal: ${animal.numero} - ${animal.nombre || 'Sin nombre'}                    
║  Categoría: ${animal.categoria || 'N/A'}                                  
║  Sexo: ${animal.sexo || 'N/A'}                                           
║  Raza: ${animal.raza || 'N/A'}                                          
║                                                       ║
║  📊 Estadísticas:                                    
║  • Total nodos: ${totalNodos}                                        
║  • Niveles: ${niveles}                                            
║  • Ascendientes: ${totalNodos - 1}                                    
║                                                       ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
${texto}
║                                                       ║
╚═══════════════════════════════════════════════════════╝

📅 Generado: ${new Date().toLocaleString('es-ES')}
👤 Usuario: ${currentUser?.email || 'Sistema'}

─────────────────────────────────────────────────────────
    `;

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbol_genealogico_${animal.numero}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('✅ Árbol exportado correctamente', 'success');
}

// ===== GENERAR TEXTO DEL ÁRBOL =====
function generarTextoArbol(nodo, nivel) {
    if (!nodo) return '';
    
    const indent = '  '.repeat(nivel);
    const sexoIcon = nodo.sexo === 'Macho' ? '♂' : '♀';
    let texto = `${indent}├─ ${sexoIcon} ${nodo.numero} - ${nodo.nombre || 'Sin nombre'} (${nodo.categoria || 'N/A'})\n`;
    
    if (nodo.padre) {
        texto += `${indent}│  └─ Padre: ${generarTextoArbol(nodo.padre, nivel + 1)}`;
    }
    if (nodo.madre) {
        texto += `${indent}│  └─ Madre: ${generarTextoArbol(nodo.madre, nivel + 1)}`;
    }
    if (!nodo.padre && !nodo.madre && nivel > 0) {
        texto += `${indent}│     (Sin información de padres)\n`;
    }
    
    return texto;
}

// ===== EXPOSICIÓN GLOBAL =====
window.cargarGenealogia = cargarGenealogia;
window.cargarArbolGenealogia = cargarArbolGenealogia;
window.expandirTodo = expandirTodo;
window.colapsarTodo = colapsarTodo;
window.exportarGenealogia = exportarGenealogia;
window.editarAnimalParaGenealogia = editarAnimalParaGenealogia;
window.verDetalleAnimal = verDetalleAnimal;
window.obtenerAnimalGenealogia = obtenerAnimalGenealogia;

console.log('[genealogia.js] Módulo cargado correctamente');