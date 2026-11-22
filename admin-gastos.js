// admin-gastos.js - FINAL - Sin prompt, con window.supabaseClient
var filtroGastosActual = 'activo';
var gastosRecientesCache = [];

function getSB() { return window.supabaseClient || supabaseClient; }

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
  console.log('Registrar gasto:', descripcion, categoria, monto);
  if (!descripcion || !monto || monto <= 0) { mostrarMensajeAdmin('gasto-msg', 'Completá concepto y monto válido.', true); return false; }
  var btn = document.getElementById('btn-gasto');
  btn.textContent = 'Registrando...'; btn.disabled = true;
  try {
    var res = await getSB().from('gastos').insert({ descripcion: descripcion, categoria: categoria, monto: monto, proveedor_beneficiario: proveedor || null, fecha: new Date().toISOString().slice(0, 10), estado: 'activo' }).select();
    console.log('Res insert gasto:', res);
    if (res.error) throw res.error;
    mostrarMensajeAdmin('gasto-msg', '¡Gasto registrado!', false);
    document.getElementById('gasto-concepto').value = '';
    document.getElementById('gasto-monto').value = '';
    document.getElementById('gasto-proveedor').value = '';
    await window.cargarDatosAdmin();
  } catch (e) {
    console.error('Error registrarGasto:', e);
    mostrarMensajeAdmin('gasto-msg', 'Error: ' + e.message, true);
    alert('Error al guardar: ' + e.message);
  }
  btn.textContent = 'Registrar Gasto'; btn.disabled = false;
  return false;
};

window.cargarGastosRecientes = async function () {
  var cont = document.getElementById('lista-gastos');
  if (!cont) return;
  var r = await getSB().from('gastos').select('*').eq('estado', filtroGastosActual).order('created_at', { ascending: false }).limit(20);
  var gastos = r.data || [];
  gastosRecientesCache = gastos;
  if (gastos.length === 0) { cont.innerHTML = '<p class="text-xs text-slate-500 text-center">Sin gastos ' + (filtroGastosActual === 'anulado' ? 'anulados.' : 'activos.') + '</p>'; return; }
  cont.innerHTML = gastos.map(function (g) {
    return '<div class="flex justify-between items-start gap-2 border-b pb-2 ' + (g.estado === 'anulado' ? 'opacity-70 bg-red-50 rounded-lg p-2' : '') + '">'
    + '<div class="flex-1"><p class="text-xs font-bold">' + escapeHtml(g.descripcion || '') + '</p>'
    + '<p class="text-[11px] text-slate-500">' + escapeHtml(g.categoria || '') + ' - ' + escapeHtml(g.fecha || '') + (g.proveedor_beneficiario ? ' - ' + escapeHtml(g.proveedor_beneficiario) : '') + '</p>'
    + (g.estado === 'anulado' ? '<p class="text-[11px] font-bold text-red-600 mt-1">⛔ ANULADO: ' + escapeHtml(g.motivo_anulacion || 'sin motivo') + '</p>' : '')
    + '</div><div class="flex flex-col items-end gap-1">'
    + '<span class="text-xs font-bold ' + (g.estado === 'anulado' ? 'text-slate-500 line-through' : 'text-red-600') + '">Gs. ' + Number(g.monto).toLocaleString('es-PY') + '</span>'
    + (g.estado === 'anulado' ? '' : '<div class="flex gap-1">'
      + '<button type="button" data-accion="editar" data-id="' + g.id + '" class="btn-gasto-accion text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">Editar</button>'
      + '<button type="button" data-accion="anular" data-id="' + g.id + '" class="btn-gasto-accion text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">Anular</button></div>')
    + '</div></div>';
  }).join('');
  cont.querySelectorAll('.btn-gasto-accion').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var gasto = gastosRecientesCache.find(function (item) { return String(item.id) === String(btn.dataset.id); });
      if (!gasto) return;
      // Ambos abren el modal, ahí escribís el motivo y anulás. Sin prompt.
      window.abrirEditarGasto(gasto.id, gasto.descripcion || '', gasto.categoria || 'otros', gasto.monto, gasto.proveedor_beneficiario || '', gasto.fecha || '');
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
  document.getElementById('edit-gasto-fecha').value = fecha || new Date().toISOString().slice(0, 10);
  var inpMotivo = document.getElementById('edit-gasto-motivo-anulacion');
  if (inpMotivo) inpMotivo.value = '';
  document.getElementById('edit-gasto-msg').classList.add('hidden');
  document.getElementById('modal-editar-gasto').classList.remove('hidden');
};

window.cerrarModalEditarGasto = function () { document.getElementById('modal-editar-gasto').classList.add('hidden'); };

window.guardarEdicionGasto = async function (event) {
  if (event) event.preventDefault();
  var id = document.getElementById('edit-gasto-id').value;
  var descripcion = document.getElementById('edit-gasto-descripcion').value.trim();
  var categoria = document.getElementById('edit-gasto-categoria').value;
  var monto = limpiarGuaraniesInput(document.getElementById('edit-gasto-monto').value);
  var proveedor = document.getElementById('edit-gasto-proveedor').value.trim();
  var fecha = document.getElementById('edit-gasto-fecha').value;
  if (!descripcion || !monto || monto <= 0) { mostrarMensajeAdmin('edit-gasto-msg', 'Completá descripción y monto válido.', true); return false; }
  var btn = document.getElementById('btn-edit-gasto-guardar');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  var res = await getSB().from('gastos').update({ descripcion: descripcion, categoria: categoria, monto: monto, proveedor_beneficiario: proveedor || null, fecha: fecha }).eq('id', id).eq('estado', 'activo');
  console.log('Res editar gasto:', res);
  if (res.error) { mostrarMensajeAdmin('edit-gasto-msg', 'Error: ' + res.error.message, true); alert('Error: ' + res.error.message); btn.textContent = 'Guardar Cambios'; btn.disabled = false; return false; }
  btn.textContent = 'Guardar Cambios'; btn.disabled = false;
  window.cerrarModalEditarGasto();
  mostrarMensajeAdmin('gasto-msg', '¡Gasto actualizado!', false);
  await window.cargarDatosAdmin();
  return false;
};

// Ahora anular = abrir modal, no prompt
window.anularGasto = function (id, descripcion) {
  var g = gastosRecientesCache.find(function (x) { return String(x.id) === String(id); });
  if (g) window.abrirEditarGasto(g.id, g.descripcion || '', g.categoria || 'otros', g.monto, g.proveedor_beneficiario || '', g.fecha || '');
  else alert('Abrí el gasto con Editar y abajo escribí el motivo para anular.');
};

window.anularGastoDesdeModal = async function () {
  var id = document.getElementById('edit-gasto-id').value;
  var desc = document.getElementById('edit-gasto-descripcion').value;
  var motivoInput = document.getElementById('edit-gasto-motivo-anulacion');
  var motivo = motivoInput ? motivoInput.value.trim() : '';
  if (!motivo) { mostrarMensajeAdmin('edit-gasto-msg', 'Escribí el motivo de anulación.', true); return; }
  if (!confirm('¿Seguro querés ANULAR?\n' + desc)) return;
  var res = await getSB().from('gastos').update({ estado: 'anulado', motivo_anulacion: motivo, anulado_en: new Date().toISOString() }).eq('id', id).eq('estado', 'activo');
  console.log('Res anular:', res);
  if (res.error) { mostrarMensajeAdmin('edit-gasto-msg', 'Error: ' + res.error.message, true); alert('Error: ' + res.error.message); return; }
  window.cerrarModalEditarGasto();
  mostrarMensajeAdmin('gasto-msg', 'Gasto anulado. Queda en historia, no suma en balance.', false);
  await window.cargarDatosAdmin();
};

// Aliases para que el HTML sin window. también los encuentre
var registrarGasto = window.registrarGasto;
var guardarEdicionGasto = window.guardarEdicionGasto;
var anularGasto = window.anularGasto;
var anularGastoDesdeModal = window.anularGastoDesdeModal;
var cambiarFiltroGastos = window.cambiarFiltroGastos;
var cargarGastosRecientes = window.cargarGastosRecientes;
var abrirEditarGasto = window.abrirEditarGasto;
var cerrarModalEditarGasto = window.cerrarModalEditarGasto;