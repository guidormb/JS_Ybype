// admin-cobros.js
function calcularDiasVencidaFactura(mesStr) {
  if (!mesStr || !/^\d{4}-\d{2}$/.test(String(mesStr).trim())) {
    return { fechaVencimiento: null, diasVencida: 0, vencidaMas15Dias: false };
  }
  const [anioStr, mesNumStr] = String(mesStr).trim().split('-');
  const anio = Number(anioStr);
  const mesNum = Number(mesNumStr);

  // Criterio estándar: vence el día 1 del mes siguiente al período facturado
  const fechaVencimiento = new Date(anio, mesNum, 1);
  fechaVencimiento.setHours(0, 0, 0, 0);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const msPorDia = 1000 * 60 * 60 * 24;
  const diasVencida = Math.floor((hoy.getTime() - fechaVencimiento.getTime()) / msPorDia);

  return {
    fechaVencimiento,
    diasVencida,
    vencidaMas15Dias: diasVencida > 15
  };
}

// Helper: detecta si una cuenta está inactiva
// En Supabase la columna se llama ACTIVO, no estado. activo=false = inactivo
function esCuentaInactiva(cliente) {
  if (!cliente) return false;
  if (cliente.activo === false || cliente.activo === 0 || cliente.activo === "false") return true;
  const est = String(cliente.estado ?? '').toLowerCase().trim();
  return est === 'false' || est === '0' || est === 'inactivo' || est === 'inactiva' || est === 'suspendido' || est === 'suspendida' || est === 'baja' || est === 'dado de baja';
}

window.cargarFacturasSocioSeleccionado = async function () {
  const clienteId = document.getElementById('sel-cliente').value;
  const cont = document.getElementById('lista-facturas-cobro');
  const infoSaldo = document.getElementById('info-saldo-favor');
  cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-2">Cargando...</p>';
  infoSaldo.classList.add('hidden');

  if (!clienteId) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-2">-- Primero elegí Socio --</p>';
    return;
  }

  const socio = listaSociosCobro.find((s) => String(s.id) === String(clienteId));

  // BLOQUEO VISUAL CUENTA INACTIVA - usa columna ACTIVO
  const { data: cliEst2 } = await supabaseClient.from('clientes').select('activo, estado').eq('id', clienteId).single();
  if (cliEst2 && esCuentaInactiva(cliEst2)) {
    cont.innerHTML = '<p class="text-xs text-red-700 text-center py-2 font-bold bg-red-50 border border-red-300 rounded-xl">⛔ CUENTA INACTIVA - Suspendida / Dada de baja<br>No se puede cobrar ni generar anticipo.</p>';
    document.getElementById('inp-monto').value = '';
    document.getElementById('btn-pagar').disabled = true;
    return;
  }
  document.getElementById('btn-pagar').disabled = false;

  const saldoFavorSocio = Number(socio?.saldo_favor || 0);
  if (saldoFavorSocio > 0) {
    infoSaldo.textContent = 'Este socio tiene Saldo a Favor: Gs. ' + saldoFavorSocio.toLocaleString('es-PY');
    infoSaldo.classList.remove('hidden');
  }

  const r = await supabaseClient
    .from('facturas')
    .select('*')
    .eq('cliente_id', clienteId)
    .neq('estado', 'pagado')
    .order('mes', { ascending: true });

  const facturas = r.data || [];
  if (facturas.length === 0) {
    cont.innerHTML = '<p class="text-xs text-emerald-700 text-center py-2 font-bold">Sin facturas pendientes - Al día ✓ (Podés generar un anticipo)</p>';
    document.getElementById('inp-monto').value = '';
    return;
  }

  const facturaElegibleVencida = saldoFavorSocio > 0
    ? facturas.find((f) => Number(f.saldo_pendiente || 0) > 0 && calcularDiasVencidaFactura(f.mes).vencidaMas15Dias)
    : null;

  let alertaVencidaHtml = '';
  if (facturaElegibleVencida) {
    const infoVenc = calcularDiasVencidaFactura(facturaElegibleVencida.mes);
    const montoAplicable = Math.min(saldoFavorSocio, Number(facturaElegibleVencida.saldo_pendiente || 0));
    const fechaVencStr = infoVenc.fechaVencimiento
      ? infoVenc.fechaVencimiento.toLocaleDateString('es-PY')
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

  cont.innerHTML = alertaVencidaHtml + facturas.map((f) => {
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

window.aplicarSaldoFacturaVencida15Dias = async function (clienteId, facturaId) {
  if (!clienteId || !facturaId) return;

  try {
    const { data: cli, error: errCliLeer } = await supabaseClient
      .from('clientes')
      .select('id, saldo_favor, nro_cuenta, personas(nombre, apellido)')
      .eq('id', clienteId)
      .single();
    if (errCliLeer) throw errCliLeer;

    const { data: fac, error: errFacLeer } = await supabaseClient
      .from('facturas')
      .select('*')
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

    mostrarMensajeAdmin(
      'pago-msg',
      'Se aplicaron Gs. ' + montoAplicar.toLocaleString('es-PY') + ' de saldo a favor a la factura ' + fac.mes + ' (+15 días vencida).',
      false
    );

    await cargarDatosAdmin();
    await cargarFacturasSocioSeleccionado();
  } catch (e) {
    mostrarMensajeAdmin('pago-msg', 'Error al aplicar saldo a factura vencida: ' + e.message, true);
  }
};

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
  document.getElementById('inp-monto').value = total ? total.toLocaleString('es-PY') : '';
};

async function crearDocumentoAnticipo(clienteId, montoAnticipo, metodo, motivo) {
  if (!montoAnticipo || montoAnticipo <= 0) return;

  // BLOQUEO ANTICIPO CUENTA INACTIVA - usa columna ACTIVO
  const { data: cliAnt } = await supabaseClient.from('clientes').select('activo, estado').eq('id', clienteId).single();
  if (cliAnt && esCuentaInactiva(cliAnt)) {
    alert('⛔ Esta cuenta está INACTIVA. No se puede generar anticipo.');
    throw new Error('Cuenta inactiva - anticipo bloqueado');
  }

  const { error: errPago } = await supabaseClient.from('pagos').insert({
    cliente_id: clienteId,
    factura_id: null,
    monto_pagado: montoAnticipo,
    metodo,
    concepto: 'Anticipo - ' + (motivo || 'Saldo a favor del cliente')
  });
  if (errPago) throw errPago;

  const { data: clienteActual } = await supabaseClient.from('clientes').select('saldo_favor').eq('id', clienteId).single();
  const saldoActual = clienteActual ? Number(clienteActual.saldo_favor || 0) : 0;
  const { error: errCli } = await supabaseClient
    .from('clientes')
    .update({ saldo_favor: saldoActual + montoAnticipo })
    .eq('id', clienteId);
  if (errCli) throw errCli;
}

window.registrarPago = async function (event) {
  event.preventDefault();
  const clienteId = document.getElementById('sel-cliente').value;
  const montoTotal = limpiarGuaraniesInput(document.getElementById('inp-monto').value);
  const metodo = document.getElementById('sel-metodo').value;
  const checks = Array.from(document.querySelectorAll('.chk-factura:checked'));
  const quiereAnticipo = Boolean(document.getElementById('chk-generar-anticipo')?.checked);
  const montoAnticipoManual = limpiarGuaraniesInput(document.getElementById('inp-monto-anticipo')?.value);

  // BLOQUEO CUENTA INACTIVA - ANTES DE CUALQUIER RETURN - usa columna ACTIVO
  if (clienteId) {
    const { data: cliEstado } = await supabaseClient.from('clientes').select('activo, estado').eq('id', clienteId).single();
    if (cliEstado && esCuentaInactiva(cliEstado)) {
      mostrarMensajeAdmin('pago-msg', '⛔ Esta cuenta está INACTIVA (Suspendida / Dada de baja). No se puede cobrar ni generar anticipo.', true);
      return;
    }
  }

  if (!clienteId || !montoTotal || montoTotal <= 0) {
    mostrarMensajeAdmin('pago-msg', 'Elegí un socio y un monto válido.', true);
    return;
  }

  const btn = document.getElementById('btn-pagar');
  btn.textContent = 'Registrando...';
  btn.disabled = true;

  try {
    if (checks.length === 0) {
      const montoA = montoAnticipoManual > 0 ? montoAnticipoManual : montoTotal;
      await crearDocumentoAnticipo(clienteId, montoA, metodo, 'Anticipo directo');
      mostrarMensajeAdmin(
        'pago-msg',
        '¡Anticipo registrado! El monto de Gs. ' + montoA.toLocaleString('es-PY') + ' quedó como anticipo a favor del cliente.',
        false
      );
    } else {
      let totalFacturasMarcadas = 0;
      const facturasData = [];

      for (let i = 0; i < checks.length; i++) {
        const facturaId = checks[i].value;
        const { data: factura } = await supabaseClient.from('facturas').select('*').eq('id', facturaId).single();
        if (factura) {
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
          concepto: nuevoSaldo === 0
            ? 'Factura / deuda cancelada (' + factura.mes + ')'
            : 'Amortización factura ' + factura.mes + ' - Queda Gs. ' + nuevoSaldo.toLocaleString('es-PY')
        });
        if (errPago) throw errPago;

        await supabaseClient.from('facturas').update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado }).eq('id', factura.id);

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
      if (facturasCanceladas.length > 0) {
        partesMensaje.push('Factura / deuda cancelada: ' + facturasCanceladas.join(', ') + '.');
      }
      if (detalle.length > 0) {
        partesMensaje.push(detalle.join(' | ') + '.');
      }
      if (anticipoGenerado > 0) {
        partesMensaje.push('El monto de Gs. ' + anticipoGenerado.toLocaleString('es-PY') + ' quedó como anticipo a favor del cliente.');
      }

      mostrarMensajeAdmin('pago-msg', partesMensaje.join(' '), false);
    }

    document.getElementById('inp-monto').value = '';
    document.getElementById('filtro-socio-cobro').value = '';
    if (document.getElementById('chk-generar-anticipo')) {
      document.getElementById('chk-generar-anticipo').checked = false;
      toggleCampoAnticipo();
    }
    filtrarSociosCobro();
    await cargarDatosAdmin();
    await cargarFacturasSocioSeleccionado();
  } catch (e) {
    mostrarMensajeAdmin('pago-msg', 'Error: ' + e.message, true);
  }

  btn.textContent = 'Registrar Pago';
  btn.disabled = false;
};

async function cargarPagosRecientes() {
  const cont = document.getElementById('lista-pagos');
  const r = await supabaseClient
    .from('pagos')
    .select('*, clientes(nro_cuenta, saldo_favor, personas(nombre, apellido))')
    .order('created_at', { ascending: false })
    .limit(20);

  const pagos = r.data || [];
  pagosRecientesCache = pagos;

  if (pagos.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center">Sin pagos aún.</p>';
    return;
  }

  cont.innerHTML = pagos.map((p) => {
    const c = p.clientes || {};
    const per = c.personas || {};
    const fechaMostrar = p.created_at ? new Date(p.created_at).toLocaleDateString('es-PY') : '';
    const esAnticipo = !p.factura_id || String(p.concepto || '').toLowerCase().includes('anticipo');
    const etiquetaTipo = esAnticipo
      ? '<span class="ml-1 text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">ANTICIPO</span>'
      : '<span class="ml-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">COBRO</span>';

    return (
      '<div class="flex justify-between items-start gap-2 border-b pb-2">'
      + '<div class="flex-1">'
      + '<p class="text-xs font-bold">' + escapeHtml((per.nombre || '') + ' ' + (per.apellido || '')) + ' - Cta ' + escapeHtml(c.nro_cuenta || '') + etiquetaTipo + '</p>'
      + '<p class="text-[11px] text-slate-500">' + escapeHtml(fechaMostrar) + ' - ' + escapeHtml(p.metodo || '') + ' - ' + escapeHtml(p.concepto || '') + '</p>'
      + '</div>'
      + '<div class="flex flex-col items-end gap-1">'
      + '<span class="text-xs font-bold text-emerald-600">Gs. ' + Number(p.monto_pagado).toLocaleString('es-PY') + '</span>'
      + '<button type="button" data-id="' + escapeHtml(p.id) + '" class="btn-borrar-pago text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">Anular</button>'
      + '</div>'
      + '</div>'
    );
  }).join('');

  cont.querySelectorAll('.btn-borrar-pago').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pago = pagosRecientesCache.find((item) => String(item.id) === String(btn.dataset.id));
      if (!pago) return;
      eliminarCobranza(pago);
    });
  });
}

async function eliminarCobranza(pago) {
  const per = pago.clientes?.personas || {};
  const nombreSocio = ((per.nombre || '') + ' ' + (per.apellido || '')).trim() || 'Socio';
  const monto = Number(pago.monto_pagado || 0);
  const esAnticipo = !pago.factura_id || String(pago.concepto || '').toLowerCase().includes('anticipo');

  const ok = confirm(
    '¿Anular este ' + (esAnticipo ? 'anticipo' : 'cobro') + '?\n'
    + 'Socio: ' + nombreSocio + '\n'
    + 'Monto: Gs. ' + monto.toLocaleString('es-PY') + '\n'
    + 'Concepto: ' + (pago.concepto || '') + '\n\n'
    + 'Se revertirá el saldo de la factura o el anticipo si corresponde.'
  );
  if (!ok) return;

  try {
    const { error } = await supabaseClient.from('pagos').delete().eq('id', pago.id);
    if (error) throw error;

    if (pago.factura_id) {
      const { data: factura } = await supabaseClient
        .from('facturas')
        .select('id, monto, saldo_pendiente, estado')
        .eq('id', pago.factura_id)
        .single();

      if (factura) {
        const montoFactura = Number(factura.monto || 0);
        const saldoActual = Number(factura.saldo_pendiente || 0);
        const nuevoSaldo = Math.min(montoFactura, saldoActual + monto);
        await supabaseClient
          .from('facturas')
          .update({ saldo_pendiente: nuevoSaldo, estado: nuevoSaldo > 0 ? 'pendiente' : 'pagado' })
          .eq('id', factura.id);
      }
    } else if (esAnticipo && pago.cliente_id) {
      const { data: cliente } = await supabaseClient
        .from('clientes')
        .select('saldo_favor')
        .eq('id', pago.cliente_id)
        .single();
      if (cliente) {
        const nuevoSaldoFavor = Math.max(0, Number(cliente.saldo_favor || 0) - monto);
        await supabaseClient.from('clientes').update({ saldo_favor: nuevoSaldoFavor }).eq('id', pago.cliente_id);
      }
    }

    mostrarMensajeAdmin('pago-msg', (esAnticipo ? 'Anticipo anulado' : 'Cobranza anulada') + ' y saldos actualizados.', false);
    await cargarDatosAdmin();
    await cargarFacturasSocioSeleccionado();
  } catch (e) {
    alert('No se pudo anular: ' + e.message);
    mostrarMensajeAdmin('pago-msg', 'Error al anular: ' + e.message, true);
  }
}