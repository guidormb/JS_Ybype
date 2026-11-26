// admin-cobros.js - VERSIÓN FINAL PULIDA + ANULACIÓN LÓGICA EN PAGOS + CANDADO ANTICIPO + VALIDACIÓN ESTRICTA DE ERRORES
// Bloqueo total para cuentas INACTIVAS (clientes.activo = false)
// - No cobra, no genera anticipo, no aplica saldo a favor

// ============================================================
// HELPERS
// ============================================================

let filtroPagosActual = 'activo';
let registrandoPago = false;

function obtenerFechaHoyLocal() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).split('-');

  return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), 0, 0, 0, 0);
}

function calcularDiasVencidaFactura(mesStr) {
  if (!mesStr || !/^\d{4}-\d{2}$/.test(String(mesStr).trim())) {
    return { fechaVencimiento: null, diasVencida: 0, vencidaMas15Dias: false };
  }
  const [anioStr, mesNumStr] = String(mesStr).trim().split('-');
  const anio = Number(anioStr);
  const mesNum = Number(mesNumStr);

  // Vence el día 1 del mes siguiente al período facturado
  const fechaVencimiento = new Date(anio, mesNum, 1, 0, 0, 0, 0);
  const hoy = obtenerFechaHoyLocal();

  const msPorDia = 1000 * 60 * 60 * 24;
  const diasVencida = Math.floor((hoy.getTime() - fechaVencimiento.getTime()) / msPorDia);

  return {
    fechaVencimiento,
    diasVencida,
    vencidaMas15Dias: diasVencida > 15
  };
}

// Helper: detecta si una cuenta está inactiva
// En Supabase la columna es SOLO 'activo'. NO existe 'estado' en clientes.
// activo = false = inactivo. Si no lo encontramos o hay error, BLOQUEAMOS.
function esCuentaInactiva(cliente) {
  if (!cliente) return true;
  return cliente.activo === false || cliente.activo === 0 || cliente.activo === "false" || cliente.activo === "0";
}

// Verificación fresca contra Supabase, siempre antes de cobrar / anticipar
async function verificarClienteActivo(clienteId) {
  if (!clienteId) return false;
  try {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('activo')
      .eq('id', clienteId)
      .single();
    if (error || !data) {
      console.warn('Error verificando activo:', error?.message);
      return false;
    }
    return !esCuentaInactiva(data);
  } catch (e) {
    console.warn('Error verificarClienteActivo:', e?.message || e);
    return false;
  }
}

function bloquearUIClienteInactivo() {
  const cont = document.getElementById('lista-facturas-cobro');
  if (cont) cont.innerHTML = '<p class="text-xs text-red-700 text-center py-2 font-bold bg-red-50 border border-red-300 rounded-xl">⛔ CUENTA INACTIVA - Suspendida / Dada de baja<br>No se puede cobrar ni generar anticipo.</p>';
  const inpMonto = document.getElementById('inp-monto');
  if (inpMonto) inpMonto.value = '';
  const btnPagar = document.getElementById('btn-pagar');
  if (btnPagar) btnPagar.disabled = true;
  const chkAnt = document.getElementById('chk-generar-anticipo');
  if (chkAnt) { chkAnt.checked = false; chkAnt.disabled = true; }
  const inpAnt = document.getElementById('inp-monto-anticipo');
  if (inpAnt) { inpAnt.value = ''; inpAnt.disabled = true; }
}

function desbloquearUIClienteActivo() {
  const btnPagar = document.getElementById('btn-pagar');
  if (btnPagar) btnPagar.disabled = false;
  const chkAnt = document.getElementById('chk-generar-anticipo');
  if (chkAnt) chkAnt.disabled = false;
  const inpAnt = document.getElementById('inp-monto-anticipo');
  if (inpAnt) inpAnt.disabled = false;
}

// ============================================================
// CARGAR FACTURAS DEL SOCIO SELECCIONADO
// ============================================================

window.cargarFacturasSocioSeleccionado = async function () {
  const clienteId = document.getElementById('sel-cliente')?.value;
  const cont = document.getElementById('lista-facturas-cobro');
  const infoSaldo = document.getElementById('info-saldo-favor');
  if (!cont) return;
  cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-2">Cargando...</p>';
  infoSaldo?.classList.add('hidden');

  if (!clienteId) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-2">-- Primero elegí Socio --</p>';
    return;
  }

  // BLOQUEO CUENTA INACTIVA - ANTES DE MOSTRAR NADA
  const estaActivo = await verificarClienteActivo(clienteId);
  if (!estaActivo) {
    bloquearUIClienteInactivo();
    return;
  }
  desbloquearUIClienteActivo();

  const { data: cliFresh } = await supabaseClient
    .from('clientes')
    .select('saldo_favor')
    .eq('id', clienteId)
    .single();

  const socioFallback = (typeof listaSociosCobro !== 'undefined' ? listaSociosCobro : []).find((s) => String(s.id) === String(clienteId));
  const saldoFavorSocio = Number(cliFresh?.saldo_favor ?? socioFallback?.saldo_favor ?? 0);

  if (saldoFavorSocio > 0 && infoSaldo) {
    infoSaldo.textContent = 'Este socio tiene Saldo a Favor: Gs. ' + saldoFavorSocio.toLocaleString('es-PY');
    infoSaldo.classList.remove('hidden');
  }

  const { data: facturas, error } = await supabaseClient
    .from('facturas')
    .select('id, cliente_id, mes, monto, saldo_pendiente, estado')
    .eq('cliente_id', clienteId)
    .neq('estado', 'pagado')
    .order('mes', { ascending: true });

  if (error) {
    console.warn('Error facturas:', error);
    cont.innerHTML = '<p class="text-xs text-red-600 text-center py-2">Error Supabase: ' + escapeHtml(error.message) + '</p>';
    return;
  }

  const lista = facturas || [];
  if (lista.length === 0) {
    cont.innerHTML = '<p class="text-xs text-emerald-700 text-center py-2 font-bold">Sin facturas pendientes - Al día ✓ (Podés generar un anticipo)</p>';
    const inp = document.getElementById('inp-monto');
    if (inp) inp.value = '';
    return;
  }

  const facturaElegibleVencida = saldoFavorSocio > 0
    ? lista.find((f) => Number(f.saldo_pendiente || 0) > 0 && calcularDiasVencidaFactura(f.mes).vencidaMas15Dias)
    : null;

  let alertaVencidaHtml = '';
  if (facturaElegibleVencida) {
    const infoVenc = calcularDiasVencidaFactura(facturaElegibleVencida.mes);
    const montoAplicable = Math.min(saldoFavorSocio, Number(facturaElegibleVencida.saldo_pendiente || 0));
    const fechaVencStr = infoVenc.fechaVencimiento
      ? infoVenc.fechaVencimiento.toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' })
      : '-';

    alertaVencidaHtml =
      '<div class="bg-amber-50 border border-amber-300 rounded-xl p-2.5 mb-2">'
      + '<p class="text-[11px] font-extrabold text-amber-900">⚠️ Factura vencida hace ' + escapeHtml(infoVenc.diasVencida) + ' días (vto. ' + escapeHtml(fechaVencStr) + ')</p>'
      + '<p class="text-[11px] text-amber-800 mt-0.5">Mes ' + escapeHtml(facturaElegibleVencida.mes) + ' · Saldo a favor disponible: Gs. ' + saldoFavorSocio.toLocaleString('es-PY') + '</p>'
      + '<button type="button" onclick="aplicarSaldoFacturaVencida15Dias(\'' + escapeHtml(clienteId) + '\', \'' + escapeHtml(facturaElegibleVencida.id) + '\')" class="mt-2 w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3 rounded-lg">'
      + 'Aplicar saldo a factura vencida (+15 días): Gs. ' + montoAplicable.toLocaleString('es-PY')
      + '</button>'
      + '</div>';
  }

  cont.innerHTML = alertaVencidaHtml + lista.map((f) => {
    const infoVenc = calcularDiasVencidaFactura(f.mes);
    const badgeVenc = infoVenc.vencidaMas15Dias
      ? '<span class="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-full">+15D VENCIDA</span>'
      : '<span class="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-full">PENDIENTE</span>';

    return (
      '<label class="flex items-center gap-2 bg-white border rounded-xl p-2.5 cursor-pointer">'
      + '<input type="checkbox" class="chk-factura w-4 h-4 accent-emerald-600" value="' + escapeHtml(f.id) + '" data-saldo="' + escapeHtml(f.saldo_pendiente) + '" data-mes="' + escapeHtml(f.mes) + '" checked>'
      + '<div class="flex-1"><p class="text-xs font-bold">Mes ' + escapeHtml(f.mes) + '</p><p class="text-[11px] text-slate-500">Pendiente: Gs. ' + Number(f.saldo_pendiente).toLocaleString('es-PY') + '</p></div>'
      + badgeVenc
      + '</label>'
    );
  }).join('')
    + '<p class="text-[11px] text-center text-slate-500 pt-1">Total seleccionado: <b id="total-seleccionado">Gs. 0</b> <button type="button" onclick="usarTotalSeleccionado()" class="text-blue-600 font-bold underline ml-1">Usar total</button></p>';

  cont.querySelectorAll('.chk-factura').forEach((chk) => {
    chk.addEventListener('change', actualizarTotalSeleccionado);
  });
  actualizarTotalSeleccionado();
};

// ============================================================
// APLICAR SALDO A FACTURA VENCIDA +15 DÍAS
// ============================================================

window.aplicarSaldoFacturaVencida15Dias = async function (clienteId, facturaId) {
  if (!clienteId || !facturaId) return;

  try {
    if (!(await verificarClienteActivo(clienteId))) {
      mostrarMensajeAdmin('pago-msg', '⛔ Esta cuenta está INACTIVA. No se puede aplicar saldo a favor.', true);
      bloquearUIClienteInactivo();
      return;
    }

    const { data: cli, error: errCliLeer } = await supabaseClient
      .from('clientes')
      .select('id, saldo_favor, nro_cuenta, personas(nombre, apellido)')
      .eq('id', clienteId)
      .single();
    if (errCliLeer) throw errCliLeer;

    const { data: fac, error: errFacLeer } = await supabaseClient
      .from('facturas')
      .select('id, cliente_id, mes, monto, saldo_pendiente, estado')
      .eq('id', facturaId)
      .single();
    if (errFacLeer) throw errFacLeer;

    const saldoFavorActual = Number(cli?.saldo_favor || 0);
    const saldoFacturaActual = Number(fac?.saldo_pendiente || 0);
    const infoVenc = calcularDiasVencidaFactura(fac?.mes);

    if (!fac || fac.estado === 'pagado' || saldoFacturaActual <= 0) {
      mostrarMensajeAdmin('pago-msg', 'La factura seleccionada ya no tiene saldo pendiente.', true);
      await cargarFacturasSocioSeleccionado();
      return;
    }
    if (!infoVenc.vencidaMas15Dias) {
      mostrarMensajeAdmin('pago-msg', 'Esta factura aún no supera los 15 días de vencimiento bajo el criterio estándar.', true);
      return;
    }
    if (saldoFavorActual <= 0) {
      mostrarMensajeAdmin('pago-msg', 'El socio no cuenta con saldo a favor disponible.', true);
      return;
    }

    const montoAplicar = Math.min(saldoFavorActual, saldoFacturaActual);
    const nuevoSaldoFactura = saldoFacturaActual - montoAplicar;
    const nuevoEstadoFactura = nuevoSaldoFactura === 0 ? 'pagado' : 'pendiente';
    const nuevoSaldoFavor = saldoFavorActual - montoAplicar;
    const per = cli?.personas || {};
    const nombreSocio = ((per.nombre || '') + ' ' + (per.apellido || '')).trim() || ('Cta ' + (cli?.nro_cuenta || ''));

    const confirmar = confirm(
      '⚠️ Aplicar saldo a favor por factura vencida (+15 días)\n\n'
      + 'Socio: ' + nombreSocio + '\n'
      + 'Factura: ' + fac.mes + ' (' + infoVenc.diasVencida + ' días vencida)\n'
      + 'Monto a aplicar: Gs. ' + montoAplicar.toLocaleString('es-PY') + '\n'
      + 'Saldo a favor restante: Gs. ' + nuevoSaldoFavor.toLocaleString('es-PY') + '\n'
      + 'Saldo pendiente restante en factura: Gs. ' + nuevoSaldoFactura.toLocaleString('es-PY') + '\n\n'
      + '¿Confirmás esta aplicación?'
    );
    if (!confirmar) return;

    const { error: errPago } = await supabaseClient.from('pagos').insert({
      cliente_id: clienteId,
      factura_id: fac.id,
      monto_pagado: montoAplicar,
      metodo: 'saldo_a_favor',
      estado: 'activo',
      concepto: nuevoSaldoFactura === 0
        ? 'Aplicación de saldo a favor por factura vencida (+15 días) - Factura ' + fac.mes
        : 'Amortización con saldo a favor por factura vencida (+15 días) - Factura ' + fac.mes + ' (queda Gs. ' + nuevoSaldoFactura.toLocaleString('es-PY') + ')'
    });
    if (errPago) throw errPago;

    const { error: errFacUpd } = await supabaseClient
      .from('facturas')
      .update({ saldo_pendiente: nuevoSaldoFactura, estado: nuevoEstadoFactura })
      .eq('id', fac.id);
    if (errFacUpd) throw errFacUpd;

    const { error: errCliUpd } = await supabaseClient
      .from('clientes')
      .update({ saldo_favor: nuevoSaldoFavor })
      .eq('id', clienteId);
    if (errCliUpd) throw errCliUpd;

    mostrarMensajeAdmin('pago-msg', 'Se aplicaron Gs. ' + montoAplicar.toLocaleString('es-PY') + ' de saldo a favor a la factura ' + fac.mes + ' (+15 días vencida).', false);
    if (typeof cargarDatosAdmin === 'function') await cargarDatosAdmin();
    await cargarFacturasSocioSeleccionado();
  } catch (e) {
    mostrarMensajeAdmin('pago-msg', 'Error al aplicar saldo a factura vencida: ' + (e?.message || e), true);
  }
};

// ============================================================
// TOTAL SELECCIONADO
// ============================================================

window.actualizarTotalSeleccionado = function () {
  let total = 0;
  document.querySelectorAll('.chk-factura:checked').forEach((c) => {
    total += Number(c.dataset.saldo || 0);
  });
  const el = document.getElementById('total-seleccionado');
  if (el) el.textContent = 'Gs. ' + total.toLocaleString('es-PY');
};

window.usarTotalSeleccionado = function () {
  let total = 0;
  document.querySelectorAll('.chk-factura:checked').forEach((c) => {
    total += Number(c.dataset.saldo || 0);
  });
  const inp = document.getElementById('inp-monto');
  if (inp) inp.value = total ? total.toLocaleString('es-PY') : '';
};

// ============================================================
// ANTICIPO - BLOQUEADO PARA INACTIVOS
// ============================================================

async function crearDocumentoAnticipo(clienteId, montoAnticipo, metodo, motivo) {
  if (!montoAnticipo || montoAnticipo <= 0) return;

  if (!(await verificarClienteActivo(clienteId))) {
    alert('⛔ Esta cuenta está INACTIVA. No se puede generar anticipo.');
    throw new Error('Cuenta inactiva - anticipo bloqueado');
  }

  const { error: errPago } = await supabaseClient.from('pagos').insert({
    cliente_id: clienteId,
    factura_id: null,
    monto_pagado: montoAnticipo,
    metodo,
    estado: 'activo',
    concepto: 'Anticipo - ' + (motivo || 'Saldo a favor del cliente')
  });
  if (errPago) throw errPago;

  const { data: clienteActual, error: errCliLeer } = await supabaseClient
    .from('clientes')
    .select('saldo_favor')
    .eq('id', clienteId)
    .single();
  if (errCliLeer) throw errCliLeer;

  const saldoActual = Number(clienteActual?.saldo_favor || 0);
  const { error: errCliUpd } = await supabaseClient
    .from('clientes')
    .update({ saldo_favor: saldoActual + montoAnticipo })
    .eq('id', clienteId);
  if (errCliUpd) throw errCliUpd;
}

// ============================================================
// REGISTRAR PAGO
// ============================================================

window.registrarPago = async function (event) {
  event.preventDefault();
  if (registrandoPago) return;

  const clienteId = document.getElementById('sel-cliente')?.value;
  const montoTotal = limpiarGuaraniesInput(document.getElementById('inp-monto')?.value);
  const metodo = document.getElementById('sel-metodo')?.value;
  const checks = Array.from(document.querySelectorAll('.chk-factura:checked'));
  const quiereAnticipo = Boolean(document.getElementById('chk-generar-anticipo')?.checked);
  const montoAnticipoManual = limpiarGuaraniesInput(document.getElementById('inp-monto-anticipo')?.value);

  if (clienteId) {
    if (!(await verificarClienteActivo(clienteId))) {
      mostrarMensajeAdmin('pago-msg', '⛔ Esta cuenta está INACTIVA (Suspendida / Dada de baja). No se puede cobrar ni generar anticipo.', true);
      bloquearUIClienteInactivo();
      return;
    }
  }

  if (!clienteId || !montoTotal || montoTotal <= 0) {
    mostrarMensajeAdmin('pago-msg', 'Elegí un socio y un monto válido.', true);
    return;
  }

  const btn = document.getElementById('btn-pagar');
  const textoOriginalBtn = btn ? btn.textContent : 'Registrar Pago';
  registrandoPago = true;
  if (btn) {
    btn.textContent = 'Registrando...';
    btn.disabled = true;
  }

  try {
    if (checks.length === 0) {
      const montoA = montoAnticipoManual > 0 ? montoAnticipoManual : montoTotal;
      await crearDocumentoAnticipo(clienteId, montoA, metodo, 'Anticipo directo');
      mostrarMensajeAdmin('pago-msg', '¡Anticipo registrado! El monto de Gs. ' + montoA.toLocaleString('es-PY') + ' quedó como anticipo a favor del cliente.', false);
    } else {
      let totalFacturasMarcadas = 0;
      const facturasData = [];

      for (let i = 0; i < checks.length; i++) {
        const facturaId = checks[i].value;
        const { data: factura, error: errFacLeer } = await supabaseClient
          .from('facturas')
          .select('id, cliente_id, mes, monto, saldo_pendiente, estado')
          .eq('id', facturaId)
          .single();
        if (errFacLeer) throw errFacLeer;

        if (factura && factura.estado !== 'pagado' && Number(factura.saldo_pendiente || 0) > 0) {
          facturasData.push(factura);
          totalFacturasMarcadas += Number(factura.saldo_pendiente || 0);
        }
      }

      let montoParaFacturas = montoTotal;
      let anticipoGenerado = 0;

      if (quiereAnticipo && montoAnticipoManual > 0) {
        anticipoGenerado = montoAnticipoManual;
        montoParaFacturas = Math.max(0, montoTotal - anticipoGenerado);
      } else if (montoTotal > totalFacturasMarcadas) {
        anticipoGenerado = montoTotal - totalFacturasMarcadas;
        montoParaFacturas = totalFacturasMarcadas;
      }

      let montoRestante = montoParaFacturas;
      const detalle = [];
      const facturasCanceladas = [];

      for (let i = 0; i < facturasData.length; i++) {
        if (montoRestante <= 0) break;
        const factura = facturasData[i];
        const saldoFactura = Number(factura.saldo_pendiente);
        const aPagar = Math.min(montoRestante, saldoFactura);
        const nuevoSaldo = saldoFactura - aPagar;
        const nuevoEstado = nuevoSaldo === 0 ? 'pagado' : 'pendiente';

        const { error: errPago } = await supabaseClient.from('pagos').insert({
          cliente_id: clienteId,
          factura_id: factura.id,
          monto_pagado: aPagar,
          metodo,
          estado: 'activo',
          concepto: nuevoSaldo === 0
            ? 'Factura / deuda cancelada (' + factura.mes + ')'
            : 'Amortización factura ' + factura.mes + ' - Queda Gs. ' + nuevoSaldo.toLocaleString('es-PY')
        });
        if (errPago) throw errPago;

        const { error: errFacUpd } = await supabaseClient
          .from('facturas')
          .update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado })
          .eq('id', factura.id);
        if (errFacUpd) throw errFacUpd;

        if (nuevoSaldo === 0) {
          facturasCanceladas.push(factura.mes);
          detalle.push(factura.mes + ': Gs. ' + aPagar.toLocaleString('es-PY') + ' (factura / deuda cancelada)');
        } else {
          detalle.push(factura.mes + ': Gs. ' + aPagar.toLocaleString('es-PY') + ' (queda Gs. ' + nuevoSaldo.toLocaleString('es-PY') + ')');
        }
        montoRestante -= aPagar;
      }

      if (anticipoGenerado > 0) {
        await crearDocumentoAnticipo(clienteId, anticipoGenerado, metodo, 'Excedente / anticipo');
      }

      const partesMensaje = ['¡Pago registrado!'];
      if (facturasCanceladas.length > 0) partesMensaje.push('Factura / deuda cancelada: ' + facturasCanceladas.join(', ') + '.');
      if (detalle.length > 0) partesMensaje.push(detalle.join(' | ') + '.');
      if (anticipoGenerado > 0) partesMensaje.push('El monto de Gs. ' + anticipoGenerado.toLocaleString('es-PY') + ' quedó como anticipo a favor del cliente.');
      mostrarMensajeAdmin('pago-msg', partesMensaje.join(' '), false);
    }

    const inpMonto = document.getElementById('inp-monto');
    if (inpMonto) inpMonto.value = '';
    const filtro = document.getElementById('filtro-socio-cobro');
    if (filtro) filtro.value = '';
    const chkAnt = document.getElementById('chk-generar-anticipo');
    if (chkAnt) {
      chkAnt.checked = false;
      if (typeof toggleCampoAnticipo === 'function') toggleCampoAnticipo();
    }
    if (typeof filtrarSociosCobro === 'function') filtrarSociosCobro();
    if (typeof cargarDatosAdmin === 'function') await cargarDatosAdmin();
    await cargarFacturasSocioSeleccionado();
  } catch (e) {
    mostrarMensajeAdmin('pago-msg', 'Error: ' + (e?.message || e), true);
  } finally {
    registrandoPago = false;
    if (btn) {
      btn.textContent = textoOriginalBtn;
      btn.disabled = false;
    }
  }
};

// ============================================================
// PAGOS RECIENTES + ANULAR (BORRADO LÓGICO CON HISTORIAL)
// IGUAL QUE GASTOS: FILTRO ACTIVOS / ANULADOS
// ============================================================

window.cambiarFiltroPagos = async function (nuevoFiltro) {
  filtroPagosActual = nuevoFiltro;

  const btnActivos = document.getElementById('btn-pagos-activos');
  const btnAnulados = document.getElementById('btn-pagos-anulados');
  if (btnActivos && btnAnulados) {
    if (nuevoFiltro === 'activo') {
      btnActivos.className = 'px-2 py-1 rounded-full text-[11px] font-bold bg-white text-emerald-600 shadow-sm';
      btnAnulados.className = 'px-2 py-1 rounded-full text-[11px] font-bold text-slate-500';
    } else {
      btnActivos.className = 'px-2 py-1 rounded-full text-[11px] font-bold text-slate-500';
      btnAnulados.className = 'px-2 py-1 rounded-full text-[11px] font-bold bg-white text-red-600 shadow-sm';
    }
  }
  await cargarPagosRecientes();
};

async function cargarPagosRecientes() {
  const cont = document.getElementById('lista-pagos');
  if (!cont) return;
  cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-2">Cargando...</p>';
  const { data: pagos, error } = await supabaseClient
    .from('pagos')
    .select('id, cliente_id, factura_id, monto_pagado, metodo, concepto, estado, motivo_anulacion, anulado_en, created_at, clientes(nro_cuenta, saldo_favor, personas(nombre, apellido, cedula_ruc))')
    .eq('estado', filtroPagosActual)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('Error pagos recientes:', error);
    cont.innerHTML = '<p class="text-xs text-red-600 text-center">Error: ' + escapeHtml(error.message) + '</p>';
    return;
  }

  const lista = pagos || [];
  if (typeof pagosRecientesCache !== 'undefined') pagosRecientesCache = lista;
  else window.pagosRecientesCache = lista;

  if (lista.length === 0) {
    if (filtroPagosActual === 'anulado') {
      cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Sin pagos anulados.</p>';
    } else {
      cont.innerHTML = '<p class="text-xs text-slate-500 text-center">Sin pagos aún.</p>';
    }
    return;
  }

  cont.innerHTML = lista.map((p) => {
    const c = p.clientes || {};
    const per = c.personas || {};
    const fechaMostrar = p.created_at
      ? new Date(p.created_at).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' })
      : '';
    const metodoLower = String(p.metodo || '').toLowerCase();
    const conceptoLower = String(p.concepto || '').toLowerCase();
    const esUsoSaldoFavor = metodoLower === 'saldo_a_favor' || conceptoLower.includes('saldo a favor');
    const esAnticipo = !p.factura_id || (!esUsoSaldoFavor && conceptoLower.includes('anticipo'));
    const estaAnulado = p.estado === 'anulado';

    const etiquetaTipo = esAnticipo
      ? '<span class="ml-1 text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">ANTICIPO</span>'
      : '<span class="ml-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">COBRO</span>';

    return (
      '<div class="flex justify-between items-start gap-2 border-b pb-2 ' + (estaAnulado ? 'opacity-70 bg-red-50 rounded-lg p-2' : '') + '">'
      + '<div class="flex-1">'
      + '<p class="text-xs font-bold">' + escapeHtml((per.nombre || '') + ' ' + (per.apellido || '')) + ' - Cta ' + escapeHtml(c.nro_cuenta || '') + etiquetaTipo + '</p>'
      + '<p class="text-[11px] text-slate-500">' + escapeHtml(fechaMostrar) + ' - ' + escapeHtml(p.metodo || '') + ' - ' + escapeHtml(p.concepto || '') + '</p>'
      + (estaAnulado ? '<p class="text-[11px] font-bold text-red-600 mt-1">⛔ ANULADO: ' + escapeHtml(p.motivo_anulacion || 'sin motivo') + '</p>' : '')
      + '</div>'
      + '<div class="flex flex-col items-end gap-1">'
      + '<span class="text-xs font-bold ' + (estaAnulado ? 'text-slate-500 line-through' : 'text-emerald-600') + '">Gs. ' + Number(p.monto_pagado).toLocaleString('es-PY') + '</span>'
      + (estaAnulado ? '' : '<button type="button" data-id="' + escapeHtml(p.id) + '" class="btn-borrar-pago text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">Anular</button>')
      + '</div>'
      + '</div>'
    );
  }).join('');

  cont.querySelectorAll('.btn-borrar-pago').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cache = (typeof pagosRecientesCache !== 'undefined' ? pagosRecientesCache : window.pagosRecientesCache) || [];
      const pago = cache.find((item) => String(item.id) === String(btn.dataset.id));
      if (!pago) return;
      eliminarCobranza(pago);
    });
  });
}

async function eliminarCobranza(pago) {
  if (!pago || pago.estado === 'anulado') {
    alert('Este movimiento ya se encuentra anulado.');
    return;
  }

  const per = pago.clientes?.personas || {};
  const nombreSocio = ((per.nombre || '') + ' ' + (per.apellido || '')).trim() || 'Socio';
  const monto = Number(pago.monto_pagado || 0);
  const metodo = String(pago.metodo || '').toLowerCase();
  const conceptoLower = String(pago.concepto || '').toLowerCase();
  const esUsoSaldoFavor = metodo === 'saldo_a_favor' || conceptoLower.includes('saldo a favor');
  const esAnticipo = !pago.factura_id || (!esUsoSaldoFavor && conceptoLower.includes('anticipo'));

  try {
    if (esAnticipo && pago.cliente_id) {
      const { data: consumos, error: errConsumos } = await supabaseClient
        .from('pagos')
        .select('id, monto_pagado, concepto, created_at, facturas(mes, saldo_pendiente)')
        .eq('cliente_id', pago.cliente_id)
        .eq('metodo', 'saldo_a_favor')
        .eq('estado', 'activo')
        .order('created_at', { ascending: true });
      if (errConsumos) throw errConsumos;

      if (consumos && consumos.length > 0) {
        const detalle = consumos.map((c) => {
          const mes = c.facturas?.mes || 'sin mes';
          const fecha = c.created_at
            ? new Date(c.created_at).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' })
            : '';
          return '• Factura ' + mes + ' - Gs. ' + Number(c.monto_pagado || 0).toLocaleString('es-PY') + ' (' + fecha + ')';
        }).join('\n');

        const msgBloqueo =
          '⛔ NO SE PUEDE ANULAR ESTE ANTICIPO\n\n'
          + 'Socio: ' + nombreSocio + '\n'
          + 'Anticipo: Gs. ' + monto.toLocaleString('es-PY') + '\n\n'
          + 'Este anticipo se usó para amortizar:\n' + detalle + '\n\n'
          + 'ATENCIÓN: Anulá PRIMERO la cobranza con saldo a favor de esa factura.\n'
          + 'Después volvé acá y anulá el anticipo.\n\n'
          + 'No se anuló nada.';

        alert(msgBloqueo);
        mostrarMensajeAdmin('pago-msg', msgBloqueo, true);
        return;
      }
    }

    const ok = confirm(
      '¿Anular este ' + (esAnticipo ? 'anticipo' : 'cobro') + '?\n'
      + 'Socio: ' + nombreSocio + '\n'
      + 'Monto: Gs. ' + monto.toLocaleString('es-PY') + '\n'
      + 'Concepto: ' + (pago.concepto || '') + '\n\n'
      + 'Quedará guardado como ANULADO en el historial y se revertirán los saldos.'
    );
    if (!ok) return;

    const motivoIngresado = prompt('Motivo de anulación (obligatorio):', '');
    if (motivoIngresado === null) return;
    const motivo = motivoIngresado.trim();
    if (!motivo) {
      alert('Tenés que escribir un motivo para anular.');
      return;
    }

    const { data: updPago, error: errUpdPago } = await supabaseClient
      .from('pagos')
      .update({
        estado: 'anulado',
        motivo_anulacion: motivo,
        anulado_en: new Date().toISOString()
      })
      .eq('id', pago.id)
      .eq('estado', 'activo')
      .select();
    if (errUpdPago) throw errUpdPago;
    if (!updPago || updPago.length === 0) {
      throw new Error('No se pudo anular el movimiento (puede que ya esté anulado o en un mes cerrado).');
    }

    if (pago.factura_id) {
      const { data: factura, error: errFacRevLeer } = await supabaseClient
        .from('facturas')
        .select('id, monto, saldo_pendiente, estado')
        .eq('id', pago.factura_id)
        .single();
      if (errFacRevLeer) throw errFacRevLeer;

      if (factura) {
        const montoOriginal = Number(factura.monto || 0);
        const saldoActual = Number(factura.saldo_pendiente || 0);
        const nuevoSaldo = montoOriginal > 0
          ? Math.min(montoOriginal, saldoActual + monto)
          : saldoActual + monto;

        const { error: errFacRevUpd } = await supabaseClient
          .from('facturas')
          .update({
            saldo_pendiente: nuevoSaldo,
            estado: nuevoSaldo > 0 ? 'pendiente' : 'pagado'
          })
          .eq('id', factura.id);
        if (errFacRevUpd) throw errFacRevUpd;
      }

      if (esUsoSaldoFavor && pago.cliente_id) {
        const { data: cliente, error: errCliSaldoLeer } = await supabaseClient
          .from('clientes')
          .select('saldo_favor')
          .eq('id', pago.cliente_id)
          .single();
        if (errCliSaldoLeer) throw errCliSaldoLeer;

        if (cliente) {
          const nuevoSaldoFavor = Number(cliente.saldo_favor || 0) + monto;
          const { error: errCliSaldoUpd } = await supabaseClient
            .from('clientes')
            .update({ saldo_favor: nuevoSaldoFavor })
            .eq('id', pago.cliente_id);
          if (errCliSaldoUpd) throw errCliSaldoUpd;
        }
      }
    } else if (esAnticipo && pago.cliente_id) {
      const { data: cliente, error: errCliAntLeer } = await supabaseClient
        .from('clientes')
        .select('saldo_favor')
        .eq('id', pago.cliente_id)
        .single();
      if (errCliAntLeer) throw errCliAntLeer;

      if (cliente) {
        const nuevoSaldoFavor = Math.max(0, Number(cliente.saldo_favor || 0) - monto);
        const { error: errCliAntUpd } = await supabaseClient
          .from('clientes')
          .update({ saldo_favor: nuevoSaldoFavor })
          .eq('id', pago.cliente_id);
        if (errCliAntUpd) throw errCliAntUpd;
      }
    }

    mostrarMensajeAdmin('pago-msg', (esAnticipo ? 'Anticipo anulado' : 'Cobranza anulada') + ' y saldos actualizados.', false);
    if (typeof cargarDatosAdmin === 'function') await cargarDatosAdmin();
    await cargarFacturasSocioSeleccionado();
    await cargarPagosRecientes();

    if (esUsoSaldoFavor && pago.cliente_id) {
      const { data: cliDespues } = await supabaseClient
        .from('clientes')
        .select('saldo_favor')
        .eq('id', pago.cliente_id)
        .single();
      if (Number(cliDespues?.saldo_favor || 0) > 0) {
        alert('Listo. El saldo volvió a Gs. ' + Number(cliDespues.saldo_favor).toLocaleString('es-PY') + '.\n\nAhora anulá el ANTICIPO original de ' + nombreSocio + ' para dejar todo en 0.');
      }
    }
  } catch (e) {
    alert('No se pudo anular: ' + (e?.message || e));
    mostrarMensajeAdmin('pago-msg', 'Error al anular: ' + (e?.message || e), true);
  }
}

// ============================================================
// MODAL LISTA DE ANTICIPOS / SALDO A FAVOR
// ============================================================

async function abrirListaAnticipos() {
  const modal = document.getElementById('modal-anticipos');
  const cont = document.getElementById('modal-anticipos-lista');
  const totalEl = document.getElementById('modal-anticipos-total');
  if (!modal || !cont) return;

  modal.classList.remove('hidden');
  cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Cargando...</p>';

  try {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('id, nro_cuenta, saldo_favor, activo, personas(nombre, apellido, cedula_ruc)')
      .gt('saldo_favor', 0)
      .order('saldo_favor', { ascending: false });

    if (error) throw error;

    const lista = data || [];
    const total = lista.reduce((a, c) => a + Number(c.saldo_favor || 0), 0);
    if (totalEl) totalEl.textContent = 'Total: Gs. ' + total.toLocaleString('es-PY') + ' · ' + lista.length + ' socio(s)';

    if (lista.length === 0) {
      cont.innerHTML = '<p class="text-xs text-emerald-700 font-bold text-center py-6 bg-emerald-50 rounded-xl">✅ Nadie tiene saldo a favor.<br>Todo en 0.</p>';
      return;
    }

    cont.innerHTML = lista.map((c) => {
      const per = c.personas || {};
      const nombre = ((per.nombre || '') + ' ' + (per.apellido || '')).trim() || ('Cta ' + (c.nro_cuenta || ''));
      const cedula = per.cedula_ruc ? String(per.cedula_ruc) : '-';
      const inactivo = c.activo === false;
      return (
        '<div class="flex justify-between items-center gap-2 border rounded-xl p-3 ' + (inactivo ? 'bg-red-50 border-red-200' : 'bg-white') + '">' +
        '<div class="flex-1">' +
        '<p class="text-xs font-bold">' + escapeHtml(nombre) + '</p>' +
        '<p class="text-[11px] text-slate-500">Cta ' + escapeHtml(c.nro_cuenta || '') + ' · CI ' + escapeHtml(cedula) + (inactivo ? ' · ⛔ INACTIVA' : '') + '</p>' +
        '</div>' +
        '<p class="text-xs font-extrabold text-sky-700 whitespace-nowrap">Gs. ' + Number(c.saldo_favor || 0).toLocaleString('es-PY') + '</p>' +
        '</div>'
      );
    }).join('');
  } catch (e) {
    cont.innerHTML = '<p class="text-xs text-red-600 text-center py-4">Error: ' + escapeHtml(e?.message || e) + '</p>';
  }
}

function cerrarListaAnticipos() {
  document.getElementById('modal-anticipos')?.classList.add('hidden');
}

window.abrirListaAnticipos = abrirListaAnticipos;
window.cerrarListaAnticipos = cerrarListaAnticipos;

// ============================================================
// NRO. CUENTA AUTOMÁTICO - 001, 002, 003...
// ============================================================

async function generarSiguienteNroCuenta() {
  try {
    const { data } = await supabaseClient
      .from('clientes')
      .select('nro_cuenta')
      .order('nro_cuenta', { ascending: false })
      .limit(1);

    let ultimo = 0;
    if (data && data.length > 0) {
      ultimo = parseInt(String(data[0].nro_cuenta).replace(/\D/g, ''), 10) || 0;
    }
    const siguiente = String(ultimo + 1).padStart(3, '0');
    const inp = document.getElementById('ns-cuenta');
    if (inp) inp.value = siguiente;
    return siguiente;
  } catch (e) {
    return '001';
  }
}

// ============================================================
// ENGANCHE AUTOMÁTICO - Sin tocar el guardado viejo
// ============================================================

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const texto = (btn.textContent || '').toLowerCase();
  if (texto.includes('nuevo socio') || texto.includes('+ socio') || btn.id === 'btn-nuevo-socio') {
    setTimeout(() => generarSiguienteNroCuenta(), 100);
  }
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#btn-ns-guardar');
  if (!btn) return;
  const inp = document.getElementById('ns-cuenta');
  if (inp && !inp.value) {
    await generarSiguienteNroCuenta();
  }
});

setTimeout(() => generarSiguienteNroCuenta(), 500);