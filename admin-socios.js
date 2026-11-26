// admin-socios.js
async function cargarSocios() {
  const sel = document.getElementById('sel-cliente');
  if (!sel) return;

  const { data, error } = await supabaseClient
    .from('clientes')
    .select('id, nro_cuenta, saldo_favor, personas(nombre, apellido, cedula_ruc)')
    .order('nro_cuenta', { ascending: true });

  sel.innerHTML = '<option value="">-- Seleccioná Socio --</option>';

  if (error) {
    console.warn('Error al cargar socios:', error.message);
    listaSociosCobro = [];
    return;
  }

  listaSociosCobro = data || [];

  listaSociosCobro.forEach((c) => {
    const p = c.personas || {};
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent =
      'Cta ' +
      (c.nro_cuenta || '') +
      ' - ' +
      (p.nombre || '') +
      ' ' +
      (p.apellido || '') +
      ' - CI ' +
      (p.cedula_ruc || '');
    opt.dataset.busqueda = (
      (p.nombre || '') +
      ' ' +
      (p.apellido || '') +
      ' ' +
      (p.cedula_ruc || '') +
      ' ' +
      (c.nro_cuenta || '')
    )
      .toLowerCase()
      .trim();
    sel.appendChild(opt);
  });
}

window.cargarSocios = cargarSocios;

window.filtrarSociosCobro = function () {
  const inputFiltro = document.getElementById('filtro-socio-cobro');
  const sel = document.getElementById('sel-cliente');
  if (!sel) return;

  const texto = (inputFiltro?.value || '').toLowerCase().trim();
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
        if (typeof cargarFacturasSocioSeleccionado === 'function') {
          cargarFacturasSocioSeleccionado();
        }
      }
    });
  }
};

window.guardarNuevoSocioRapido = async function (event) {
  event.preventDefault();

  const { data: ses } = await supabaseClient.auth.getSession();
  if (!ses?.session) {
    alert('Sin sesión de Admin. Logueate primero.');
    return;
  }

  const nombre = (document.getElementById('ns-nombre')?.value || '').trim();
  const apellido = (document.getElementById('ns-apellido')?.value || '').trim();
  const cedula = (document.getElementById('ns-cedula')?.value || '').replace(/\D/g, '').trim();
  const telefono = (document.getElementById('ns-telefono')?.value || '').trim();
  const direccion = (document.getElementById('ns-direccion')?.value || '').trim();
  const cuenta = (document.getElementById('ns-cuenta')?.value || '').trim();

  if (!nombre || !apellido || !cedula || !telefono || !cuenta) {
    mostrarMensajeAdmin('ns-msg', 'Faltan datos obligatorios.', true);
    return;
  }

  const btn = document.getElementById('btn-ns-guardar');
  const textoOriginal = btn ? btn.textContent : 'Guardar Socio';
  if (btn) {
    btn.textContent = 'Guardando...';
    btn.disabled = true;
  }

  let personaCreadaId = null;

  try {
    const { data: persona, error: e1 } = await supabaseClient
      .from('personas')
      .insert({
        nombre,
        apellido,
        cedula_ruc: cedula,
        telefono,
        direccion: direccion || null
      })
      .select()
      .single();

    if (e1) throw e1;
    personaCreadaId = persona.id;

    const { error: e2 } = await supabaseClient
      .from('clientes')
      .insert({
        persona_id: persona.id,
        nro_cuenta: cuenta,
        tipo_tarifa: 'fija',
        saldo_favor: 0,
        activo: true
      });

    if (e2) {
      if (personaCreadaId) {
        await supabaseClient.from('personas').delete().eq('id', personaCreadaId);
      }
      throw e2;
    }

    mostrarMensajeAdmin('ns-msg', 'Socio guardado: ' + nombre + ' ' + apellido, false);
    event.target?.reset();
    await cargarSocios();
  } catch (e) {
    mostrarMensajeAdmin('ns-msg', 'Error: ' + (e?.message || e), true);
  } finally {
    if (btn) {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }
  }
};