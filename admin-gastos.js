// admin-gastos.js - FINAL - Sin prompt, con window.supabaseClient + Padrón de Proveedores
var filtroGastosActual = 'activo';
window.gastosRecientesCache = window.gastosRecientesCache || [];
window.proveedoresGastosCache = window.proveedoresGastosCache || [];

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

function normalizarTimbrado(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function normalizarRuc(valor) {
  return String(valor || '').trim().toUpperCase().replace(/\s+/g, '');
}

function normalizarTexto(valor) {
  return String(valor || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function verificarVigenciaTimbradoGasto() {
  var alertaEl = document.getElementById('gasto-alerta-timbrado');
  if (!alertaEl) return;

  var sel = document.getElementById('gasto-proveedor-select');
  var provId = sel ? sel.value : '';
  var fechaEl = document.getElementById('gasto-fecha');
  var fechaGasto = (fechaEl && fechaEl.value) ? fechaEl.value : obtenerHoyISO();

  if (!provId) {
    alertaEl.classList.add('hidden');
    alertaEl.textContent = '';
    return;
  }

  var prov = window.proveedoresGastosCache.find(function (x) {
    return String(x.id) === String(provId);
  });

  if (!prov || !prov.fecha_fin_timbrado) {
    alertaEl.classList.add('hidden');
    alertaEl.textContent = '';
    return;
  }

  if (fechaGasto > prov.fecha_fin_timbrado) {
    alertaEl.className = 'text-[11px] font-semibold rounded-lg p-2 bg-amber-50 text-amber-800 border border-amber-300';
    alertaEl.textContent = 'Atención: la fecha del comprobante (' + fechaGasto + ') es posterior al fin de vigencia del timbrado registrado (' + prov.fecha_fin_timbrado + '). Verificá el talonario antes de guardar.';
    alertaEl.classList.remove('hidden');
  } else {
    alertaEl.className = 'text-[11px] font-semibold rounded-lg p-2 bg-emerald-50 text-emerald-800 border border-emerald-200';
    alertaEl.textContent = 'Timbrado vigente hasta ' + prov.fecha_fin_timbrado + '.';
    alertaEl.classList.remove('hidden');
  }
}

function configurarSelectorProveedorGasto() {
  var sel = document.getElementById('gasto-proveedor-select');
  var fechaEl = document.getElementById('gasto-fecha');
  var inpProv = document.getElementById('gasto-proveedor');
  var inpRuc = document.getElementById('gasto-ruc');

  if (sel && sel.dataset.bound !== '1') {
    sel.dataset.bound = '1';
    sel.addEventListener('change', function () {
      var prov = window.proveedoresGastosCache.find(function (x) {
        return String(x.id) === String(sel.value);
      });

      if (!prov) {
        verificarVigenciaTimbradoGasto();
        return;
      }

      var p = prov.personas || {};
      var nombre = ((p.nombre || '') + ' ' + (p.apellido || '')).trim();
      var inpTimb = document.getElementById('gasto-timbrado');

      if (inpProv && nombre) inpProv.value = nombre;
      if (inpRuc && p.cedula_ruc) inpRuc.value = normalizarRuc(p.cedula_ruc);
      if (inpTimb && prov.timbrado_vigente) inpTimb.value = normalizarTimbrado(prov.timbrado_vigente);

      verificarVigenciaTimbradoGasto();
    });
  }

  if (inpProv && inpProv.dataset.provEditBound !== '1') {
    inpProv.dataset.provEditBound = '1';
    inpProv.addEventListener('input', function () {
      if (sel && sel.value) {
        sel.value = '';
        verificarVigenciaTimbradoGasto();
      }
    });
  }

  if (inpRuc && inpRuc.dataset.rucEditBound !== '1') {
    inpRuc.dataset.rucEditBound = '1';
    inpRuc.addEventListener('input', function () {
      if (sel && sel.value) {
        sel.value = '';
        verificarVigenciaTimbradoGasto();
      }
    });
  }

  if (fechaEl && fechaEl.dataset.provBound !== '1') {
    fechaEl.dataset.provBound = '1';
    fechaEl.addEventListener('change', verificarVigenciaTimbradoGasto);
  }
}

async function cargarProveedoresParaGastos() {
  var sel = document.getElementById('gasto-proveedor-select');
  if (!sel) return;

  var valorPrevio = sel.value;

  try {
    var res = await getSB()
      .from('proveedores')
      .select('id, persona_id, timbrado_vigente, fecha_fin_timbrado, activo, personas(nombre, apellido, cedula_ruc)')
      .eq('activo', true)
      .order('created_at', { ascending: false });

    if (res.error) {
      console.warn('No se pudieron cargar proveedores para gastos:', res.error.message);
      return;
    }

    window.proveedoresGastosCache = res.data || [];

    sel.innerHTML = '<option value="">-- Seleccionar proveedor o cargar manual --</option>' +
      window.proveedoresGastosCache.map(function (prov) {
        var p = prov.personas || {};
        var nombre = ((p.nombre || '') + ' ' + (p.apellido || '')).trim() || 'Sin nombre';
        var rucTexto = p.cedula_ruc ? ' - RUC ' + p.cedula_ruc : '';
        var timbTexto = prov.timbrado_vigente ? ' (Timb. ' + prov.timbrado_vigente + ')' : '';
        return '<option value="' + escapeHtml(prov.id) + '">' + escapeHtml(nombre + rucTexto + timbTexto) + '</option>';
      }).join('');

    if (valorPrevio && window.proveedoresGastosCache.some(function (x) { return String(x.id) === String(valorPrevio); })) {
      sel.value = valorPrevio;
    }

    configurarSelectorProveedorGasto();
    verificarVigenciaTimbradoGasto();
  } catch (e) {
    console.warn('Error cargando proveedores en gastos:', e);
  }
}

function configurarValidacionFacturaGasto() {
  var inpNro = document.getElementById('gasto-nro-comprobante');
  var selTipo = document.getElementById('gasto-tipo-comprobante');
  var inpTimbrado = document.getElementById('gasto-timbrado');
  if (!inpNro) return;

  function actualizarPlaceholderYFormato() {
    var esFactura = !selTipo || selTipo.value === 'Factura';
    inpNro.placeholder = esFactura ? '001-001-0001111 (13 números)' : 'Ej: Recibo 0045 o s/n';
    if (esFactura && inpNro.value.trim() !== '') {
      inpNro.value = formatearNumeroFactura13(inpNro.value);
    }
    if (inpTimbrado) {
      inpTimbrado.placeholder = esFactura ? 'Ej: 12345678' : 'Opcional';
    }
  }

  if (inpNro.dataset.bound !== '1') {
    inpNro.dataset.bound = '1';
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
  }

  if (inpTimbrado && inpTimbrado.dataset.bound !== '1') {
    inpTimbrado.dataset.bound = '1';
    inpTimbrado.addEventListener('input', function () {
      inpTimbrado.value = normalizarTimbrado(inpTimbrado.value);
    });
  }

  if (selTipo && selTipo.dataset.bound !== '1') {
    selTipo.dataset.bound = '1';
    selTipo.addEventListener('change', actualizarPlaceholderYFormato);
  }
  actualizarPlaceholderYFormato();
}

async function buscarPersonaIdPorRuc(ruc) {
  if (!ruc) return null;
  try {
    var res = await getSB()
      .from('personas')
      .select('id, cedula_ruc')
      .eq('cedula_ruc', ruc)
      .limit(1)
      .maybeSingle();
    return (res && res.data && res.data.id) ? res.data.id : null;
  } catch (e) {
    return null;
  }
}

// Verifica:
// 1) Si el timbrado ya está asignado a otro RUC en gastos activos
// 2) Si ya existe una factura activa duplicada (mismo RUC/Proveedor + Timbrado + Nro. Factura)
async function validarFiscalFacturaActiva(ruc, proveedor, timbrado, nroComprobante) {
  var rucNorm = normalizarRuc(ruc);
  var provNorm = normalizarTexto(proveedor);

  // Control 1: Timbrado único por RUC en facturas activas
  if (rucNorm && timbrado) {
    var resTimb = await getSB()
      .from('gastos')
      .select('id, ruc, proveedor_beneficiario, descripcion, timbrado')
      .eq('tipo_comprobante', 'Factura')
      .eq('timbrado', timbrado)
      .neq('estado', 'anulado')
      .not('ruc', 'is', null);

    if (!resTimb.error && Array.isArray(resTimb.data)) {
      var conflictoTimbrado = resTimb.data.find(function (row) {
        var rowRuc = normalizarRuc(row.ruc);
        return rowRuc && rowRuc !== rucNorm;
      });
      if (conflictoTimbrado) {
        return {
          bloqueado: true,
          mensaje: 'Timbrado #' + timbrado + ' ya figura con RUC ' + normalizarRuc(conflictoTimbrado.ruc) + ' (' + (conflictoTimbrado.proveedor_beneficiario || conflictoTimbrado.descripcion || 'otro proveedor') + '). Un timbrado es único por RUC.'
        };
      }
    }
  }

  // Control 2: Factura duplicada activa (mismo Nro. Comprobante + Timbrado + RUC/Proveedor)
  var q = await getSB()
    .from('gastos')
    .select('id, descripcion, fecha, ruc, timbrado, nro_comprobante, proveedor_beneficiario, estado')
    .eq('tipo_comprobante', 'Factura')
    .eq('nro_comprobante', nroComprobante)
    .eq('timbrado', timbrado)
    .neq('estado', 'anulado');

  if (q.error) {
    console.warn('No se pudo verificar duplicado de factura:', q.error.message);
    return { bloqueado: false };
  }

  var candidatos = q.data || [];
  if (candidatos.length === 0) return { bloqueado: false };

  var duplicada = candidatos.find(function (item) {
    var itemRuc = normalizarRuc(item.ruc);
    var itemProv = normalizarTexto(item.proveedor_beneficiario);

    if (rucNorm && itemRuc) {
      return rucNorm === itemRuc;
    }
    if (!rucNorm && !itemRuc && provNorm && itemProv) {
      return provNorm === itemProv;
    }
    return false;
  });

  if (duplicada) {
    return {
      bloqueado: true,
      mensaje: 'Factura duplicada: ya existe un gasto activo con Factura #' + nroComprobante + ' y Timbrado #' + timbrado + (rucNorm ? ' (RUC ' + rucNorm + ')' : '') + ' - ' + (duplicada.descripcion || 'sin descripción') + '.'
    };
  }

  return { bloqueado: false };
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
  var selProv = document.getElementById('gasto-proveedor-select');
  var proveedorId = (selProv && selProv.value) ? selProv.value : null;
  var proveedor = document.getElementById('gasto-proveedor').value.trim();
  var rucEl = document.getElementById('gasto-ruc');
  var ruc = rucEl ? normalizarRuc(rucEl.value) : '';
  var timbradoEl = document.getElementById('gasto-timbrado');
  var timbrado = timbradoEl ? normalizarTimbrado(timbradoEl.value) : '';
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

    if (!timbrado || timbrado.length < 7) {
      mostrarMensajeAdmin('gasto-msg', 'Ingresá un número de timbrado válido (7 a 8 números) para la factura.', true);
      if (timbradoEl) timbradoEl.focus();
      return false;
    }

    var validacionFiscal = await validarFiscalFacturaActiva(ruc, proveedor, timbrado, nroComprobante);
    if (validacionFiscal.bloqueado) {
      mostrarMensajeAdmin('gasto-msg', validacionFiscal.mensaje, true);
      return false;
    }
  }

  var btn = document.getElementById('btn-gasto');
  if (btn) {
    btn.textContent = 'Registrando...';
    btn.disabled = true;
  }
  try {
    var personaId = await buscarPersonaIdPorRuc(ruc);

    var payload = {
      descripcion: descripcion,
      categoria: categoria,
      monto: monto,
      proveedor_id: proveedorId,
      proveedor_beneficiario: proveedor || null,
      ruc: ruc || null,
      timbrado: timbrado || null,
      persona_id: personaId,
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
    if (selProv) selProv.value = '';
    document.getElementById('gasto-proveedor').value = '';
    if (rucEl) rucEl.value = '';
    if (timbradoEl) timbradoEl.value = '';
    if (nroComprobanteEl) nroComprobanteEl.value = '';
    if (tipoComprobanteEl) tipoComprobanteEl.value = 'Factura';
    if (medioPagoEl) medioPagoEl.value = 'efectivo';
    if (fechaEl) fechaEl.value = obtenerHoyISO();
    verificarVigenciaTimbradoGasto();

    await window.cargarDatosAdmin();
  } catch (e) {
    console.error('Error registrarGasto:', e);
    mostrarMensajeAdmin('gasto-msg', 'Error: ' + e.message, true);
    alert('Error al guardar: ' + e.message);
  } finally {
    if (btn) {
      btn.textContent = 'Registrar Gasto';
      btn.disabled = false;
    }
  }
  return false;
};

window.cargarGastosRecientes = async function () {
  inicializarFechaGastoDefault();
  configurarValidacionFacturaGasto();
  configurarSelectorProveedorGasto();
  cargarProveedoresParaGastos();

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
    if (g.timbrado) compInfo.push('Timb. ' + g.timbrado);
    if (g.ruc) compInfo.push('RUC ' + g.ruc);
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
  try {
    var res = await getSB()
      .from('gastos')
      .update({ estado: 'anulado', motivo_anulacion: motivo, anulado_en: new Date().toISOString() })
      .eq('id', id)
      .eq('estado', 'activo')
      .select();
    if (res.error) {
      mostrarMensajeAdmin('edit-gasto-msg', 'Error: ' + res.error.message, true);
      alert('Error: ' + res.error.message);
      return;
    }
    if (!res.data || res.data.length === 0) {
      var msgSinCambio = 'No se pudo anular el gasto (puede que ya esté anulado o pertenezca a un mes cerrado).';
      mostrarMensajeAdmin('edit-gasto-msg', msgSinCambio, true);
      alert(msgSinCambio);
      return;
    }
    window.cerrarModalEditarGasto();
    mostrarMensajeAdmin('gasto-msg', 'Gasto anulado. Queda en historia, no suma en balance.', false);
    await window.cargarDatosAdmin();
  } finally {
    if (btnAnular) { btnAnular.textContent = 'Anular Gasto'; btnAnular.disabled = false; }
  }
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
    configurarSelectorProveedorGasto();
    cargarProveedoresParaGastos();
  });
} else {
  inicializarFechaGastoDefault();
  configurarValidacionFacturaGasto();
  configurarSelectorProveedorGasto();
  cargarProveedoresParaGastos();
}