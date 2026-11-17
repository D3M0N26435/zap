// =========================================================================
// ESTADO GLOBAL Y PERSISTENCIA (localStorage)
// =========================================================================
const STORAGE_KEYS = {
    TRASPASOS: 'calzagestion_traspasos_v1',
    CREDITOS: 'calzagestion_creditos_v1',
    ULTIMO_RESPALDO: 'cambiazo_ultimo_respaldo_v1'
};

let traspasos = [];
let creditos = [];
let importacionPendiente = null;

// Inicialización al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    inicializarFechas();
    handleTipoChange();
    actualizarDashboard();
    actualizarInfoRespaldo();
    renderTraspasos();
    renderCreditos();
});

function normalizarTraspaso(t) {
    // Compatibilidad con registros guardados antes de existir tallaNueva / llegado.
    return {
        tallaNueva: '',
        llegado: false,
        ...t
    };
}

function cargarDatos() {
    try {
        const rawTraspasos = localStorage.getItem(STORAGE_KEYS.TRASPASOS);
        const rawCreditos = localStorage.getItem(STORAGE_KEYS.CREDITOS);

        if (rawTraspasos) {
            traspasos = (JSON.parse(rawTraspasos) || []).map(normalizarTraspaso);
        } else {
            // Datos iniciales de ejemplo para demostración inmediata
            const hoy = getTodayISO();
            traspasos = [
                {
                    id: 'TR-' + Date.now(),
                    codigo: 'NK-AIR-402',
                    tipo: 'Traspaso',
                    tienda: 'Sucursal Shopping',
                    talla: '41',
                    horario: 'Urgente',
                    paraQuien: 'Carlos Mendoza (Cliente en espera)',
                    responsable: 'Sofía Vargas',
                    conDocumento: true,
                    subidoSistema: false,
                    fechaSistema: '',
                    llegado: true,
                    fechaRegistro: hoy
                },
                {
                    id: 'TR-' + (Date.now() + 1),
                    codigo: 'AD-RUN-118',
                    tipo: 'Cambio',
                    tienda: 'Tienda Central',
                    talla: '37',
                    tallaNueva: '38',
                    horario: 'Tarde',
                    paraQuien: 'Sucursal Mercado',
                    responsable: 'Luis Mamani',
                    conDocumento: false,
                    subidoSistema: true,
                    fechaSistema: hoy,
                    llegado: false,
                    fechaRegistro: hoy
                }
            ];
            guardarTraspasos();
        }

        if (rawCreditos) {
            creditos = JSON.parse(rawCreditos);
        } else {
            const hoy = getTodayISO();
            creditos = [
                {
                    id: 'CR-' + Date.now(),
                    codigo: 'PM-SPD-88',
                    talla: '39',
                    cliente: 'Andrea Quispe',
                    fecha: hoy,
                    estado: 'Dejó a cuenta',
                    precioTotal: 380,
                    montoPagado: 150,
                    liquidado: false
                },
                {
                    id: 'CR-' + (Date.now() + 1),
                    codigo: 'RB-CL-505',
                    talla: '42',
                    cliente: 'Jorge Torrez',
                    fecha: hoy,
                    estado: 'Pagado',
                    precioTotal: 420,
                    montoPagado: 420,
                    liquidado: false
                }
            ];
            guardarCreditos();
        }
    } catch (e) {
        console.error('Error cargando localStorage:', e);
        showToast('Error al leer datos locales', 'error');
    }
}

function guardarTraspasos() {
    localStorage.setItem(STORAGE_KEYS.TRASPASOS, JSON.stringify(traspasos));
    actualizarDashboard();
    actualizarInfoRespaldo();
}

function guardarCreditos() {
    localStorage.setItem(STORAGE_KEYS.CREDITOS, JSON.stringify(creditos));
    actualizarDashboard();
    actualizarInfoRespaldo();
}

// =========================================================================
// RESPALDO COMPLETO: EXPORTAR / IMPORTAR JSON (compatible con Firestore)
// =========================================================================
function actualizarInfoRespaldo() {
    const info = document.getElementById('respaldo-info');
    if (info) {
        info.textContent = `${traspasos.length} traspasos/cambios · ${creditos.length} créditos guardados en este navegador`;
    }

    const ultimo = document.getElementById('respaldo-ultimo');
    if (!ultimo) return;
    const fecha = localStorage.getItem(STORAGE_KEYS.ULTIMO_RESPALDO);
    ultimo.textContent = fecha
        ? `Último respaldo exportado: ${new Date(fecha).toLocaleString('es-BO')}`
        : 'Aún no has exportado un respaldo.';
}

function construirRespaldo() {
    return {
        app: 'CambiaZO',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        traspasos: traspasos,
        creditos: creditos
    };
}

function exportarRespaldo() {
    try {
        const contenido = JSON.stringify(construirRespaldo(), null, 2);
        const blob = new Blob([contenido], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const ahora = new Date();
        const hora = `${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}`;
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download = `cambiazo-respaldo-${getTodayISO()}_${hora}.json`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        localStorage.setItem(STORAGE_KEYS.ULTIMO_RESPALDO, ahora.toISOString());
        actualizarInfoRespaldo();
        showToast(`Respaldo exportado: ${traspasos.length} traspasos y ${creditos.length} créditos`, 'success');
    } catch (e) {
        console.error('Error exportando respaldo:', e);
        showToast('No se pudo exportar el respaldo', 'error');
    }
}

function abrirSelectorImportacion() {
    document.getElementById('input-importar-respaldo').click();
}

function esRegistroValido(registro) {
    return registro && typeof registro === 'object' &&
        typeof registro.id === 'string' && registro.id.trim() !== '';
}

function normalizarCredito(c) {
    return {
        ...c,
        precioTotal: Number(c.precioTotal) || 0,
        montoPagado: Number(c.montoPagado) || 0,
        liquidado: Boolean(c.liquidado)
    };
}

function normalizarRespaldo(data) {
    // Acepta respaldos de CambiaZO y también un arreglo plano de traspasos.
    if (Array.isArray(data)) {
        return {
            traspasos: data.filter(esRegistroValido).map(normalizarTraspaso),
            creditos: [],
            incluyeTraspasos: true,
            incluyeCreditos: false
        };
    }

    if (!data || typeof data !== 'object') {
        throw new Error('Formato de respaldo desconocido');
    }

    const fuente = (data.data && typeof data.data === 'object') ? data.data : data;
    const incluyeTraspasos = Array.isArray(fuente.traspasos);
    const incluyeCreditos = Array.isArray(fuente.creditos);
    if (!incluyeTraspasos && !incluyeCreditos) {
        throw new Error('El respaldo no contiene traspasos ni créditos');
    }

    return {
        traspasos: incluyeTraspasos ? fuente.traspasos.filter(esRegistroValido).map(normalizarTraspaso) : [],
        creditos: incluyeCreditos ? fuente.creditos.filter(esRegistroValido).map(normalizarCredito) : [],
        incluyeTraspasos,
        incluyeCreditos
    };
}

function procesarArchivoRespaldo(event) {
    const input = event.target;
    const archivo = input.files && input.files[0];
    input.value = '';
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = () => {
        try {
            const datos = normalizarRespaldo(JSON.parse(lector.result));
            abrirModalImportacion(datos);
        } catch (e) {
            console.error('Error importando respaldo:', e);
            showToast('Archivo inválido: revisa que sea un respaldo JSON de CambiaZO', 'error');
        }
    };
    lector.onerror = () => showToast('No se pudo leer el archivo', 'error');
    lector.readAsText(archivo);
}

function abrirModalImportacion(datos) {
    const total = datos.traspasos.length + datos.creditos.length;
    if (total === 0) {
        showToast('El respaldo no contiene registros válidos', 'error');
        return;
    }

    importacionPendiente = datos;
    const partes = [];
    if (datos.incluyeTraspasos) partes.push(`<strong>${datos.traspasos.length}</strong> traspasos/cambios`);
    if (datos.incluyeCreditos) partes.push(`<strong>${datos.creditos.length}</strong> créditos`);

    document.getElementById('modal-title').textContent = 'Importar respaldo';
    document.getElementById('modal-body').innerHTML = `
        <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 space-y-1">
            <p class="text-xs text-slate-600">El archivo contiene ${partes.join(' y ')}.</p>
            <p class="text-xs text-slate-500">Elige cómo quieres aplicarlo:</p>
        </div>
        <div class="space-y-2">
            <button onclick="aplicarImportacion('combinar')" class="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-rose-50/70 transition">
                <span class="block text-sm font-bold text-slate-800"><i class="fa-solid fa-object-group text-brand-600 mr-1.5"></i>Combinar</span>
                <span class="block text-[11px] text-slate-500">Agrega los registros nuevos y actualiza los que tengan el mismo ID. No borra nada.</span>
            </button>
            <button onclick="aplicarImportacion('reemplazar')" class="w-full text-left p-3 rounded-xl border border-rose-200 hover:border-brand-400 hover:bg-rose-50 transition">
                <span class="block text-sm font-bold text-brand-700"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i>Reemplazar todo</span>
                <span class="block text-[11px] text-slate-500">Borra los datos actuales y deja únicamente los del archivo.</span>
            </button>
        </div>
        <div class="flex justify-end pt-1">
            <button onclick="cancelarImportacion()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">Cancelar</button>
        </div>
    `;
    openModal();
}

function cancelarImportacion() {
    importacionPendiente = null;
    closeModal();
}

function combinarPorId(actuales, importados) {
    const mapa = new Map(actuales.map(item => [item.id, item]));
    importados.forEach(item => mapa.set(item.id, item));
    return Array.from(mapa.values());
}

function aplicarImportacion(modo) {
    const datos = importacionPendiente;
    if (!datos) return;

    if (modo === 'reemplazar') {
        if (datos.incluyeTraspasos) traspasos = datos.traspasos;
        if (datos.incluyeCreditos) creditos = datos.creditos;
    } else {
        if (datos.incluyeTraspasos) traspasos = combinarPorId(traspasos, datos.traspasos);
        if (datos.incluyeCreditos) creditos = combinarPorId(creditos, datos.creditos);
    }

    guardarTraspasos();
    guardarCreditos();
    renderTraspasos();
    renderCreditos();
    importacionPendiente = null;
    closeModal();
    showToast(
        modo === 'reemplazar' ? 'Respaldo importado: datos reemplazados' : 'Respaldo importado: datos combinados',
        'success'
    );
}

// =========================================================================
// UTILIDADES DE FECHA Y SEMANAS
// =========================================================================
function getTodayISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString().split('T')[0];
}

function getCurrentISOWeek() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekRangeFromISOWeek(isoWeek) {
    if (!isoWeek) return null;
    const [yearStr, weekStr] = isoWeek.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);

    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const monday = new Date(simple);
    if (dow <= 4) {
        monday.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        monday.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d) => d.toISOString().split('T')[0];
    return { start: fmt(monday), end: fmt(sunday) };
}

function formatFechaLegible(isoDate) {
    if (!isoDate) return '—';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

// Escapa texto de usuario antes de insertarlo en innerHTML / atributos.
function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function inicializarFechas() {
    const hoy = getTodayISO();
    document.getElementById('c-fecha').value = hoy;
    document.getElementById('t-fecha-sistema').value = hoy;
    document.getElementById('filtro-semana').value = getCurrentISOWeek();

    const opciones = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
    const textoFecha = new Date().toLocaleDateString('es-BO', opciones);
    document.getElementById('fecha-actual-badge').textContent = textoFecha.charAt(0).toUpperCase() + textoFecha.slice(1);
}

// =========================================================================
// NAVEGACIÓN DE PESTAÑAS Y MÉTRICAS SUPERIORES
// =========================================================================
function switchTab(tab) {
    const btnT = document.getElementById('tab-btn-traspasos');
    const btnC = document.getElementById('tab-btn-creditos');
    const viewT = document.getElementById('view-traspasos');
    const viewC = document.getElementById('view-creditos');

    if (tab === 'traspasos') {
        viewT.classList.remove('hidden');
        viewC.classList.add('hidden');
        btnT.className = 'flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 bg-brand-600 text-white shadow-md shadow-brand-600/25';
        btnC.className = 'flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-brand-700';
    } else {
        viewC.classList.remove('hidden');
        viewT.classList.add('hidden');
        btnC.className = 'flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 bg-brand-600 text-white shadow-md shadow-brand-600/25';
        btnT.className = 'flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-brand-700';
    }
}

function actualizarDashboard() {
    const urgentes = traspasos.filter(t => t.horario === 'Urgente' && (!t.conDocumento || !t.subidoSistema)).length;
    const pendientesSys = traspasos.filter(t => !t.conDocumento || !t.subidoSistema).length;

    let saldoTotalBs = 0;
    creditos.forEach(c => {
        if (c.estado === 'Dejó a cuenta') {
            const saldo = Math.max(0, (parseFloat(c.precioTotal) || 0) - (parseFloat(c.montoPagado) || 0));
            saldoTotalBs += saldo;
        }
    });

    const sinLiquidar = creditos.filter(c => c.estado === 'Pagado' && !c.liquidado).length;

    document.getElementById('stat-urgentes').textContent = urgentes;
    document.getElementById('stat-pendientes-sys').textContent = pendientesSys;
    document.getElementById('stat-saldo-bs').textContent = `${saldoTotalBs.toFixed(2)} Bs.`;
    document.getElementById('stat-sin-liquidar').textContent = sinLiquidar;
}

// =========================================================================
// LÓGICA PESTAÑA 1: TRASPASOS Y CAMBIOS
// =========================================================================
function handleTipoChange() {
    const esCambio = document.getElementById('t-tipo').value === 'Cambio';
    const labelTalla = document.getElementById('label-talla');
    const wrapNueva = document.getElementById('wrap-talla-nueva');
    const inputNueva = document.getElementById('t-talla-nueva');

    labelTalla.innerHTML = esCambio
        ? '<i class="fa-solid fa-ruler text-brand-500 mr-1"></i> Talla solicitada *'
        : '<i class="fa-solid fa-ruler text-brand-500 mr-1"></i> Talla *';

    wrapNueva.classList.toggle('hidden', !esCambio);
    inputNueva.required = esCambio;
    if (!esCambio) inputNueva.value = '';
}

function updateFormDocLabel() {
    const checked = document.getElementById('t-con-documento').checked;
    const lbl = document.getElementById('label-doc-estado');
    if (checked) {
        lbl.textContent = 'Estado: Llegó con documento';
        lbl.className = 'text-xs font-bold text-emerald-600';
    } else {
        lbl.textContent = 'Estado: Deben documento';
        lbl.className = 'text-xs font-semibold text-amber-600';
    }
}

function toggleFormSystemDate() {
    const checked = document.getElementById('t-subido-sistema').checked;
    const dateInput = document.getElementById('t-fecha-sistema');
    const lbl = document.getElementById('label-sys-estado');
    if (checked) {
        dateInput.classList.remove('hidden');
        if (!dateInput.value) dateInput.value = getTodayISO();
        lbl.textContent = 'Confirmado en sistema';
        lbl.className = 'text-xs font-bold text-brand-600';
    } else {
        dateInput.classList.add('hidden');
        lbl.textContent = 'Aún no registrado en sistema';
        lbl.className = 'text-xs font-semibold text-slate-500';
    }
}

document.getElementById('form-traspaso').addEventListener('submit', (e) => {
    e.preventDefault();

    const subido = document.getElementById('t-subido-sistema').checked;
    const fechaSys = subido ? (document.getElementById('t-fecha-sistema').value || getTodayISO()) : '';
    const tipo = document.getElementById('t-tipo').value;

    const nuevo = {
        id: 'TR-' + Date.now(),
        codigo: document.getElementById('t-codigo').value.trim().toUpperCase(),
        tipo: tipo,
        tienda: document.getElementById('t-tienda').value.trim(),
        talla: document.getElementById('t-talla').value.trim(),
        tallaNueva: tipo === 'Cambio' ? document.getElementById('t-talla-nueva').value.trim() : '',
        horario: document.getElementById('t-horario').value,
        paraQuien: document.getElementById('t-para-quien').value.trim(),
        responsable: document.getElementById('t-responsable').value.trim(),
        conDocumento: document.getElementById('t-con-documento').checked,
        subidoSistema: subido,
        fechaSistema: fechaSys,
        llegado: false,
        fechaRegistro: getTodayISO()
    };

    traspasos.unshift(nuevo);
    guardarTraspasos();
    renderTraspasos();

    e.target.reset();
    updateFormDocLabel();
    toggleFormSystemDate();
    handleTipoChange();
    showToast(`Movimiento ${nuevo.codigo} registrado con éxito`, 'success');
});

function toggleTraspasoLlegado(id) {
    const item = traspasos.find(t => t.id === id);
    if (!item) return;
    item.llegado = !item.llegado;
    guardarTraspasos();
    renderTraspasos();
    showToast(item.llegado ? 'Marcado como llegado' : 'Marcado como no llegado', 'info');
}

function toggleTraspasoDoc(id) {
    const item = traspasos.find(t => t.id === id);
    if (!item) return;
    item.conDocumento = !item.conDocumento;
    guardarTraspasos();
    renderTraspasos();
    showToast(item.conDocumento ? 'Marcado: Llegó con documento' : 'Marcado: Deben documento', 'info');
}

function toggleTraspasoSistema(id) {
    const item = traspasos.find(t => t.id === id);
    if (!item) return;
    item.subidoSistema = !item.subidoSistema;
    item.fechaSistema = item.subidoSistema ? getTodayISO() : '';
    guardarTraspasos();
    renderTraspasos();
    showToast(item.subidoSistema ? `Subido al sistema (${formatFechaLegible(item.fechaSistema)})` : 'Desmarcado de sistema principal', 'info');
}

function actualizarFechaSistemaItem(id, nuevaFecha) {
    const item = traspasos.find(t => t.id === id);
    if (!item) return;
    item.fechaSistema = nuevaFecha;
    guardarTraspasos();
    showToast('Fecha de subida actualizada', 'success');
}

function eliminarTraspaso(id) {
    openConfirmModal(
        'Eliminar registro',
        '¿Estás seguro de eliminar este traspaso/cambio del historial?',
        () => {
            traspasos = traspasos.filter(t => t.id !== id);
            guardarTraspasos();
            renderTraspasos();
            showToast('Registro eliminado', 'info');
        }
    );
}

function abrirModalEditarTienda(id) {
    const item = traspasos.find(t => t.id === id);
    if (!item) return;

    document.getElementById('modal-title').textContent = 'Editar tienda de origen';
    document.getElementById('modal-body').innerHTML = `
        <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 space-y-1">
            <p class="text-xs text-slate-500">Código: <strong class="text-slate-800">${escapeHtml(item.codigo)}</strong></p>
            <p class="text-xs text-slate-500">Tipo: <strong class="text-slate-800">${item.tipo === 'Cambio' ? 'Cambio de talla' : 'Traspaso'}</strong></p>
        </div>
        <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tienda donde está / se realizó</label>
            <input type="text" id="input-edit-tienda" value="${escapeHtml(item.tienda)}" class="glass-input w-full px-3.5 py-2.5 text-sm font-semibold">
        </div>
        <div class="flex justify-end gap-2 pt-2">
            <button onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">Cancelar</button>
            <button onclick="guardarTienda('${item.id}')" class="btn-brand px-5 py-2 text-xs font-bold">Guardar</button>
        </div>
    `;
    openModal();
    document.getElementById('input-edit-tienda').focus();
    document.getElementById('input-edit-tienda').select();
}

function guardarTienda(id) {
    const item = traspasos.find(t => t.id === id);
    if (!item) return;

    const nuevaTienda = document.getElementById('input-edit-tienda').value.trim();
    if (!nuevaTienda) {
        showToast('La tienda no puede quedar vacía', 'error');
        return;
    }

    item.tienda = nuevaTienda;
    guardarTraspasos();
    renderTraspasos();
    closeModal();
    showToast('Tienda actualizada', 'success');
}

function limpiarFiltroSemana() {
    document.getElementById('filtro-semana').value = '';
    renderTraspasos();
}

function getTraspasosFiltrados() {
    const q = document.getElementById('buscar-traspaso').value.toLowerCase().trim();
    const estadoFiltro = document.getElementById('filtro-estado-traspaso').value;
    const semanaIso = document.getElementById('filtro-semana').value;
    const rango = getWeekRangeFromISOWeek(semanaIso);

    return traspasos.filter(t => {
        // Filtro de semana
        if (rango && t.fechaRegistro) {
            if (t.fechaRegistro < rango.start || t.fechaRegistro > rango.end) return false;
        }

        // Filtro de texto
        if (q) {
            const match = t.codigo.toLowerCase().includes(q) ||
                          t.tienda.toLowerCase().includes(q) ||
                          t.paraQuien.toLowerCase().includes(q) ||
                          t.responsable.toLowerCase().includes(q);
            if (!match) return false;
        }

        // Filtro de estado
        if (estadoFiltro === 'urgentes' && t.horario !== 'Urgente') return false;
        if (estadoFiltro === 'sin-doc' && t.conDocumento) return false;
        if (estadoFiltro === 'sin-sys' && t.subidoSistema) return false;
        if (estadoFiltro === 'completos' && (!t.conDocumento || !t.subidoSistema)) return false;

        return true;
    });
}

// Chip compacto reutilizable para los tickeadores de cada movimiento.
function chipTicker(activo, etiquetaOn, etiquetaOff, iconoOn, iconoOff, onclick, extra = '') {
    return `
        <button type="button" onclick="${onclick}" title="${activo ? etiquetaOn : etiquetaOff}"
                class="tick-chip ${activo ? `is-on ${extra}` : 'is-off'}">
            <i class="fa-solid ${activo ? iconoOn : iconoOff}"></i>
            <span>${activo ? etiquetaOn : etiquetaOff}</span>
        </button>
    `;
}

function renderTraspasos() {
    const container = document.getElementById('lista-traspasos');
    const lista = getTraspasosFiltrados();

    if (lista.length === 0) {
        container.innerHTML = `
            <div class="py-10 text-center glass-panel-sub rounded-2xl">
                <div class="w-12 h-12 rounded-2xl bg-rose-50 text-brand-400 flex items-center justify-center mx-auto mb-3 text-xl">
                    <i class="fa-solid fa-box-open"></i>
                </div>
                <p class="font-display font-bold text-slate-700">No hay movimientos en este filtro</p>
                <p class="text-xs text-slate-500 mt-1">Registra un traspaso/cambio arriba o cambia la semana seleccionada.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = lista.map(t => {
        const horarioBadge = t.horario === 'Urgente'
            ? `<span class="badge-urgent px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-brand-600 text-white flex items-center gap-1"><i class="fa-solid fa-bolt"></i> URGENTE</span>`
            : t.horario === 'Mañana'
                ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800"><i class="fa-solid fa-sun mr-1"></i>Mañana</span>`
                : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800"><i class="fa-solid fa-cloud-sun mr-1"></i>Tarde</span>`;

        const tipoBadge = t.tipo === 'Traspaso'
            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-brand-700">Traspaso</span>`
            : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-white">Cambio de talla</span>`;

        const tallaBadge = (t.tipo === 'Cambio' && t.tallaNueva)
            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-white border border-rose-200 text-brand-600">Talla ${escapeHtml(t.talla)} <i class="fa-solid fa-arrow-right text-[9px] mx-0.5"></i> ${escapeHtml(t.tallaNueva)}</span>`
            : `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-white border border-rose-200 text-brand-600">Talla ${escapeHtml(t.talla)}</span>`;

        const fechaChip = t.subidoSistema
            ? `<input type="date" value="${t.fechaSistema}" onchange="actualizarFechaSistemaItem('${t.id}', this.value)" class="fecha-chip" title="Fecha de subida al sistema">`
            : '';

        return `
        <article class="movimiento-card glass-panel-sub p-3 flex flex-col lg:flex-row lg:items-center gap-3 hover:border-brand-300 transition-all">
            <!-- Identidad -->
            <div class="flex items-center gap-2.5 lg:w-60 shrink-0">
                <div class="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <i class="fa-solid fa-shoe-prints -rotate-12"></i>
                </div>
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="font-display text-sm font-extrabold text-slate-900 tracking-tight truncate">${escapeHtml(t.codigo)}</span>
                        ${tallaBadge}
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                        ${tipoBadge}
                        ${horarioBadge}
                    </div>
                </div>
            </div>

            <!-- Detalles compactos -->
            <div class="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-0.5 text-[11px]">
                <div class="truncate">
                    <span class="text-slate-400 font-semibold uppercase">Tienda:</span>
                    <span class="font-bold text-slate-700"><i class="fa-solid fa-store text-brand-500 mr-1"></i>${escapeHtml(t.tienda)}</span>
                    <button onclick="abrirModalEditarTienda('${t.id}')" title="Editar tienda" class="ml-1 w-5 h-5 rounded-md text-slate-300 hover:text-brand-600 hover:bg-rose-50 inline-flex items-center justify-center transition">
                        <i class="fa-solid fa-pen text-[9px]"></i>
                    </button>
                </div>
                <div class="truncate" title="${escapeHtml(t.paraQuien)}">
                    <span class="text-slate-400 font-semibold uppercase">Para:</span>
                    <span class="font-bold text-slate-700"><i class="fa-solid fa-user text-brand-500 mr-1"></i>${escapeHtml(t.paraQuien)}</span>
                </div>
                <div class="truncate" title="${escapeHtml(t.responsable)}">
                    <span class="text-slate-400 font-semibold uppercase">Encargado:</span>
                    <span class="font-bold text-slate-700">${escapeHtml(t.responsable)}</span>
                </div>
                <div class="sm:col-span-3 text-[10px] text-slate-400">
                    <i class="fa-regular fa-calendar mr-1"></i>Registrado: ${formatFechaLegible(t.fechaRegistro)}
                </div>
            </div>

            <!-- Tickeadores -->
            <div class="flex flex-wrap items-center gap-1.5 lg:justify-end shrink-0">
                ${chipTicker(t.llegado, 'Llegó', 'No llegó', 'fa-circle-check', 'fa-circle-xmark', `toggleTraspasoLlegado('${t.id}')`)}
                ${chipTicker(t.conDocumento, 'Con doc.', 'Sin doc.', 'fa-file-circle-check', 'fa-file-circle-exclamation', `toggleTraspasoDoc('${t.id}')`)}
                ${chipTicker(t.subidoSistema, 'En sist.', 'Sin sist.', 'fa-cloud-check', 'fa-cloud', `toggleTraspasoSistema('${t.id}')`)}
                ${fechaChip}
                <div class="w-px h-5 bg-rose-100 mx-0.5 hidden sm:block"></div>
                <button onclick="eliminarTraspaso('${t.id}')" title="Eliminar" class="w-7 h-7 rounded-lg text-slate-300 hover:text-brand-600 hover:bg-rose-50 flex items-center justify-center transition">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        </article>
        `;
    }).join('');
}

// =========================================================================
// LÓGICA PESTAÑA 2: CONTROL DE ZAPATOS A CRÉDITO
// =========================================================================
function handleCreditoEstadoChange() {
    const estado = document.getElementById('c-estado').value;
    const wrapMonto = document.getElementById('wrap-monto-dejado');
    const wrapTotal = document.getElementById('wrap-precio-total');
    const inputTotal = document.getElementById('c-precio-total');
    const inputMonto = document.getElementById('c-monto-dejado');

    if (estado === 'Dejó a cuenta') {
        wrapTotal.classList.remove('opacity-40', 'pointer-events-none');
        wrapMonto.classList.remove('opacity-40', 'pointer-events-none');
        inputTotal.required = true;
        inputMonto.required = true;
    } else if (estado === 'Pagado') {
        wrapTotal.classList.remove('opacity-40', 'pointer-events-none');
        wrapMonto.classList.add('opacity-40', 'pointer-events-none');
        inputTotal.required = true;
        inputMonto.required = false;
        inputMonto.value = inputTotal.value;
    } else {
        // Devolvió
        wrapTotal.classList.add('opacity-40', 'pointer-events-none');
        wrapMonto.classList.add('opacity-40', 'pointer-events-none');
        inputTotal.required = false;
        inputMonto.required = false;
    }
}

document.getElementById('form-credito').addEventListener('submit', (e) => {
    e.preventDefault();

    const estado = document.getElementById('c-estado').value;
    const precioTotal = parseFloat(document.getElementById('c-precio-total').value) || 0;
    let montoPagado = parseFloat(document.getElementById('c-monto-dejado').value) || 0;

    if (estado === 'Pagado') {
        montoPagado = precioTotal;
    } else if (estado === 'Devolvió') {
        montoPagado = 0;
    } else if (montoPagado >= precioTotal && precioTotal > 0) {
        // Si dejó el monto completo, pasa directo a Pagado
        montoPagado = precioTotal;
    }

    const estadoFinal = (estado === 'Dejó a cuenta' && precioTotal > 0 && montoPagado >= precioTotal)
        ? 'Pagado'
        : estado;

    const nuevoCredito = {
        id: 'CR-' + Date.now(),
        codigo: document.getElementById('c-codigo').value.trim().toUpperCase(),
        talla: document.getElementById('c-talla').value.trim(),
        cliente: document.getElementById('c-cliente').value.trim(),
        fecha: document.getElementById('c-fecha').value || getTodayISO(),
        estado: estadoFinal,
        precioTotal: precioTotal,
        montoPagado: montoPagado,
        liquidado: false
    };

    creditos.unshift(nuevoCredito);
    guardarCreditos();
    renderCreditos();

    e.target.reset();
    document.getElementById('c-fecha').value = getTodayISO();
    handleCreditoEstadoChange();
    showToast(`Crédito de ${nuevoCredito.cliente} guardado`, 'success');
});

function abrirModalAbono(id) {
    const item = creditos.find(c => c.id === id);
    if (!item) return;

    const saldoActual = Math.max(0, item.precioTotal - item.montoPagado);

    document.getElementById('modal-title').textContent = `Registrar Abono — ${item.codigo}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 space-y-1">
            <p class="text-xs text-slate-500">Cliente: <strong class="text-slate-800">${item.cliente}</strong></p>
            <p class="text-xs text-slate-500">Total Zapato: <strong class="text-slate-800">${item.precioTotal.toFixed(2)} Bs.</strong> | Pagado: <strong class="text-emerald-600">${item.montoPagado.toFixed(2)} Bs.</strong></p>
            <p class="text-sm font-bold text-brand-600 pt-1">Saldo Pendiente: ${saldoActual.toFixed(2)} Bs.</p>
        </div>
        <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">Monto que abona hoy (Bs.)</label>
            <input type="number" id="input-nuevo-abono" step="0.5" min="0.5" max="${saldoActual}" value="${saldoActual}" class="glass-input w-full px-3.5 py-2.5 text-base font-bold text-brand-700">
        </div>
        <div class="flex justify-end gap-2 pt-2">
            <button onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">Cancelar</button>
            <button onclick="procesarAbono('${item.id}')" class="btn-brand px-5 py-2 text-xs font-bold">Guardar Abono</button>
        </div>
    `;
    openModal();
}

function procesarAbono(id) {
    const item = creditos.find(c => c.id === id);
    if (!item) return;

    const abono = parseFloat(document.getElementById('input-nuevo-abono').value) || 0;
    if (abono <= 0) {
        showToast('Ingresa un monto válido en Bs.', 'error');
        return;
    }

    item.montoPagado += abono;
    if (item.montoPagado >= item.precioTotal) {
        item.montoPagado = item.precioTotal;
        item.estado = 'Pagado';
        showToast('¡Deuda saldada! Movido a la lista de Pagados', 'success');
    } else {
        showToast(`Abono de ${abono.toFixed(2)} Bs. registrado`, 'success');
    }

    guardarCreditos();
    renderCreditos();
    closeModal();
}

function marcarCreditoPagadoTotal(id) {
    const item = creditos.find(c => c.id === id);
    if (!item) return;
    item.montoPagado = item.precioTotal;
    item.estado = 'Pagado';
    guardarCreditos();
    renderCreditos();
    showToast('¡Marcado como Pagado Total! Movido a lista de Pagados', 'success');
}

function marcarCreditoDevolvio(id) {
    const item = creditos.find(c => c.id === id);
    if (!item) return;
    item.estado = 'Devolvió';
    guardarCreditos();
    renderCreditos();
    showToast('Registrado como Devuelto', 'info');
}

function toggleLiquidacion(id) {
    const item = creditos.find(c => c.id === id);
    if (!item) return;
    item.liquidado = !item.liquidado;
    guardarCreditos();
    renderCreditos();
    showToast(item.liquidado ? '✅ Liquidación confirmada' : 'Liquidación marcada como pendiente', 'info');
}

function eliminarCredito(id) {
    openConfirmModal(
        'Eliminar registro de crédito',
        '¿Deseas eliminar este registro de zapato a crédito?',
        () => {
            creditos = creditos.filter(c => c.id !== id);
            guardarCreditos();
            renderCreditos();
            showToast('Registro eliminado', 'info');
        }
    );
}

function renderCreditos() {
    const q = document.getElementById('buscar-credito').value.toLowerCase().trim();
    const filtrados = creditos.filter(c =>
        !q || c.cliente.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q)
    );

    const activos = filtrados.filter(c => c.estado === 'Dejó a cuenta');
    const pagadosFinalizados = filtrados.filter(c => c.estado === 'Pagado' || c.estado === 'Devolvió');

    document.getElementById('badge-count-activos').textContent = activos.length;
    document.getElementById('badge-count-pagados').textContent = pagadosFinalizados.length;

    // Renderizar Activos / Pendientes
    const contActivos = document.getElementById('lista-creditos-activos');
    if (activos.length === 0) {
        contActivos.innerHTML = `<p class="col-span-full text-center text-xs text-slate-400 py-8">No hay créditos pendientes de cobro.</p>`;
    } else {
        contActivos.innerHTML = activos.map(c => {
            const saldo = Math.max(0, c.precioTotal - c.montoPagado);
            const porcentaje = c.precioTotal > 0 ? Math.min(100, Math.round((c.montoPagado / c.precioTotal) * 100)) : 0;

            return `
            <article class="glass-panel-sub p-4 flex flex-col justify-between gap-3.5 border-l-4 border-l-amber-500">
                <div>
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <span class="font-display font-extrabold text-base text-slate-900">${c.codigo}</span>
                            <span class="ml-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-brand-700">Talla ${c.talla}</span>
                        </div>
                        <button onclick="eliminarCredito('${c.id}')" class="text-slate-400 hover:text-brand-600 text-xs p-1">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                    <p class="text-sm font-bold text-slate-700 mt-1"><i class="fa-solid fa-user text-brand-500 mr-1.5 text-xs"></i>${c.cliente}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5"><i class="fa-regular fa-calendar mr-1"></i>Llevó el: ${formatFechaLegible(c.fecha)}</p>
                </div>

                <!-- Barra de Progreso y Montos Bs. -->
                <div class="bg-white/80 p-3 rounded-xl space-y-2 border border-rose-100/70">
                    <div class="flex justify-between text-xs">
                        <span class="text-slate-500">Dejó: <strong class="text-emerald-600">${c.montoPagado.toFixed(2)} Bs.</strong></span>
                        <span class="text-slate-500">Total: <strong>${c.precioTotal.toFixed(2)} Bs.</strong></span>
                    </div>
                    <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-amber-400 to-brand-600 rounded-full" style="width: ${porcentaje}%"></div>
                    </div>
                    <div class="flex items-center justify-between pt-0.5">
                        <span class="text-[11px] font-bold uppercase text-slate-400">Saldo pendiente:</span>
                        <span class="font-display text-sm font-extrabold text-brand-600">${saldo.toFixed(2)} Bs.</span>
                    </div>
                </div>

                <!-- Botones de acción rápida -->
                <div class="grid grid-cols-3 gap-1.5 pt-1">
                    <button onclick="abrirModalAbono('${c.id}')" class="px-2 py-2 rounded-xl text-[11px] font-bold bg-brand-600 text-white hover:bg-brand-700 transition flex items-center justify-center gap-1">
                        <i class="fa-solid fa-plus"></i> Abonar
                    </button>
                    <button onclick="marcarCreditoPagadoTotal('${c.id}')" class="px-2 py-2 rounded-xl text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center justify-center gap-1">
                        <i class="fa-solid fa-check"></i> Pagado
                    </button>
                    <button onclick="marcarCreditoDevolvio('${c.id}')" class="px-2 py-2 rounded-xl text-[11px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition flex items-center justify-center gap-1">
                        <i class="fa-solid fa-rotate-left"></i> Devolvió
                    </button>
                </div>
            </article>
            `;
        }).join('');
    }

    // Renderizar Lista de Pagados / Finalizados (con tickeador de liquidación)
    const contPagados = document.getElementById('lista-creditos-pagados');
    if (pagadosFinalizados.length === 0) {
        contPagados.innerHTML = `<p class="col-span-full text-center text-xs text-slate-400 py-8">Aún no hay zapatos pagados o devueltos en esta lista.</p>`;
    } else {
        contPagados.innerHTML = pagadosFinalizados.map(c => {
            const esDevuelto = c.estado === 'Devolvió';

            return `
            <article class="glass-panel-sub p-4 flex flex-col justify-between gap-3 border-l-4 ${esDevuelto ? 'border-l-slate-400' : 'border-l-emerald-500'}">
                <div>
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-display font-extrabold text-base text-slate-900">${c.codigo}</span>
                            <span class="px-2 py-0.5 rounded-md text-xs font-bold bg-white border border-slate-200 text-slate-700">Talla ${c.talla}</span>
                            ${esDevuelto
                                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">DEVOLVIÓ</span>`
                                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700">PAGADO TOTAL</span>`
                            }
                        </div>
                        <button onclick="eliminarCredito('${c.id}')" class="text-slate-400 hover:text-brand-600 text-xs p-1">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                    <p class="text-sm font-bold text-slate-700 mt-1.5"><i class="fa-solid fa-user text-emerald-600 mr-1.5 text-xs"></i>${c.cliente}</p>
                    <div class="flex items-center justify-between text-xs text-slate-500 mt-1">
                        <span><i class="fa-regular fa-calendar mr-1"></i>${formatFechaLegible(c.fecha)}</span>
                        ${!esDevuelto ? `<span class="font-extrabold text-emerald-700">${c.montoPagado.toFixed(2)} Bs.</span>` : `<span>Sin cobro</span>`}
                    </div>
                </div>

                <!-- Tickeador de Liquidación -->
                ${!esDevuelto ? `
                <div class="flex items-center justify-between p-3 rounded-xl transition-all ${c.liquidado ? 'bg-emerald-100/80 border border-emerald-300' : 'bg-rose-50/90 border border-rose-200'}">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid ${c.liquidado ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-brand-600'}"></i>
                        <div>
                            <span class="text-xs font-extrabold block ${c.liquidado ? 'text-emerald-900' : 'text-brand-800'}">
                                ${c.liquidado ? 'Liquidación Realizada' : 'Falta Liquidación'}
                            </span>
                            <span class="text-[10px] ${c.liquidado ? 'text-emerald-700' : 'text-brand-600'}">
                                ${c.liquidado ? 'Rendido y cerrado en caja' : 'Marcar al entregar dinero'}
                            </span>
                        </div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" ${c.liquidado ? 'checked' : ''} onchange="toggleLiquidacion('${c.id}')" class="sr-only peer">
                        <div class="w-12 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                </div>
                ` : `
                <div class="p-2.5 rounded-xl bg-slate-100 text-center text-xs font-semibold text-slate-500">
                    Calzado reingresado a inventario
                </div>
                `}
            </article>
            `;
        }).join('');
    }
}

// =========================================================================
// GENERACIÓN DE REPORTES SEMANALES EN PDF (jsPDF + AutoTable)
// =========================================================================
function exportarTraspasosPDF() {
    const lista = getTraspasosFiltrados();
    if (lista.length === 0) {
        showToast('No hay registros en la semana seleccionada para exportar', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const semanaIso = document.getElementById('filtro-semana').value;
    const rango = getWeekRangeFromISOWeek(semanaIso);
    const tituloSemana = rango
        ? `Semana ${semanaIso} (${formatFechaLegible(rango.start)} al ${formatFechaLegible(rango.end)})`
        : 'Historial General de Movimientos';

    // Encabezado Carmesí
    doc.setFillColor(225, 29, 72);
    doc.rect(0, 0, 297, 26, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE SEMANAL DE TRASPASOS Y CAMBIOS DE ZAPATOS', 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${tituloSemana}  |  Generado: ${new Date().toLocaleDateString('es-BO')}`, 14, 20);

    // Resumen rápido
    const total = lista.length;
    const conDoc = lista.filter(t => t.conDocumento).length;
    const enSist = lista.filter(t => t.subidoSistema).length;

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Registros: ${total}    |    Con Documento: ${conDoc}    |    Deben Documento: ${total - conDoc}    |    Subidos a Sistema: ${enSist}`, 14, 34);

    const rows = lista.map((t, idx) => [
        idx + 1,
        formatFechaLegible(t.fechaRegistro),
        t.codigo,
        t.tipo === 'Cambio' ? 'Cambio de talla' : 'Traspaso',
        t.tienda,
        t.tallaNueva ? `${t.talla} → ${t.tallaNueva}` : t.talla,
        t.horario,
        t.paraQuien,
        t.responsable,
        t.conDocumento ? 'Llegó c/ Doc.' : 'Deben Doc.',
        t.subidoSistema ? `Sí (${formatFechaLegible(t.fechaSistema)})` : 'No'
    ]);

    doc.autoTable({
        startY: 39,
        head: [['#', 'Fecha', 'Código', 'Tipo', 'Tienda Origen', 'Talla', 'Horario', 'Para Quién', 'Encargado', 'Documento', 'Sistema Principal']],
        body: rows,
        theme: 'grid',
        headStyles: {
            fillColor: [190, 18, 60],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [30, 41, 59]
        },
        alternateRowStyles: {
            fillColor: [255, 241, 242]
        },
        margin: { left: 14, right: 14 }
    });

    const nombreArchivo = semanaIso ? `Reporte_Traspasos_${semanaIso}.pdf` : `Reporte_Traspasos_General.pdf`;
    doc.save(nombreArchivo);
    showToast('PDF semanal descargado correctamente', 'success');
}

function exportarCreditosPDF() {
    if (creditos.length === 0) {
        showToast('No hay registros de créditos para exportar', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(225, 29, 72);
    doc.rect(0, 0, 210, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE ZAPATOS A CRÉDITO Y LIQUIDACIONES', 14, 11);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-BO')}`, 14, 18);

    const rows = creditos.map((c, idx) => {
        const saldo = c.estado === 'Dejó a cuenta' ? Math.max(0, c.precioTotal - c.montoPagado) : 0;
        const liqText = c.estado === 'Pagado' ? (c.liquidado ? 'SÍ LIQUIDADO' : 'PENDIENTE') : '—';
        return [
            idx + 1,
            formatFechaLegible(c.fecha),
            c.codigo,
            c.talla,
            c.cliente,
            c.estado,
            `${c.montoPagado.toFixed(2)} Bs.`,
            `${saldo.toFixed(2)} Bs.`,
            liqText
        ];
    });

    doc.autoTable({
        startY: 30,
        head: [['#', 'Fecha', 'Código', 'Talla', 'Cliente', 'Estado', 'Pagado', 'Saldo', 'Liquidación']],
        body: rows,
        theme: 'grid',
        headStyles: {
            fillColor: [190, 18, 60],
            textColor: [255, 255, 255],
            fontSize: 8
        },
        bodyStyles: { fontSize: 7.5 },
        alternateRowStyles: { fillColor: [255, 241, 242] }
    });

    doc.save(`Reporte_Creditos_${getTodayISO()}.pdf`);
    showToast('PDF de créditos descargado', 'success');
}

// =========================================================================
// UI HELPERS: TOASTS Y MODALES (SIN alert/confirm NATIVOS)
// =========================================================================
function showToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const estilos = {
        success: 'bg-white/95 border-emerald-400 text-slate-800',
        error: 'bg-white/95 border-brand-500 text-brand-800',
        info: 'bg-white/95 border-rose-300 text-slate-800'
    };

    const iconos = {
        success: '<i class="fa-solid fa-circle-check text-emerald-500 text-lg"></i>',
        error: '<i class="fa-solid fa-circle-exclamation text-brand-600 text-lg"></i>',
        info: '<i class="fa-solid fa-bell text-brand-500 text-lg"></i>'
    };

    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl border-l-4 backdrop-blur-md transform transition-all duration-300 translate-y-0 ${estilos[tipo] || estilos.info}`;
    toast.innerHTML = `
        ${iconos[tipo] || iconos.info}
        <p class="text-xs sm:text-sm font-bold flex-1">${mensaje}</p>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function openModal() {
    const modal = document.getElementById('custom-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function openConfirmModal(titulo, mensaje, onConfirm) {
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-body').innerHTML = `
        <p class="text-sm text-slate-600">${mensaje}</p>
        <div class="flex justify-end gap-2 pt-3">
            <button onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">Cancelar</button>
            <button id="btn-confirm-action" class="btn-brand px-5 py-2 text-xs font-bold">Sí, confirmar</button>
        </div>
    `;
    openModal();
    document.getElementById('btn-confirm-action').onclick = () => {
        onConfirm();
        closeModal();
    };
}
