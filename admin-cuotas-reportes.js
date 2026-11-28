// admin-cuotas-reportes.js - Reportes + Balance + Cuotas
const OFFSET_ZONA_HORARIA = '-03:00';
let generandoCuotasMasivas = false;

function fechaHoyPYFormateada() {
  return new Date().toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' });
}

window.generarReporteCobranzas = async function() {
  const msgEl = document.getElementById('reporte-msg');
  const areaEl = document.getElementById('area-impresion-reporte');
  const btnImprimir = document.getElementById('btn-imprimir-reporte');
  const btnConsultar = document.getElementById('btn-generar-reporte');

  msgEl?.classList.add('hidden');
  areaEl?.classList.add('hidden');
  btnImprimir?.classList.add('hidden');

  let fechaInicioISO = '';
  let fechaFinISO = '';
  let tituloPeriodo = '';

  if (modoReporteActual === 'mes') {
    const valorMes = document.getElementById('rep-mes-input')?.value || '';
    if (!valorMes) {
      mostrarMensajeAdmin('reporte-msg', 'Seleccioná un mes y año para el reporte.', true);
      return;
    }
    const [anioStr, mesStr] = valorMes.split('-');
    const anio = Number(anioStr);
    const mes = Number(mesStr);
    const ultimoDia = new Date(anio, mes, 0).getDate();
    fechaInicioISO = `${anioStr}-${mesStr}-01T00:00:00.000${OFFSET_ZONA_HORARIA}`;
    fechaFinISO = `${anioStr}-${mesStr}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999${OFFSET_ZONA_HORARIA}`;
    const nombresMes = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    tituloPeriodo = `Cobranzas Mensuales - ${nombresMes[mes]} ${anio}`;
  } else {
    const desde = document.getElementById('rep-fecha-desde')?.value || '';
    const hasta = document.getElementById('rep-fecha-hasta')?.value || '';
    if (!desde || !hasta) {
      mostrarMensajeAdmin('reporte-msg', 'Completá la fecha Desde y Hasta.', true);
      return;
    }
    if (desde > hasta) {
      mostrarMensajeAdmin('reporte-msg', 'La fecha Desde no puede ser mayor que Hasta.', true);
      return;
    }
    fechaInicioISO = `${desde}T00:00:00.000${OFFSET_ZONA_HORARIA}`;
    fechaFinISO = `${hasta}T23:59:59.999${OFFSET_ZONA_HORARIA}`;
    tituloPeriodo = `Cobros del ${desde.split('-').reverse().join('/')} al ${hasta.split('-').reverse().join('/')}`;
  }

  const textoOriginalBtn = btnConsultar ? btnConsultar.textContent : 'Consultar Cobros';
  if (btnConsultar) {
    btnConsultar.textContent = 'Consultando...';
    btnConsultar.disabled = true;
  }

  try {
    const { data, error } = await supabaseClient
      .from('pagos')
      .select('id, created_at, monto_pagado, metodo, concepto, factura_id, estado, clientes(nro_cuenta, personas(nombre, apellido, cedula_ruc))')
      .neq('estado', 'anulado')
      .gte('created_at', fechaInicioISO)
      .lte('created_at', fechaFinISO)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const lista = data || [];
    let totalFacturas = 0;
    let totalAnticipos = 0;

    lista.forEach((p) => {
      const monto = Number(p.monto_pagado || 0);
      const conceptoLower = String(p.concepto || '').toLowerCase();
      const metodoLower = String(p.metodo || '').toLowerCase();
      const esUsoSaldoFavor = metodoLower === 'saldo_a_favor' || conceptoLower.includes('saldo a favor');
      const esAnticipo = !p.factura_id || conceptoLower.includes('anticipo');

      if (!esUsoSaldoFavor) {
        if (esAnticipo) totalAnticipos += monto;
        else totalFacturas += monto;
      }
    });

    const totalGeneral = totalFacturas + totalAnticipos;

    const elPeriodo = document.getElementById('rep-titulo-periodo');
    const elEmision = document.getElementById('rep-fecha-emision');
    const elFacturas = document.getElementById('rep-total-facturas');
    const elAnticipos = document.getElementById('rep-total-anticipos');
    const elGeneral = document.getElementById('rep-total-general');

    if (elPeriodo) elPeriodo.textContent = tituloPeriodo;
    if (elEmision) elEmision.textContent = 'Emitido: ' + fechaHoyPYFormateada() + ' | Movimientos: ' + lista.length;
    if (elFacturas) elFacturas.textContent = 'Gs. ' + totalFacturas.toLocaleString('es-PY');
    if (elAnticipos) elAnticipos.textContent = 'Gs. ' + totalAnticipos.toLocaleString('es-PY');
    if (elGeneral) elGeneral.textContent = 'Gs. ' + totalGeneral.toLocaleString('es-PY');

    const tablaCont = document.getElementById('rep-tabla-contenedor');
    if (tablaCont) {
      if (lista.length === 0) {
        tablaCont.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No se encontraron cobranzas en este período.</p>';
      } else {
        const filasHtml = lista.map((p) => {
          const c = p.clientes || {};
          const per = c.personas || {};
          const fecha = p.created_at ? new Date(p.created_at).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' }) : '-';
          const conceptoLower = String(p.concepto || '').toLowerCase();
          const metodoLower = String(p.metodo || '').toLowerCase();
          const esUsoSaldoFavor = metodoLower === 'saldo_a_favor' || conceptoLower.includes('saldo a favor');
          const esAnticipo = !p.factura_id || conceptoLower.includes('anticipo');
          const tipo = esUsoSaldoFavor ? 'Débito Saldo' : (esAnticipo ? 'Anticipo' : 'Factura');

          return '<tr class="border-b border-slate-200">' +
            '<td class="py-2 pr-2 whitespace-nowrap">' + escapeHtml(fecha) + '</td>' +
            '<td class="py-2 pr-2 font-bold">' + escapeHtml(c.nro_cuenta || '-') + '</td>' +
            '<td class="py-2 pr-2">' + escapeHtml(((per.nombre || '') + ' ' + (per.apellido || '')).trim()) + '</td>' +
            '<td class="py-2 pr-2">' + escapeHtml(tipo) + ' (' + escapeHtml(p.metodo || '-') + ')</td>' +
            '<td class="py-2 text-right font-bold whitespace-nowrap">Gs. ' + Number(p.monto_pagado || 0).toLocaleString('es-PY') + '</td>' +
            '</tr>';
        }).join('');

        tablaCont.innerHTML = '<table class="w-full text-[11px] text-left border-collapse">' +
          '<thead><tr class="border-b-2 border-slate-300 text-slate-600 uppercase"><th class="py-2 pr-2">Fecha</th><th class="py-2 pr-2">Cta</th><th class="py-2 pr-2">Socio</th><th class="py-2 pr-2">Detalle</th><th class="py-2 text-right">Monto</th></tr></thead>' +
          '<tbody>' + filasHtml + '</tbody>' +
          '<tfoot><tr class="border-t-2 border-slate-400 font-extrabold text-slate-900"><td colspan="4" class="py-2 text-right pr-2">TOTAL EFECTIVO INGRESADO:</td><td class="py-2 text-right whitespace-nowrap">Gs. ' + totalGeneral.toLocaleString('es-PY') + '</td></tr></tfoot></table>';
      }
    }

    areaEl?.classList.remove('hidden');
    if (lista.length > 0) btnImprimir?.classList.remove('hidden');
  } catch (e) {
    mostrarMensajeAdmin('reporte-msg', 'Error al generar reporte: ' + (e?.message || e), true);
  } finally {
    if (btnConsultar) {
      btnConsultar.textContent = textoOriginalBtn;
      btnConsultar.disabled = false;
    }
  }
};

window.cargarTotalPorCobrar = async function() {
  const { data, error } = await supabaseClient
    .from('facturas')
    .select('saldo_pendiente, cliente_id')
    .eq('estado', 'pendiente')
    .gt('saldo_pendiente', 0);

  if (error) {
    console.warn('Error por cobrar:', error.message);
    return;
  }

  const lista = data || [];
  const total = lista.reduce((a, f) => a + Number(f.saldo_pendiente || 0), 0);
  const sociosUnicos = new Set(lista.map((f) => f.cliente_id)).size;

  const elTotal = document.getElementById('total-por-cobrar');
  if (elTotal) elTotal.textContent = 'Gs. ' + total.toLocaleString('es-PY');

  const elSocios = document.getElementById('socios-con-deuda');
  if (elSocios) elSocios.textContent = sociosUnicos + ' socios con deuda';
};

window.irAPadron = function() {
  if (typeof abrirPadron === 'function') abrirPadron();
};

async function cargarBalance() {
  try {
    const [rp, rg, rc, rd] = await Promise.all([
      supabaseClient
        .from('pagos')
        .select('monto_pagado, factura_id, concepto, metodo, estado')
        .neq('estado', 'anulado'),
      supabaseClient
        .from('gastos')
        .select('monto, estado')
        .eq('estado', 'activo'),
      supabaseClient
        .from('clientes')
        .select('saldo_favor'),
      supabaseClient
        .from('donaciones')
        .select('monto, estado')
        .eq('estado', 'activo')
    ]);

    const pagos = (rp.data || []).filter((p) => p.estado !== 'anulado');

    const totalCobradoFacturas = pagos
      .filter((p) => {
        const conceptoLower = String(p.concepto || '').toLowerCase();
        const esAnticipo = !p.factura_id || conceptoLower.includes('anticipo');
        return !esAnticipo;
      })
      .reduce((a, p) => a + Number(p.monto_pagado || 0), 0);

    const totalCobradoEfectivo = pagos
      .filter((p) => {
        const metodoLower = String(p.metodo || '').toLowerCase();
        const conceptoLower = String(p.concepto || '').toLowerCase();
        const esUsoSaldoFavor = metodoLower === 'saldo_a_favor' || conceptoLower.includes('saldo a favor');
        return !esUsoSaldoFavor;
      })
      .reduce((a, p) => a + Number(p.monto_pagado || 0), 0);

    const totalGastado = (rg.data || []).reduce((a, g) => a + Number(g.monto || 0), 0);
    const totalAnticiposClientes = (rc.data || []).reduce((a, c) => a + Number(c.saldo_favor || 0), 0);
    const totalDonaciones = (rd.data || []).reduce((a, d) => a + Number(d.monto || 0), 0);

    const totalGeneralSaldos = totalCobradoEfectivo + totalDonaciones - totalGastado;
    const balanceCaja = totalGeneralSaldos - totalAnticiposClientes;

    const setTexto = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Gs. ' + Number(valor || 0).toLocaleString('es-PY');
    };

    setTexto('total-cobrado', totalCobradoFacturas);
    setTexto('total-gastado', totalGastado);
    setTexto('total-anticipos', totalAnticiposClientes);
    setTexto('total-donaciones', totalDonaciones);
    setTexto('balance-total', balanceCaja);
    setTexto('total-general-saldos', totalGeneralSaldos);
    await cargarTotalPorCobrar();

    const leyendaEl = document.getElementById('leyenda-balance');
    if (leyendaEl) {
      leyendaEl.classList.remove(
        'hidden', 'bg-amber-100', 'text-amber-900',
        'bg-red-100', 'text-red-800',
        'bg-emerald-100', 'text-emerald-900',
        'border', 'border-amber-300', 'border-red-300', 'border-emerald-300'
      );
      if (balanceCaja < 0 && totalAnticiposClientes > 0) {
        leyendaEl.textContent =
          '⚠️ Caja sin plata propia. En caja hay Gs. ' + totalGeneralSaldos.toLocaleString('es-PY') +
          ', pero se deben Gs. ' + totalAnticiposClientes.toLocaleString('es-PY') +
          ' de anticipos de socios. Faltan Gs. ' + Math.abs(balanceCaja).toLocaleString('es-PY') + ' para cubrirlos.';
        leyendaEl.classList.add('bg-amber-100', 'text-amber-900', 'border', 'border-amber-300');
      } else if (balanceCaja < 0) {
        leyendaEl.textContent =
          '⛔ Balance en negativo: Gs. ' + balanceCaja.toLocaleString('es-PY') +
          '. La Junta debe más de lo que tiene.';
        leyendaEl.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-300');
      } else if (totalAnticiposClientes > 0) {
        leyendaEl.textContent =
          'ℹ️ De los fondos en caja, Gs. ' + totalAnticiposClientes.toLocaleString('es-PY') +
          ' son anticipos de socios (plata a descontar, no ganancia). Lo propio de la Junta es Gs. ' +
          balanceCaja.toLocaleString('es-PY') + '.';
        leyendaEl.classList.add('bg-amber-100', 'text-amber-900', 'border', 'border-amber-300');
      } else {
        leyendaEl.textContent = '✅ Todo el saldo en caja es propio de la Junta. No hay anticipos pendientes.';
        leyendaEl.classList.add('bg-emerald-100', 'text-emerald-900', 'border', 'border-emerald-300');
      }
    }
  } catch (e) {
    console.error('Error cargarBalance:', e);
  }
}

window.generarCuotasMasivas = async function(event) {
  event.preventDefault();
  if (generandoCuotasMasivas) return;

  const mes = String(document.getElementById('inp-mes-cuota')?.value || '').trim();
  const monto = limpiarGuaraniesInput(document.getElementById('inp-monto-cuota')?.value);

  if (!/^\d{4}-\d{2}$/.test(mes) || !monto || monto <= 0) {
    mostrarMensajeAdmin('cuotas-msg', 'Elegí mes (AAAA-MM) y monto válido.', true);
    return;
  }

  const btn = document.getElementById('btn-generar-cuotas');
  const textoOriginal = btn ? btn.textContent : 'Generar Cuotas a Todos';
  generandoCuotasMasivas = true;
  if (btn) {
    btn.textContent = 'Generando...';
    btn.disabled = true;
  }

  try {
    const { data: clientes, error: errClientes } = await supabaseClient
      .from('clientes')
      .select('id')
      .eq('activo', true);
    if (errClientes) throw errClientes;
    if (!clientes || clientes.length === 0) throw new Error('No hay socios activos.');

    const { data: existentes, error: errExistentes } = await supabaseClient
      .from('facturas')
      .select('cliente_id')
      .eq('mes', mes);
    if (errExistentes) throw errExistentes;

    const yaTienen = new Set((existentes || []).map((f) => f.cliente_id));

    const nuevas = clientes
      .filter((c) => !yaTienen.has(c.id))
      .map((c) => ({
        cliente_id: c.id,
        mes,
        monto,
        saldo_pendiente: monto,
        estado: 'pendiente'
      }));

    if (nuevas.length === 0) {
      throw new Error('Ya se generaron cuotas para ' + mes + ' en todos los socios activos.');
    }

    const { data: insertadas, error: errInsert } = await supabaseClient
      .from('facturas')
      .insert(nuevas)
      .select('id');
    if (errInsert) throw errInsert;

    if (typeof cargarDatosAdmin === 'function') await cargarDatosAdmin();
    mostrarMensajeAdmin(
      'cuotas-msg',
      'Cuotas generadas: ' + (insertadas ? insertadas.length : nuevas.length) + ' socios. Ya tenían: ' + yaTienen.size,
      false
    );
  } catch (e) {
    mostrarMensajeAdmin('cuotas-msg', 'Error: ' + (e?.message || e), true);
  } finally {
    generandoCuotasMasivas = false;
    if (btn) {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }
  }
};

// --- FACTURA INDIVIDUAL - VERSIÓN LIMPIA Y FINAL ---
let sociosFacturaIndCache = [];

window.cargarSociosFacturaInd = async function() {
  const sel = document.getElementById('sel-cliente-factura-ind');
  if (!sel) return;
  try {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('id, nro_cuenta, personas(nombre, apellido, cedula_ruc)')
      .eq('activo', true)
      .order('nro_cuenta');
    if (error) throw error;
    sociosFacturaIndCache = data || [];
    sel.innerHTML = '<option value="">-- Seleccioná Socio --</option>' + sociosFacturaIndCache.map(c => {
      const p = c.personas || {};
      const nombre = ((p.nombre || '') + ' ' + (p.apellido || '')).trim() || 'Sin nombre';
      return `<option value="${c.id}">${escapeHtml(c.nro_cuenta || '')} - ${escapeHtml(nombre)} - ${escapeHtml(p.cedula_ruc || '')}</option>`;
    }).join('');
  } catch(e) {
    console.error('Error cargar socios factura ind:', e);
  }
};

window.filtrarSociosFacturaInd = function() {
  const filtro = (document.getElementById('filtro-socio-factura-ind')?.value || '').toLowerCase().trim();
  const sel = document.getElementById('sel-cliente-factura-ind');
  if (!sel) return;
  const lista = !filtro ? sociosFacturaIndCache : sociosFacturaIndCache.filter(c => {
    const p = c.personas || {};
    const texto = `${c.nro_cuenta || ''} ${p.nombre || ''} ${p.apellido || ''} ${p.cedula_ruc || ''}`.toLowerCase();
    return texto.includes(filtro);
  });
  sel.innerHTML = '<option value="">-- Seleccioná Socio --</option>' + lista.map(c => {
    const p = c.personas || {};
    const nombre = ((p.nombre || '') + ' ' + (p.apellido || '')).trim() || 'Sin nombre';
    return `<option value="${c.id}">${escapeHtml(c.nro_cuenta || '')} - ${escapeHtml(nombre)} - ${escapeHtml(p.cedula_ruc || '')}</option>`;
  }).join('');
};

window.toggleConceptoOtroInd = function() {
  const sel = document.getElementById('sel-concepto-factura-ind');
  const wrap = document.getElementById('wrap-concepto-otro-ind');
  if (!sel || !wrap) return;
  if (sel.value === 'Otros') {
    wrap.classList.remove('hidden');
    document.getElementById('inp-concepto-otro-ind')?.focus();
  } else {
    wrap.classList.add('hidden');
  }
};

window.generarFacturaIndividual = async function(event) {
  event.preventDefault();
  const cliente_id = document.getElementById('sel-cliente-factura-ind')?.value || '';
  const mes = String(document.getElementById('inp-mes-factura-ind')?.value || '').trim();
  const conceptoSel = document.getElementById('sel-concepto-factura-ind')?.value || 'Cuota mensual';
  let concepto = conceptoSel;

  // Si eligió Otros, usa lo que escribió en el campo vacío
  if (conceptoSel === 'Otros') {
    concepto = String(document.getElementById('inp-concepto-otro-ind')?.value || '').trim();
    if (!concepto) return mostrarMensajeAdmin('factura-ind-msg', 'Escribí el concepto para "Otros".', true);
  }

  const monto = limpiarGuaraniesInput(document.getElementById('inp-monto-factura-ind')?.value);

  if (!cliente_id) return mostrarMensajeAdmin('factura-ind-msg', 'Seleccioná un socio.', true);
  if (!/^\d{4}-\d{2}$/.test(mes)) return mostrarMensajeAdmin('factura-ind-msg', 'Elegí mes (AAAA-MM).', true);
  if (!monto || monto <= 0) return mostrarMensajeAdmin('factura-ind-msg', 'Monto inválido.', true);

  const btn = document.getElementById('btn-factura-ind');
  const textoOriginal = btn ? btn.textContent : 'Emitir Factura';
  if (btn) { btn.textContent = 'Emitiendo...'; btn.disabled = true; }

  try {
    // Solo la Cuota mensual no se puede duplicar. Los demás conceptos sí se pueden repetir.
    if (concepto === 'Cuota mensual') {
      const { data: existe, error: errExiste } = await supabaseClient
        .from('facturas')
        .select('id')
        .eq('cliente_id', cliente_id)
        .eq('mes', mes)
        .eq('concepto', 'Cuota mensual')
        .limit(1);
      if (errExiste) throw errExiste;
      if (existe && existe.length > 0) throw new Error('Este socio ya tiene Cuota mensual para ' + mes + '.');
    }

    const { error: errInsert } = await supabaseClient
      .from('facturas')
      .insert([{ cliente_id, mes, monto, saldo_pendiente: monto, estado: 'pendiente', concepto }]);
    if (errInsert) throw errInsert;

    if (typeof cargarDatosAdmin === 'function') await cargarDatosAdmin();
    mostrarMensajeAdmin('factura-ind-msg', concepto + ' de Gs. ' + monto.toLocaleString('es-PY') + ' emitida para ' + mes + '.', false);
    
    // --- LIMPIAR TODO DESPUÉS DE GUARDAR ---
    const filtroSocio = document.getElementById('filtro-socio-factura-ind');
    if (filtroSocio) filtroSocio.value = '';
    
    const selSocio = document.getElementById('sel-cliente-factura-ind');
    if (selSocio) selSocio.value = '';
    
    const selConcepto = document.getElementById('sel-concepto-factura-ind');
    if (selConcepto) selConcepto.value = 'Cuota mensual';
    
    const inpOtro = document.getElementById('inp-concepto-otro-ind');
    if (inpOtro) inpOtro.value = '';
    if (typeof toggleConceptoOtroInd === 'function') toggleConceptoOtroInd();
    
    const inpMes = document.getElementById('inp-mes-factura-ind');
    if (inpMes) inpMes.value = '';
    
    const inpMonto = document.getElementById('inp-monto-factura-ind');
    if (inpMonto) inpMonto.value = '25.000';
    
    // Si había un filtro en la lista de facturas emitidas, también lo limpia para que muestre las últimas 6
    const filtroLista = document.getElementById('filtro-facturas-emitidas-ind');
    if (filtroLista) filtroLista.value = '';
    
    // Deja el cursor listo para buscar el próximo socio
    if (filtroSocio) filtroSocio.focus();
  } catch(e) {
    mostrarMensajeAdmin('factura-ind-msg', 'Error: ' + (e?.message || e), true);
  } finally {
    if (btn) { btn.textContent = textoOriginal; btn.disabled = false; }
  }
};
// --- LISTA FACTURAS EMITIDAS - ÚLTIMAS 6 + BUSCADOR ---
let facturasEmitidasIndCache = [];

window.cargarFacturasEmitidasInd = async function() {
  const cont = document.getElementById('lista-facturas-emitidas-ind');
  if (!cont) return;
  try {
    const { data, error } = await supabaseClient
      .from('facturas')
      .select('id, created_at, mes, monto, saldo_pendiente, estado, concepto, clientes(nro_cuenta, personas(nombre, apellido, cedula_ruc))')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    facturasEmitidasIndCache = data || [];
    renderFacturasEmitidasInd(facturasEmitidasIndCache.slice(0, 6));
  } catch (e) {
    cont.innerHTML = '<p class="text-xs text-red-500 text-center py-2">Error al cargar facturas: ' + (e?.message || e) + '</p>';
  }
};

function renderFacturasEmitidasInd(lista) {
  const cont = document.getElementById('lista-facturas-emitidas-ind');
  if (!cont) return;
  if (!lista || lista.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-2">No hay facturas emitidas.</p>';
    return;
  }
  cont.innerHTML = lista.map(f => {
    const c = f.clientes || {};
    const p = c.personas || {};
    const nombre = ((p.nombre || '') + ' ' + (p.apellido || '')).trim() || 'Sin nombre';
    const concepto = f.concepto || 'Cuota mensual';
    const fecha = f.created_at ? new Date(f.created_at).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' }) : '-';
    const esPagado = f.estado === 'pagado' || Number(f.saldo_pendiente || 0) <= 0;
    const badge = esPagado ?
      '<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">PAGADO</span>' :
      '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">PENDIENTE Gs. ' + Number(f.saldo_pendiente || 0).toLocaleString('es-PY') + '</span>';
    return `<div class="border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex justify-between gap-2 items-start">
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(c.nro_cuenta || '-')} - ${escapeHtml(nombre)}</p>
        <p class="text-[11px] text-slate-500">CI: ${escapeHtml(p.cedula_ruc || '-')} | ${escapeHtml(concepto)} | Mes: ${escapeHtml(f.mes || '-')} | ${fecha}</p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-xs font-extrabold text-slate-900 whitespace-nowrap">Gs. ${Number(f.monto || 0).toLocaleString('es-PY')}</p>
        <div class="mt-1">${badge}</div>
      </div>
    </div>`;
  }).join('');
}

window.filtrarFacturasEmitidasInd = function() {
  const filtro = (document.getElementById('filtro-facturas-emitidas-ind')?.value || '').toLowerCase().trim();
  if (!filtro) {
    renderFacturasEmitidasInd(facturasEmitidasIndCache.slice(0, 6));
    return;
  }
  const lista = facturasEmitidasIndCache.filter(f => {
    const c = f.clientes || {};
    const p = c.personas || {};
    const texto = `${c.nro_cuenta || ''} ${p.nombre || ''} ${p.apellido || ''} ${p.cedula_ruc || ''} ${f.concepto || ''} ${f.mes || ''}`.toLowerCase();
    return texto.includes(filtro);
  });
  renderFacturasEmitidasInd(lista.slice(0, 20));
};