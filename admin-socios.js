// admin-socios.js - Copiado tal cual de tu gigante

async function cargarSocios() {
  const r = await supabase
    .from('clientes')
    .select('id, nro_cuenta, saldo_favor, personas(nombre, apellido, cedula_ruc)')
    .order('nro_cuenta', { ascending: true });
  
  const sel = document.getElementById('sel-cliente');
  sel.innerHTML = '<option value="">-- Seleccioná Socio --</option>';
  listaSociosCobro = r.data || [];
  
  listaSociosCobro.forEach((c) => {
    const p = c.personas || {};
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = 'Cta ' + c.nro_cuenta + ' - ' + (p.nombre || '') + ' ' + (p.apellido || '') + ' - CI ' + (p.cedula_ruc || '');
    opt.dataset.busqueda = ((p.nombre || '') + ' ' + (p.apellido || '') + ' ' + (p.cedula_ruc || '') + ' ' + (c.nro_cuenta || '')).toLowerCase();
    sel.appendChild(opt);
  });
}

window.filtrarSociosCobro = function() {
  const texto = (document.getElementById('filtro-socio-cobro').value || '').toLowerCase().trim();
  const sel = document.getElementById('sel-cliente');
  let visibles = 0;
  
  Array.from(sel.options).forEach((opt) => {
    if (!opt.value) {
      opt.hidden = false;
      return;
    }
    const coincide = !texto || (opt.dataset.busqueda || '').includes(texto);
    opt.hidden = !coincide;
    if (coincide) visibles++;
  });
  
  if (texto && visibles === 1) {
    Array.from(sel.options).forEach((opt) => {
      if (opt.value && !opt.hidden) {
        sel.value = opt.value;
        cargarFacturasSocioSeleccionado();
      }
    });
  }
};

window.abrirModalNuevoSocio = async function() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    alert('Tenés que iniciar sesión como Admin primero.');
    return;
  }
  document.getElementById('modal-nuevo-socio').classList.remove('hidden');
};

window.abrirPadron = async function() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    alert('Tenés que iniciar sesión como Admin primero.');
    return;
  }
  if (window.parent && window.parent !== window) {
    const btnPadron = window.parent.document.querySelector('.nav-btn[data-src*="padron.html"]');
    if (btnPadron) {
      btnPadron.click();
      return;
    }
  }
  window.location.href = 'padron.html';
};

window.cerrarModalNuevoSocio = function() {
  document.getElementById('modal-nuevo-socio').classList.add('hidden');
  document.getElementById('ns-msg').classList.add('hidden');
};

window.guardarNuevoSocioRapido = async function(event) {
  event.preventDefault();
  const { data: ses } = await supabase.auth.getSession();
  if (!ses.session) {
    alert('Sin sesión de Admin. Logueate primero.');
    return;
  }
  
  const nombre = document.getElementById('ns-nombre').value.trim();
  const apellido = document.getElementById('ns-apellido').value.trim();
  const cedula = document.getElementById('ns-cedula').value.trim();
  const telefono = document.getElementById('ns-telefono').value.trim();
  const direccion = document.getElementById('ns-direccion').value.trim();
  const cuenta = document.getElementById('ns-cuenta').value.trim();
  
  if (!nombre || !apellido || !cedula || !telefono || !cuenta) {
    mostrarMensajeAdmin('ns-msg', 'Faltan datos obligatorios.', true);
    return;
  }
  
  const btn = document.getElementById('btn-ns-guardar');
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  
  try {
    const { data: persona, error: e1 } = await supabase
      .from('personas')
      .insert({ nombre, apellido, cedula_ruc: cedula, telefono, direccion: direccion || null })
      .select()
      .single();
    if (e1) throw e1;
    
    const { error: e2 } = await supabase
      .from('clientes')
      .insert({ persona_id: persona.id, nro_cuenta: cuenta, tipo_tarifa: 'fija', saldo_favor: 0, activo: true });
    if (e2) throw e2;
    
    mostrarMensajeAdmin('ns-msg', 'Socio guardado: ' + nombre + ' ' + apellido, false);
    event.target.reset();
    await cargarSocios();
  } catch (e) {
    mostrarMensajeAdmin('ns-msg', 'Error: ' + e.message, true);
  }
  
  btn.textContent = 'Guardar Socio';
  btn.disabled = false;
};