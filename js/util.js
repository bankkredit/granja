/**
 * util.js - Funciones auxiliares y helpers
 */

// ===== TOAST NOTIFICATIONS =====
function mostrarToast(mensaje, tipo = 'info', duracion = 3000) {
    const container = document.getElementById('toastContainer');
    const iconos = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<i class="fas ${iconos[tipo] || iconos.info}"></i> ${mensaje}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 400);
    }, duracion);
}

// ===== MODAL =====
let modalResolve = null;

function mostrarModal(titulo, contenidoHTML, textoConfirmar = 'Aceptar', accionConfirmar = null, textoCancelar = 'Cancelar', accionCancelar = null) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        document.getElementById('modalTitle').textContent = titulo;
        document.getElementById('modalBody').innerHTML = contenidoHTML;
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');
        const closeBtn = document.getElementById('modalClose');

        confirmBtn.textContent = textoConfirmar;
        cancelBtn.textContent = textoCancelar;
        // Remover listeners anteriores
        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        overlay.style.display = 'flex';
        modalResolve = resolve;

        const cerrar = (resultado) => {
            overlay.style.display = 'none';
            if (modalResolve) modalResolve(resultado);
        };

        newConfirm.addEventListener('click', () => {
            if (accionConfirmar) accionConfirmar();
            cerrar(true);
        });
        newCancel.addEventListener('click', () => {
            if (accionCancelar) accionCancelar();
            cerrar(false);
        });
        closeBtn.addEventListener('click', () => cerrar(false));
        // Cerrar al hacer clic fuera del modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cerrar(false);
        });
    });
}

function cerrarModal() {
    const overlay = document.getElementById('modalOverlay');
    overlay.style.display = 'none';
    if (modalResolve) modalResolve(false);
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
    if (años > 0) return `${años} año${años>1?'s':''}`;
    else if (meses > 0) return `${meses} mes${meses>1?'es':''}`;
    else return 'Recién nacido';
}

// ===== GENERACIÓN DE ID =====
async function generarId(prefix) {
    const counterRef = firebase.database().ref('contadores/' + prefix);
    const snapshot = await counterRef.once('value');
    let count = snapshot.val() || 0;
    count++;
    await counterRef.set(count);
    const padded = String(count).padStart(6, '0');
    return prefix + padded;
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
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'granja_preset'); // Reemplazar con tu preset
        formData.append('folder', carpeta);
        fetch('https://api.cloudinary.com/v1_1/tu_cloud_name/image/upload', {
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
    });
}

// ===== EXPORTAR EXCEL (SheetJS) =====
function exportarExcel(elemento, nombreArchivo = 'export') {
    if (typeof XLSX === 'undefined') {
        mostrarToast('SheetJS no cargado', 'error');
        return;
    }
    let datos;
    if (elemento.tagName === 'TABLE') {
        datos = XLSX.utils.table_to_sheet(elemento);
    } else {
        const tabla = elemento.querySelector('table');
        if (tabla) datos = XLSX.utils.table_to_sheet(tabla);
        else {
            const texto = elemento.innerText;
            const filas = texto.split('\n').filter(f => f.trim());
            datos = [filas];
        }
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, datos, 'Datos');
    XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`);
    mostrarToast('Exportado a Excel', 'success');
}

// ===== EXPORTAR PDF (jsPDF + html2canvas) =====
async function exportarPDF(elemento, nombreArchivo = 'export') {
    if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        mostrarToast('Librerías PDF no cargadas', 'error');
        return;
    }
    try {
        const canvas = await html2canvas(elemento, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${nombreArchivo}.pdf`);
        mostrarToast('Exportado a PDF', 'success');
    } catch (error) {
        mostrarToast('Error al generar PDF: ' + error.message, 'error');
    }
}

// ===== OTRAS UTILIDADES =====
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== EXPOSICIÓN GLOBAL =====
window.mostrarToast = mostrarToast;
window.mostrarModal = mostrarModal;
window.cerrarModal = cerrarModal;
window.formatearFecha = formatearFecha;
window.formatearFechaHora = formatearFechaHora;
window.calcularEdad = calcularEdad;
window.generarId = generarId;
window.validarCampos = validarCampos;
window.subirArchivoCloudinary = subirArchivoCloudinary;
window.generarQR = generarQR;
window.exportarExcel = exportarExcel;
window.exportarPDF = exportarPDF;
window.capitalize = capitalize;