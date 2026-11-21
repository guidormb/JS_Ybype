// admin-utils.js
function escapeHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearGuaraniesInput(inputEl) {
  if (!inputEl) return;
  const v = inputEl.value.replace(/\D/g, '');
  if (!v) {
    inputEl.value = '';
    return;
  }
  inputEl.value = Number(v).toLocaleString('es-PY');
}

function limpiarGuaraniesInput(valor) {
  if (!valor) return 0;
  return Number(String(valor).replace(/\./g, '').replace(/,/g, '').trim()) || 0;
}

function mostrarMensajeAdmin(id, texto, esError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = esError ?
    'mt-3 p-3 rounded-xl text-xs text-center font-medium bg-red-50 text-red-600' :
    'mt-3 p-3 rounded-xl text-xs text-center font-medium bg-emerald-50 text-emerald-700';
  el.classList.remove('hidden');
}

window.toggleCampoAnticipo = function() {
  const chk = document.getElementById('chk-generar-anticipo');
  const box = document.getElementById('box-monto-anticipo');
  if (!chk || !box) return;
  box.classList.toggle('hidden', !chk.checked);
  if (!chk.checked) {
    document.getElementById('inp-monto-anticipo').value = '';
  }
};

window.cambiarPestanaAdmin = function(pestana) {
  ['cobrar', 'gastos', 'cuotas', 'reportes'].forEach((t) => {
    document.getElementById('seccion-' + t).classList.toggle('hidden', t !== pestana);
    const btn = document.getElementById('tab-btn-' + t);
    btn.className = 'tab-btn flex-1 ' + (t === pestana ? 'activo' : 'no-activo');
  });
};

window.cambiarModoReporte = function(modo) {
  modoReporteActual = modo;
  const btnMes = document.getElementById('modo-rep-mes');
  const btnRango = document.getElementById('modo-rep-rango');
  const boxMes = document.getElementById('filtro-rep-mes');
  const boxRango = document.getElementById('filtro-rep-rango');
  if (modo === 'mes') {
    btnMes.className = 'py-2 text-xs font-bold rounded-lg bg-white text-blue-600 shadow-sm';
    btnRango.className = 'py-2 text-xs font-bold rounded-lg text-slate-500';
    boxMes.classList.remove('hidden');
    boxRango.classList.add('hidden');
  } else {
    btnRango.className = 'py-2 text-xs font-bold rounded-lg bg-white text-blue-600 shadow-sm';
    btnMes.className = 'py-2 text-xs font-bold rounded-lg text-slate-500';
    boxRango.classList.remove('hidden');
    boxMes.classList.add('hidden');
  }
};