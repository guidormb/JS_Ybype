// admin-gastos.js
window.registrarGasto = async function (event) {
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
    const { error } = await supabase.from('gastos').insert({
      descripcion, categoria, monto,
      proveedor_beneficiario: proveedor || null,
      fecha: new Date().toISOString().slice(0, 10),
      nota: null, empleado_id: null
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
  const r = await supabase.from('gastos').select('*').order('created_at', { ascending: false }).limit(20);
  const gastos = r.data || [];
  gastosRecientesCache = gastos;
  if (gastos.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center">Sin gastos aún.</p>';
    return;
  }
  cont.innerHTML = gastos.map((g) => (
    '<div class="flex justify-between items-start gap-2 border-b pb-2">'
    + '<div class="flex-1">'
    + '<p class="text-xs font-bold">' + escapeHtml(g.descripcion || g.categoria || '') + '</p>'
    + '<p class="text-[11px] text-slate-500">' + escapeHtml(g.categoria || '') + ' - ' + escapeHtml(g.fecha || '') + (g.proveedor_beneficiario ? ' - ' + escapeHtml(g.proveedor_beneficiario) : '') + '</p>'
    + '</div>'
    + '<div class="flex flex-col items-end gap-1">'
    + '<span class="text-xs font-bold text-red-600">Gs. ' + Number(g.monto).toLocaleString('es-PY') + '</span>'
    + '<div class="flex gap-1">'
    + '<button type="button" data-accion="editar" data-id="' + escapeHtml(g.id) + '" class="btn-gasto-accion text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">Editar</button>'
    + '<button type="button" data-accion="borrar" data-id="' + escapeHtml(g.id) + '" class="btn-gasto-accion text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">Borrar</button>'
    + '</div></div></div>'
  )).join('');
  cont.querySelectorAll('.btn-gasto-accion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gasto = gastosRecientesCache.find((item) => String(item.id) === String(btn.dataset.id));
      if (!gasto) return;
      if (btn.dataset.accion === 'editar') {
        abrirEditarGasto(gasto.id, gasto.descripcion || '', gasto.categoria || 'otros', gasto.monto, gasto.proveedor_beneficiario || '', gasto.fecha || '');
      } else if (btn.dataset.accion === 'borrar') {
        eliminarGasto(gasto.id, gasto.descripcion || '');
      }
    });
  });
}

window.abrirEditarGasto = function (id, descripcion, categoria, monto, proveedor, fecha) {
  document.getElementById('edit-gasto-id').value = id;
  document.getElementById('edit-gasto-descripcion').value = descripcion;
  document.getElementById('edit-gasto-categoria').value = categoria || 'otros';
  document.getElementById('edit-gasto-monto').value = Number(monto).toLocaleString('es-PY');
  document.getElementById('edit-gasto-proveedor').value = proveedor || '';
  document.getElementById('edit-gasto-fecha').value = fecha || new Date().toISOString().slice(0, 10);
  document.getElementById('edit-gasto-msg').classList.add('hidden');
  document.getElementById('modal-editar-gasto').classList.remove('hidden');
};

window.cerrarModalEditarGasto = function () {
  document.getElementById('modal-editar-gasto').classList.add('hidden');
};

window.guardarEdicionGasto = async function (event) {
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
  const { error } = await supabase.from('gastos').update({ descripcion, categoria, monto, proveedor_beneficiario: proveedor || null, fecha }).eq('id', id);
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

window.eliminarGasto = async function (id, descripcion) {
  if (!confirm('¿Borrar este gasto?\n' + (descripcion || '') + '\nEsta acción no se puede deshacer.')) return;
  const { error } = await supabase.from('gastos').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await cargarDatosAdmin();
};

window.eliminarGastoDesdeModal = async function () {
  const id = document.getElementById('edit-gasto-id').value;
  const desc = document.getElementById('edit-gasto-descripcion').value;
  cerrarModalEditarGasto();
  await eliminarGasto(id, desc);
};