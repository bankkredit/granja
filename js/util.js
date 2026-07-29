/**
 * util.js - Funciones auxiliares y helpers
 * Versión mejorada con sistema de modales basado en callbacks
 */

// ===== TOAST NOTIFICATIONS =====
function mostrarToast(mensaje, tipo = 'info', duracion = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('Toast container no encontrado');
        return;
    }
    
    const iconos = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const colores = {
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.style.borderLeftColor = colores[tipo] || colores.info;
    toast.innerHTML = `<i class="fas ${iconos[tipo] || iconos.info}" style="color:${colores[tipo] || colores.info};"></i> <span>${mensaje}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 400);
    }, duracion);
}

// ===== SISTEMA DE MODALES CON CALLBACKS =====
let modalCallbacks = {};

function mostrarModal(titulo, contenidoHTML, opciones = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const titleEl = document.getElementById('modalTitle');
        const bodyEl = document.getElementById('modalBody');
        const footerEl = document.getElementById('modalFooter');
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');
        const closeBtn = document.getElementById('modalClose');
        
        if (!overlay || !titleEl || !bodyEl) {
            console.error('Elementos del modal no encontrados');
            resolve(false);
            return;
        }

        // Configurar título y contenido
        titleEl.textContent = titulo;
        bodyEl.innerHTML = contenidoHTML;

        // Configurar botones
        const textoConfirmar = opciones.confirmText || 'Aceptar';
        const textoCancelar = opciones.cancelText || 'Cancelar';
        const mostrarConfirm = opciones.showConfirm !== false;
        const mostrarCancel = opciones.showCancel !== false;

        if (confirmBtn) {
            confirmBtn.textContent = textoConfirmar;
            confirmBtn.style.display = mostrarConfirm ? 'inline-flex' : 'none';
        }
        if (cancelBtn) {
            cancelBtn.textContent = textoCancelar;
            cancelBtn.style.display = mostrarCancel ? 'inline-flex' : 'none';
        }
        footerEl.style.display = (mostrarConfirm || mostrarCancel) ? 'flex' : 'none';

        // Guardar callbacks
        modalCallbacks = {
            onConfirm: opciones.onConfirm || null,
            onCancel: opciones.onCancel || null,
            resolve: resolve
        };

        // Función para cerrar el modal
        const cerrar = (resultado) => {
            overlay.style.display = 'none';
            if (modalCallbacks.resolve) {
                modalCallbacks.resolve(resultado);
                modalCallbacks = {};
            }
        };

        // Remover eventos anteriores clonando los botones
        if (confirmBtn) {
            const newConfirm = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
            newConfirm.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (modalCallbacks.onConfirm && typeof modalCallbacks.onConfirm === 'function') {
                    modalCallbacks.onConfirm();
                } else {
                    cerrar(true);
                }
            });
        }

        if (cancelBtn) {
            const newCancel = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            newCancel.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (modalCallbacks.onCancel && typeof modalCallbacks.onCancel === 'function') {
                    modalCallbacks.onCancel();
                }
                cerrar(false);
            });
        }

        if (closeBtn) {
            const newClose = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newClose, closeBtn);
            newClose.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                cerrar(false);
            });
        }

        // Cerrar al hacer clic fuera
        overlay.onclick = function(e) {
            if (e.target === overlay) cerrar(false);
        };

        // Mostrar el modal
        overlay.style.display = 'flex';
        overlay.style.animation = 'fadeIn 0.3s ease';
    });
}

function cerrarModal(resultado = false) {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.style.display = 'none';
    if (modalCallbacks.resolve) {
        modalCallbacks.resolve(resultado);
        modalCallbacks = {};
    }
}

// ===== FORMATEO DE FECHAS =====
function formatearFecha(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatearFechaHora(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatearFechaInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

// ===== CÁLCULO DE EDAD =====
function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return 'Desconocida';
    const nac = new Date(fechaNacimiento);
    const ahora = new Date();
    let años = ahora.getFullYear() - nac.getFullYear();
    let meses = ahora.getMonth() - nac.getMonth();
    if (meses < 0 || (meses === 0 && ahora.getDate() < nac.getDate())) {
        años--;
        meses += 12;
    }
    if (años > 0) return `${años} año${años > 1 ? 's' : ''}`;
    else if (meses > 0) return `${meses} mes${meses > 1 ? 'es' : ''}`;
    else return 'Recién nacido';
}

// ===== GENERACIÓN DE ID =====
async function generarId(prefix) {
    try {
        const counterRef = firebase.database().ref('contadores/' + prefix);
        const snapshot = await counterRef.once('value');
        let count = snapshot.val() || 0;
        count++;
        await counterRef.set(count);
        const padded = String(count).padStart(6, '0');
        return prefix + padded;
    } catch (error) {
        console.error('Error generando ID:', error);
        // Fallback: usar timestamp
        return prefix + Date.now().toString().slice(-6);
    }
}

// ===== VALIDACIÓN DE FORMULARIOS =====
function validarCampos(data, rules) {
    const errors = [];
    for (const [campo, rule] of Object.entries(rules)) {
        const valor = data[campo];
        if (rule.required && (!valor || valor.toString().trim() === '')) {
            errors.push(`El campo ${campo} es obligatorio.`);
        }
        if (rule.min !== undefined && Number(valor) < rule.min) {
            errors.push(`El campo ${campo} debe ser mayor o igual a ${rule.min}.`);
        }
        if (rule.max !== undefined && Number(valor) > rule.max) {
            errors.push(`El campo ${campo} debe ser menor o igual a ${rule.max}.`);
        }
        if (rule.pattern && !rule.pattern.test(valor)) {
            errors.push(`El campo ${campo} tiene un formato inválido.`);
        }
    }
    return errors;
}

// ===== SUBIR A CLOUDINARY =====
function subirArchivoCloudinary(file, carpeta = 'granja') {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No se seleccionó ningún archivo'));
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'granja_preset');
        formData.append('folder', carpeta);
        
        fetch('https://api.cloudinary.com/v1_1/cn4gurem/image/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.secure_url) {
                resolve({ url: data.secure_url, public_id: data.public_id });
            } else {
                reject(new Error('Error al subir: ' + (data.error?.message || 'desconocido')));
            }
        })
        .catch(reject);
    });
}

// ===== GENERAR CÓDIGO QR =====
function generarQR(texto, containerId) {
    return new Promise((resolve) => {
        const container = document.getElementById(containerId);
        if (!container) return resolve(null);
        container.innerHTML = '';
        try {
            const qr = new QRCode(container, {
                text: texto,
                width: 128,
                height: 128,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            setTimeout(() => {
                const canvas = container.querySelector('canvas');
                if (canvas) resolve(canvas.toDataURL('image/png'));
                else resolve(null);
            }, 300);
        } catch (error) {
            console.error('Error generando QR:', error);
            resolve(null);
        }
    });
}

// ===== EXPORTAR EXCEL =====
function exportarExcel(elemento, nombreArchivo = 'export') {
    if (typeof XLSX === 'undefined') {
        mostrarToast('SheetJS no cargado', 'error');
        return;
    }
    try {
        let datos;
        if (elemento.tagName === 'TABLE') {
            datos = XLSX.utils.table_to_sheet(elemento);
        } else {
            const tabla = elemento.querySelector('table');
            if (tabla) datos = XLSX.utils.table_to_sheet(tabla);
            else {
                const texto = elemento.innerText;
                const filas = texto.split('\n').filter(f => f.trim());
                datos = XLSX.utils.aoa_to_sheet([filas]);
            }
        }
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, datos, 'Datos');
        XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`);
        mostrarToast('✅ Exportado a Excel', 'success');
    } catch (error) {
        mostrarToast('❌ Error al exportar: ' + error.message, 'error');
    }
}

// ===== EXPORTAR PDF =====
async function exportarPDF(elemento, nombreArchivo = 'export') {
    if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        mostrarToast('Librerías PDF no cargadas', 'error');
        return;
    }
    try {
        const canvas = await html2canvas(elemento, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${nombreArchivo}.pdf`);
        mostrarToast('✅ Exportado a PDF', 'success');
    } catch (error) {
        mostrarToast('❌ Error al generar PDF: ' + error.message, 'error');
    }
}

// ===== CAPITALIZAR =====
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ===== FORMATEAR MONEDA =====
function formatearMoneda(cantidad, moneda = 'USD') {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: moneda
    }).format(cantidad);
}

// ===== TRUNCAR TEXTO =====
function truncarTexto(texto, longitud = 50) {
    if (!texto) return '';
    if (texto.length <= longitud) return texto;
    return texto.substring(0, longitud) + '...';
}

// ===== EXPOSICIÓN GLOBAL =====
window.mostrarToast = mostrarToast;
window.mostrarModal = mostrarModal;
window.cerrarModal = cerrarModal;
window.formatearFecha = formatearFecha;
window.formatearFechaHora = formatearFechaHora;
window.formatearFechaInput = formatearFechaInput;
window.calcularEdad = calcularEdad;
window.generarId = generarId;
window.validarCampos = validarCampos;
window.subirArchivoCloudinary = subirArchivoCloudinary;
window.generarQR = generarQR;
window.exportarExcel = exportarExcel;
window.exportarPDF = exportarPDF;
window.capitalize = capitalize;
window.formatearMoneda = formatearMoneda;
window.truncarTexto = truncarTexto;