// admin-gastos.js - FINAL - Sin prompt, con window.supabaseClient
var filtroGastosActual = 'activo';
window.gastosRecientesCache = window.gastosRecientesCache || [];

function getSB() { return window.supabaseClient || supabaseClient; }

function obtenerHoyISO() {
  var partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).split('-');
  return partes[0] + '-' + partes[1] + '-' + partes[2];
}

function inicializarFechaGastoDefault() {
  var inpFecha = document.getElementById('gasto-fecha');
  if (inpFecha && !inpFecha.value) {
    inpFecha.value = obtenerHoyISO();
  }
}

// Formatea 13 dígitos como XXX-XXX-XXXXXXX (3-3-7)
function formatearNumeroFactura13(valor) {
  var digitos = String(valor || '').replace(/\D/g, '').slice(0, 13);
  var p1 = digitos.slice(0, 3);
  var p2 = digitos.slice(3, 6);
  var p3 = digitos.slice(6, 13);

  var out = p1;
  if (digitos.length > 3) out += '-' + p2;
  if (digitos.length > 6) out += '-' + p3;
  return out;
}

function esFormatoFacturaValido13(valor) {
  return /^\d{3}-\d{3}-\d{7}$/.test(String(valor || '').trim());
}

function configurarValidacionFacturaGasto() {
  var inpNro = document.getElementById('gasto-nro-comprobante');
  var selTipo = document.getElementById('gasto-tipo-comprobante');
  if (!inpNro) return;

  function actualizarPlaceholderYFormato() {
    var esFactura = !selTipo || selTipo.value === 'Factura';
    inpNro.placeholder = esFactura ? '001-001-0001111 (13 números)' : 'Ej: Recibo 0045 o s/n';
    if (esFactura && inpNro.value.trim() !== '') {
      inpNro.value = formatearNumeroFactura13(inpNro.value);
    }
  }

  inpNro.addEventListener('input', function () {
    var esFactura = !selTipo || selTipo.value === 'Factura';
    if (esFactura) {
      var cursorAlFinal = inpNro.selectionStart === inpNro.value.length;
      inpNro.value = formatearNumeroFactura13(inpNro.value);
      if (cursorAlFinal) {
        inpNro.setSelectionRange(inpNro.value.length, inpNro.value.length);
      }
    }
  });

  if (selTipo) {
    selTipo.addEventListener('change', actualizarPlaceholderYFormato);
  }
  actualizarPlaceholderYFormato();
}

window.cambiarFiltroGastos = function (filtro) {
  filtroGastosActual = filtro;
  var btnAct = document.getElementById('btn-gastos-activos');
  var btnAnu = document.getElementById('btn-gastos-anulados');
  if (btnAct) btnAct.className = filtro === 'activo' ? 'px-2 py-1 rounded-full text-[11px] font-bold bg-white text-blue-600 shadow-sm' : 'px-2 py-1 rounded-full text-[11px] font-bold text-slate-500';
  if (btnAnu) btnAnu.className = filtro === 'anulado' ? 'px-2 py-1 rounded-full text-[11px] font-bold bg-white text-red-600 shadow-sm' : 'px-2 py-1 rounded-full text-[11px] font-bold text-slate-500';
  window.cargarGastosRecientes();
};

window.registrarGasto = async function (event) {
  if (event) event.preventDefault();
  var descripcion = document.getElementById('gasto-concepto').value.trim();
  var categoria = document.getElementById('gasto-categoria').value;
  var monto = limpiarGuaraniesInput(document.getElementById('gasto-monto').value);
  var proveedor = document.getElementById('gasto-proveedor').value.trim();
  var fechaEl = document.getElementById('gasto-fecha');
  var fecha = (fechaEl && fechaEl.value) ? fechaEl.value : obtenerHoyISO();
  var tipoComprobanteEl = document.getElementById('gasto-tipo-comprobante');
  var tipoComprobante = tipoComprobanteEl ? tipoComprobanteEl.value : 'Factura';
  var nroComprobanteEl = document.getElementById('gasto-nro-comprobante');
  var nroComprobante = nroComprobanteEl ? nroComprobanteEl.value.trim() : '';
  var medioPagoEl = document.getElementById('gasto-medio-pago');
  var medioPago = medioPagoEl ? medioPagoEl.value : 'efectivo';

  if (!descripcion || !monto || monto <= 0) {
    mostrarMensajeAdmin('gasto-msg', 'Completá concepto y monto válido.', true);
    return false;
  }
  if (!fecha) {
    mostrarMensajeAdmin('gasto-msg', 'Seleccioná la fecha de la factura o gasto.', true);
    return false;
  }

  // Validación de número de factura (formato 001-001-0001111 = 13 números)
  if (tipoComprobante === 'Factura') {
    if (!nroComprobante) {
      mostrarMensajeAdmin('gasto-msg', 'Ingresá el número de factura con formato 001-001-0001111 (13 números).', true);
      if (nroComprobanteEl) nroComprobanteEl.focus();
      return false;
    }
    var nroFormateado = formatearNumeroFactura13(nroComprobante);
    if (nroComprobanteEl) nroComprobanteEl.value = nroFormateado;
    nroComprobante = nroFormateado;

    if (!esFormatoFacturaValido13(nroComprobante)) {
      var cantDigitos = nroComprobante.replace(/\D/g, '').length;
      mostrarMensajeAdmin(
        'gasto-msg',
        'Número de factura inválido (' + cantDigitos + '/13 números). Usá el formato 001-001-0001111.',
        true
      );
      if (nroComprobanteEl) nroComprobanteEl.focus();
      return false;
    }
  }

  var btn = document.getElementById('btn-gasto');
  btn.textContent = 'Registrando...';
  btn.disabled = true;
  try {
    var payload = {
      descripcion: descripcion,
      categoria: categoria,
      monto: monto,
      proveedor_beneficiario: proveedor || null,
      fecha: fecha,
      tipo_comprobante: tipoComprobante || null,
      nro_comprobante: nroComprobante || null,
      medio_pago: medioPago || 'efectivo',
      estado: 'activo'
    };

    var res = await getSB().from('gastos').insert(payload).select();
    if (res.error) throw res.error;

    mostrarMensajeAdmin('gasto-msg', '¡Gasto registrado!', false);
    document.getElementById('gasto-concepto').value = '';
    document.getElementById('gasto-monto').value = '';
    document.getElementById('gasto-proveedor').value = '';
    if (nroComprobanteEl) nroComprobanteEl.value = '';
    if (tipoComprobanteEl) tipoComprobanteEl.value = 'Factura';
    if (medioPagoEl) medioPagoEl.value = 'efectivo';
    if (fechaEl) fechaEl.value = obtenerHoyISO();

    await window.cargarDatosAdmin();
  } catch (e) {
    console.error('Error registrarGasto:', e);
    mostrarMensajeAdmin('gasto-msg', 'Error: ' + e.message, true);
    alert('Error al guardar: ' + e.message);
  }
  btn.textContent = 'Registrar Gasto';
  btn.disabled = false;
  return false;
};

window.cargarGastosRecientes = async function () {
  inicializarFechaGastoDefault();
  configurarValidacionFacturaGasto();
  var cont = document.getElementById('lista-gastos');
  if (!cont) return;
  var r = await getSB().from('gastos').select('*').eq('estado', filtroGastosActual).order('created_at', { ascending: false }).limit(20);
  var gastos = r.data || [];
  window.gastosRecientesCache = gastos;
  if (gastos.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center">Sin gastos ' + (filtroGastosActual === 'anulado' ? 'anulados.' : 'activos.') + '</p>';
    return;
  }
  cont.innerHTML = gastos.map(function (g) {
    var compInfo = [];
    if (g.tipo_comprobante) compInfo.push(g.tipo_comprobante + (g.nro_comprobante ? ' #' + g.nro_comprobante : ''));
    else if (g.nro_comprobante) compInfo.push('Comp. #' + g.nro_comprobante);
    if (g.medio_pago) compInfo.push(g.medio_pago);

    var lineaMeta = (g.categoria || '')
      + ' - ' + (g.fecha || '')
      + (g.proveedor_beneficiario ? ' - ' + g.proveedor_beneficiario : '')
      + (compInfo.length > 0 ? ' - ' + compInfo.join(' · ') : '');

    return '<div class="flex justify-between items-start gap-2 border-b pb-2 ' + (g.estado === 'anulado' ? 'opacity-70 bg-red-50 rounded-lg p-2' : '') + '">'
      + '<div class="flex-1"><p class="text-xs font-bold">' + escapeHtml(g.descripcion || '') + '</p>'
      + '<p class="text-[11px] text-slate-500">' + escapeHtml(lineaMeta) + '</p>'
      + (g.estado === 'anulado' ? '<p class="text-[11px] font-bold text-red-600 mt-1">⛔ ANULADO: ' + escapeHtml(g.motivo_anulacion || 'sin motivo') + '</p>' : '')
      + '</div><div class="flex flex-col items-end gap-1">'
      + '<span class="text-xs font-bold ' + (g.estado === 'anulado' ? 'text-slate-500 line-through' : 'text-red-600') + '">Gs. ' + Number(g.monto).toLocaleString('es-PY') + '</span>'
      + (g.estado === 'anulado' ? '' : '<div class="flex gap-1">'
        + '<button type="button" data-accion="anular" data-id="' + g.id + '" class="btn-gasto-accion text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">Anular</button></div>')
      + '</div></div>';
  }).join('');

  cont.querySelectorAll('.btn-gasto-accion').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var gasto = window.gastosRecientesCache.find(function (item) { return String(item.id) === String(btn.dataset.id); });
      if (!gasto) return;
      window.abrirEditarGasto(gasto.id, gasto.descripcion || '', gasto.categoria || 'otros', gasto.monto, gasto.proveedor_beneficiario || '', gasto.fecha || '');
      setTimeout(function () {
        var inp = document.getElementById('edit-gasto-motivo-anulacion');
        if (inp) inp.focus();
      }, 100);
    });
  });
};
window.cargarGastos = window.cargarGastosRecientes;

window.abrirEditarGasto = function (id, descripcion, categoria, monto, proveedor, fecha) {
  document.getElementById('edit-gasto-id').value = id;
  document.getElementById('edit-gasto-descripcion').value = descripcion;
  document.getElementById('edit-gasto-categoria').value = categoria || 'otros';
  document.getElementById('edit-gasto-monto').value = Number(monto).toLocaleString('es-PY');
  document.getElementById('edit-gasto-proveedor').value = proveedor || '';
  document.getElementById('edit-gasto-fecha').value = fecha || obtenerHoyISO();
  var inpMotivo = document.getElementById('edit-gasto-motivo-anulacion');
  if (inpMotivo) inpMotivo.value = '';
  document.getElementById('edit-gasto-msg').classList.add('hidden');
  document.getElementById('modal-editar-gasto').classList.remove('hidden');
};

window.cerrarModalEditarGasto = function () { document.getElementById('modal-editar-gasto').classList.add('hidden'); };

window.guardarEdicionGasto = async function (event) {
  if (event) event.preventDefault();
  mostrarMensajeAdmin('edit-gasto-msg', 'No se puede editar un gasto. Anulalo con motivo y cargalo de nuevo.', true);
  return false;
};

window.anularGasto = function (id, descripcion) {
  var g = window.gastosRecientesCache.find(function (x) { return String(x.id) === String(id); });
  if (g) window.abrirEditarGasto(g.id, g.descripcion || '', g.categoria || 'otros', g.monto, g.proveedor_beneficiario || '', g.fecha || '');
  else alert('Abrí el gasto con Anular y abajo escribí el motivo para anular.');
};

window.anularGastoDesdeModal = async function () {
  var id = document.getElementById('edit-gasto-id').value;
  var desc = document.getElementById('edit-gasto-descripcion').value;
  var motivoInput = document.getElementById('edit-gasto-motivo-anulacion');
  var motivo = motivoInput ? motivoInput.value.trim() : '';
  if (!motivo) { mostrarMensajeAdmin('edit-gasto-msg', 'Escribí el motivo de anulación.', true); return; }
  if (!confirm('¿Seguro querés ANULAR?\n' + desc)) return;
  var btnAnular = document.getElementById('btn-edit-gasto-anular');
  if (btnAnular) { btnAnular.textContent = 'Anulando...'; btnAnular.disabled = true; }
  var res = await getSB().from('gastos').update({ estado: 'anulado', motivo_anulacion: motivo, anulado_en: new Date().toISOString() }).eq('id', id).eq('estado', 'activo');
  if (btnAnular) { btnAnular.textContent = 'Anular Gasto'; btnAnular.disabled = false; }
  if (res.error) { mostrarMensajeAdmin('edit-gasto-msg', 'Error: ' + res.error.message, true); alert('Error: ' + res.error.message); return; }
  window.cerrarModalEditarGasto();
  mostrarMensajeAdmin('gasto-msg', 'Gasto anulado. Queda en historia, no suma en balance.', false);
  await window.cargarDatosAdmin();
};

var registrarGasto = window.registrarGasto;
var guardarEdicionGasto = window.guardarEdicionGasto;
var anularGasto = window.anularGasto;
var anularGastoDesdeModal = window.anularGastoDesdeModal;
var cambiarFiltroGastos = window.cambiarFiltroGastos;
var cargarGastosRecientes = window.cargarGastosRecientes;
var abrirEditarGasto = window.abrirEditarGasto;
var cerrarModalEditarGasto = window.cerrarModalEditarGasto;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    inicializarFechaGastoDefault();
    configurarValidacionFacturaGasto();
  });
} else {
  inicializarFechaGastoDefault();
  configurarValidacionFacturaGasto();
}