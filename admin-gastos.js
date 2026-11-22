// admin-gastos.js - CORREGIDO: Anular en vez de Borrar. No se pierde historia.
// Filtro: 'activo' por defecto = no muestra anulados. 'anulado' = muestra solo anulados.
let filtroGastosActual = 'activo';
let gastosRecientesCache = [];

window.cambiarFiltroGastos = function(filtro) {
  filtroGastosActual = filtro;
  const btnAct = document.getElementById('btn-gastos-activos');
  const btnAnu = document.getElementById('btn-gastos-anulados');
  if (btnAct) btnAct.className = filtro === 'activo' ?
    'px-2 py-1 rounded-full text-[11px] font-bold bg-white text-blue-600 shadow-sm' :
    'px-2 py-1 rounded-full text-[11px] font-bold text-slate-500';
  if (btnAnu) btnAnu.className = filtro === 'anulado' ?
    'px-2 py-1 rounded-full text-[11px] font-bold bg-white text-red-600 shadow-sm' :
    'px-2 py-1 rounded-full text-[11px] font-bold text-slate-500';
  cargarGastosRecientes();
};

window.registrarGasto = async function(event) {
  event.preventDefault();
  const descripcion = document.getElementById('gasto-concepto').value.trim();
  const categoria = document.getElementById('gasto-categoria').value;
  const monto = limpiarGuaraniesInput(document.getElementById('gasto-monto').value);
  const proveedor = document.getElementById('gasto-proveedor').value.trim();
  if (!descripcion || !monto || monto <= 0) {
    mostrarMensajeAdmin('gasto-msg', 'Completá concepto y monto válido.', true);
    return;
  }
  const btn = document.getElementById('btn-gasto');
  btn.textContent = 'Registrando...';
  btn.disabled = true;
  try {
    const { error } = await supabaseClient.from('gastos').insert({
      descripcion,
      categoria,
      monto,
      proveedor_beneficiario: proveedor || null,
      fecha: new Date().toISOString().slice(0, 10),
      nota: null,
      empleado_id: null,
      estado: 'activo' // <-- nuevo gasto nace activo
    });
    if (error) throw error;
    mostrarMensajeAdmin('gasto-msg', '¡Gasto registrado!', false);
    document.getElementById('gasto-concepto').value = '';
    document.getElementById('gasto-monto').value = '';
    document.getElementById('gasto-proveedor').value = '';
    await cargarDatosAdmin();
  } catch (e) {
    mostrarMensajeAdmin('gasto-msg', 'Error: ' + e.message, true);
  }
  btn.textContent = 'Registrar Gasto';
  btn.disabled = false;
};

async function cargarGastosRecientes() {
  const cont = document.getElementById('lista-gastos');
  if (!cont) return;
  // SOLO trae según filtro. Por defecto 'activo' = anulados NO aparecen, NO suman.
  const r = await supabaseClient.from('gastos').select('*').eq('estado', filtroGastosActual).order('created_at', { ascending: false }).limit(20);
  const gastos = r.data || [];
  gastosRecientesCache = gastos;
  if (gastos.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center">Sin gastos ' + (filtroGastosActual === 'anulado' ? 'anulados.' : 'activos.') + '</p>';
    return;
  }
  cont.innerHTML = gastos.map((g) => (
    '<div class="flex justify-between items-start gap-2 border-b pb-2 ' + (g.estado === 'anulado' ? 'opacity-70 bg-red-50 rounded-lg p-2' : '') + '">' +
    '<div class="flex-1">' +
    '<p class="text-xs font-bold">' + escapeHtml(g.descripcion || g.categoria || '') + '</p>' +
    '<p class="text-[11px] text-slate-500">' + escapeHtml(g.categoria || '') + ' - ' + escapeHtml(g.fecha || '') + (g.proveedor_beneficiario ? ' - ' + escapeHtml(g.proveedor_beneficiario) : '') + '</p>' +
    (g.estado === 'anulado' ? '<p class="text-[11px] font-bold text-red-600 mt-1">⛔ ANULADO: ' + escapeHtml(g.motivo_anulacion || 'sin motivo') + '</p>' : '') +
    '</div>' +
    '<div class="flex flex-col items-end gap-1">' +
    '<span class="text-xs font-bold ' + (g.estado === 'anulado' ? 'text-slate-500 line-through' : 'text-red-600') + '">Gs. ' + Number(g.monto).toLocaleString('es-PY') + '</span>' +
    (g.estado === 'anulado' ?
      '' :
      '<div class="flex gap-1">' +
      '<button type="button" data-accion="editar" data-id="' + escapeHtml(g.id) + '" class="btn-gasto-accion text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">Editar</button>' +
      '<button type="button" data-accion="anular" data-id="' + escapeHtml(g.id) + '" class="btn-gasto-accion text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">Anular</button>' +
      '</div>') +
    '</div></div>'
  )).join('');
  cont.querySelectorAll('.btn-gasto-accion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gasto = gastosRecientesCache.find((item) => String(item.id) === String(btn.dataset.id));
      if (!gasto) return;
      if (btn.dataset.accion === 'editar') {
        abrirEditarGasto(gasto.id, gasto.descripcion || '', gasto.categoria || 'otros', gasto.monto, gasto.proveedor_beneficiario || '', gasto.fecha || '');
      } else if (btn.dataset.accion === 'anular') {
        anularGasto(gasto.id, gasto.descripcion || '');
      }
    });
  });
}

window.abrirEditarGasto = function(id, descripcion, categoria, monto, proveedor, fecha) {
  document.getElementById('edit-gasto-id').value = id;
  document.getElementById('edit-gasto-descripcion').value = descripcion;
  document.getElementById('edit-gasto-categoria').value = categoria || 'otros';
  document.getElementById('edit-gasto-monto').value = Number(monto).toLocaleString('es-PY');
  document.getElementById('edit-gasto-proveedor').value = proveedor || '';
  document.getElementById('edit-gasto-fecha').value = fecha || new Date().toISOString().slice(0, 10);
  const inpMotivo = document.getElementById('edit-gasto-motivo-anulacion');
  if (inpMotivo) inpMotivo.value = '';
  document.getElementById('edit-gasto-msg').classList.add('hidden');
  document.getElementById('modal-editar-gasto').classList.remove('hidden');
};

window.cerrarModalEditarGasto = function() {
  document.getElementById('modal-editar-gasto').classList.add('hidden');
};

window.guardarEdicionGasto = async function(event) {
  event.preventDefault();
  const id = document.getElementById('edit-gasto-id').value;
  const descripcion = document.getElementById('edit-gasto-descripcion').value.trim();
  const categoria = document.getElementById('edit-gasto-categoria').value;
  const monto = limpiarGuaraniesInput(document.getElementById('edit-gasto-monto').value);
  const proveedor = document.getElementById('edit-gasto-proveedor').value.trim();
  const fecha = document.getElementById('edit-gasto-fecha').value;
  if (!descripcion || !monto || monto <= 0) {
    mostrarMensajeAdmin('edit-gasto-msg', 'Completá descripción y monto válido.', true);
    return;
  }
  const btn = document.getElementById('btn-edit-gasto-guardar');
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  const { error } = await supabaseClient
    .from('gastos')
    .update({ descripcion, categoria, monto, proveedor_beneficiario: proveedor || null, fecha })
    .eq('id', id)
    .eq('estado', 'activo'); // no deja editar un anulado
  if (error) {
    mostrarMensajeAdmin('edit-gasto-msg', 'Error: ' + error.message, true);
    btn.textContent = 'Guardar Cambios';
    btn.disabled = false;
    return;
  }
  btn.textContent = 'Guardar Cambios';
  btn.disabled = false;
  cerrarModalEditarGasto();
  mostrarMensajeAdmin('gasto-msg', '¡Gasto actualizado!', false);
  await cargarDatosAdmin();
};

// === ANULAR, NO BORRAR ===
window.anularGasto = async function(id, descripcion) {
  const motivo = prompt('¿Por qué anulás este gasto?\n' + (descripcion || '') + '\nEj: cargado por error, duplicado');
  if (!motivo || !motivo.trim()) { alert('Tenés que escribir el motivo para anular.'); return; }
  if (!confirm('¿Seguro querés ANULAR?\n' + (descripcion || '') + '\nVa a dejar de contar en el balance, pero queda guardado en historia.')) return;
  const { error } = await supabaseClient.from('gastos').update({
    estado: 'anulado',
    motivo_anulacion: motivo.trim(),
    anulado_en: new Date().toISOString()
  }).eq('id', id).eq('estado', 'activo');
  if (error) { alert('Error: ' + error.message); return; }
  await cargarDatosAdmin();
};

// Alias para compatibilidad con código viejo
window.eliminarGasto = window.anularGasto;

window.anularGastoDesdeModal = async function() {
  const id = document.getElementById('edit-gasto-id').value;
  const desc = document.getElementById('edit-gasto-descripcion').value;
  const motivoInput = document.getElementById('edit-gasto-motivo-anulacion');
  const motivo = motivoInput ? motivoInput.value.trim() : '';
  if (!motivo) { mostrarMensajeAdmin('edit-gasto-msg', 'Escribí el motivo de anulación.', true); return; }
  if (!confirm('¿Seguro querés ANULAR?\n' + desc + '\nVa a dejar de contar en el balance, pero queda guardado.')) return;
  const { error } = await supabaseClient.from('gastos').update({
    estado: 'anulado',
    motivo_anulacion: motivo,
    anulado_en: new Date().toISOString()
  }).eq('id', id).eq('estado', 'activo');
  if (error) { mostrarMensajeAdmin('edit-gasto-msg', 'Error: ' + error.message, true); return; }
  cerrarModalEditarGasto();
  mostrarMensajeAdmin('gasto-msg', 'Gasto anulado. Queda en historia, no suma en balance.', false);
  await cargarDatosAdmin();
};

// Alias para que el HTML viejo que llama a eliminarGastoDesdeModal siga andando
window.eliminarGastoDesdeModal = window.anularGastoDesdeModal;
