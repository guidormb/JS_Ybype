// admin-donaciones.js - Donaciones / Aportes que entran en Caja

window.abrirModalDonacion = function() {
  document.getElementById('modal-donacion')?.classList.remove('hidden');
  const sel = document.getElementById('don-cliente');
  if (sel && typeof listaSociosCobro !== 'undefined') {
    sel.innerHTML = '<option value="">-- Seleccioná Socio --</option>' + listaSociosCobro.map(s => {
      const per = s.personas || {};
      return '<option value="' + s.id + '">' + escapeHtml((per.nombre || '') + ' ' + (per.apellido || '')) + ' - Cta ' + escapeHtml(s.nro_cuenta || '') + '</option>';
    }).join('');
  }
  toggleDonSocio();
};

window.cerrarModalDonacion = function() {
  document.getElementById('modal-donacion')?.classList.add('hidden');
};

window.toggleDonSocio = function() {
  const tipo = document.getElementById('don-tipo')?.value;
  const box = document.getElementById('box-don-socio');
  if (box) box.style.display = (tipo === 'particular_socio') ? 'block' : 'none';
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
    await cargarDatosAdmin();
    setTimeout(() => cerrarModalDonacion(), 1200);
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