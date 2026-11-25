// admin-donaciones.js - Donaciones / Aportes que entran en Caja
let filtroDonaciones = 'activo';

window.abrirModalDonacion = async function() {
  document.getElementById('modal-donacion')?.classList.remove('hidden');
  const sel = document.getElementById('don-cliente');
  if (sel && typeof listaSociosCobro !== 'undefined') {
    sel.innerHTML = '<option value="">-- Seleccioná Socio --</option>' + listaSociosCobro.map(s => {
      const per = s.personas || {};
      return '<option value="' + s.id + '">' + escapeHtml((per.nombre || '') + ' ' + (per.apellido || '')) + ' - Cta ' + escapeHtml(s.nro_cuenta || '') + '</option>';
    }).join('');
  }
  toggleDonSocio();
  await listarDonaciones();
};

window.cerrarModalDonacion = function() {
  document.getElementById('modal-donacion')?.classList.add('hidden');
};

window.toggleDonSocio = function() {
  const tipo = document.getElementById('don-tipo')?.value;
  const box = document.getElementById('box-don-socio');
  if (box) box.style.display = (tipo === 'particular_socio') ? 'block' : 'none';
};

window.setFiltroDonaciones = async function(f) {
  filtroDonaciones = f;
  ['activo', 'anulado', 'todos'].forEach(x => {
    const b = document.getElementById('btn-don-' + x);
    if (b) {
      b.className = (x === f) ?
        'flex-1 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white' :
        'flex-1 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-600';
    }
  });
  await listarDonaciones();
};

window.listarDonaciones = async function() {
  const cont = document.getElementById('lista-donaciones');
  if (!cont) return;
  cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-3">Cargando...</p>';
  let q = supabaseClient.from('donaciones').select('*, clientes(nro_cuenta, personas(nombre, apellido))').order('created_at', { ascending: false });
  if (filtroDonaciones !== 'todos') q = q.eq('estado', filtroDonaciones);
  const { data, error } = await q;
  if (error) { cont.innerHTML = '<p class="text-xs text-red-500 text-center">Error: ' + escapeHtml(error.message) + '</p>'; return; }
  const lista = data || [];
  if (lista.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No hay donaciones en este filtro.</p>';
    return;
  }
  cont.innerHTML = lista.map(d => {
    const c = d.clientes || {};
    const per = c.personas || {};
    const nombreSocio = ((per.nombre || '') + ' ' + (per.apellido || '')).trim();
    const quien = d.tipo === 'particular_socio' ?
      'Socio: ' + nombreSocio + ' - Cta ' + (c.nro_cuenta || '') :
      (d.origen || d.tipo || '-');
    const fecha = d.created_at ? new Date(d.created_at).toLocaleDateString('es-PY') : (d.fecha || '-');
    const esAnulado = d.estado === 'anulado';
    return '<div class="flex justify-between items-start gap-2 border-b border-slate-100 py-2">' +
      '<div class="flex-1">' +
      '<p class="text-xs font-bold ' + (esAnulado ? 'text-slate-400 line-through' : 'text-slate-800') + '">' + escapeHtml(quien) + '</p>' +
      '<p class="text-[11px] text-slate-500">' + escapeHtml(fecha) + ' • ' + escapeHtml(d.concepto || 'Sin concepto') + '</p>' +
      (esAnulado ? '<span class="inline-block mt-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">ANULADA</span>' : '<span class="inline-block mt-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">ACTIVA</span>') +
      '</div>' +
      '<div class="text-right shrink-0">' +
      '<p class="text-sm font-bold ' + (esAnulado ? 'text-slate-400 line-through' : 'text-emerald-600') + '">Gs. ' + Number(d.monto || 0).toLocaleString('es-PY') + '</p>' +
      (!esAnulado ? '<button type="button" onclick="anularDonacion(\'' + d.id + '\')" class="mt-1 text-[11px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">Anular ✕</button>' : '') +
      '</div>' +
      '</div>';
  }).join('');
};

window.anularDonacion = async function(id) {
  if (!confirm('¿Anular esta donación? Ya no va a sumar en Caja.')) return;
  const { error } = await supabaseClient.from('donaciones').update({ estado: 'anulado' }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await listarDonaciones();
  await cargarDatosAdmin();
  if (typeof cargarBalance === 'function') await cargarBalance();
};

window.registrarDonacion = async function(event) {
  event.preventDefault();
  const tipo = document.getElementById('don-tipo')?.value;
  const clienteId = document.getElementById('don-cliente')?.value || null;
  const origen = document.getElementById('don-origen')?.value.trim();
  const monto = limpiarGuaraniesInput(document.getElementById('don-monto')?.value);
  const concepto = document.getElementById('don-concepto')?.value.trim();
  
  if (!monto || monto <= 0) {
    mostrarMensajeAdmin('don-msg', 'Poné un monto válido.', true);
    return;
  }
  if (tipo === 'particular_socio' && !clienteId) {
    mostrarMensajeAdmin('don-msg', 'Elegí el socio que dona.', true);
    return;
  }
  
  const btn = document.getElementById('btn-don-guardar');
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  
  try {
    const { error } = await supabaseClient.from('donaciones').insert({
      tipo: tipo,
      cliente_id: tipo === 'particular_socio' ? clienteId : null,
      origen: origen || null,
      monto: monto,
      concepto: concepto || null,
      estado: 'activo'
    });
    if (error) throw error;
    
    mostrarMensajeAdmin('don-msg', '¡Donación de Gs. ' + monto.toLocaleString('es-PY') + ' registrada! Ya entró en Caja.', false);
    document.getElementById('don-monto').value = '';
    document.getElementById('don-origen').value = '';
    document.getElementById('don-concepto').value = '';
    await setFiltroDonaciones('activo');
    await cargarDatosAdmin();
    if (typeof cargarBalance === 'function') await cargarBalance();
  } catch (e) {
    mostrarMensajeAdmin('don-msg', 'Error: ' + e.message, true);
  }
  btn.textContent = 'Guardar Donación en Caja';
  btn.disabled = false;
};

window.cargarTotalDonaciones = async function() {
  const { data } = await supabaseClient.from('donaciones').select('monto').eq('estado', 'activo');
  const total = (data || []).reduce((a, d) => a + Number(d.monto || 0), 0);
  const el = document.getElementById('total-donaciones');
  if (el) el.textContent = 'Gs. ' + total.toLocaleString('es-PY');
  return total;
};