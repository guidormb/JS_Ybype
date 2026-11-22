// admin-cuotas-reportes.js - Reportes + Balance + Cuotas
window.generarReporteCobranzas = async function() {
  const msgEl = document.getElementById('reporte-msg');
  const areaEl = document.getElementById('area-impresion-reporte');
  const btnImprimir = document.getElementById('btn-imprimir-reporte');
  const btnConsultar = document.getElementById('btn-generar-reporte');
  msgEl.classList.add('hidden');
  areaEl.classList.add('hidden');
  btnImprimir.classList.add('hidden');
  
  let fechaInicioISO = '';
  let fechaFinISO = '';
  let tituloPeriodo = '';
  
  if (modoReporteActual === 'mes') {
    const valorMes = document.getElementById('rep-mes-input').value;
    if (!valorMes) {
      mostrarMensajeAdmin('reporte-msg', 'Seleccioná un mes y año para el reporte.', true);
      return;
    }
    const [anioStr, mesStr] = valorMes.split('-');
    const anio = Number(anioStr);
    const mes = Number(mesStr);
    const ultimoDia = new Date(anio, mes, 0).getDate();
    fechaInicioISO = `${anioStr}-${mesStr}-01T00:00:00.000Z`;
    fechaFinISO = `${anioStr}-${mesStr}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999Z`;
    const nombresMes = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    tituloPeriodo = `Cobranzas Mensuales - ${nombresMes[mes]} ${anio}`;
  } else {
    const desde = document.getElementById('rep-fecha-desde').value;
    const hasta = document.getElementById('rep-fecha-hasta').value;
    if (!desde || !hasta) {
      mostrarMensajeAdmin('reporte-msg', 'Completá la fecha Desde y Hasta.', true);
      return;
    }
    if (desde > hasta) {
      mostrarMensajeAdmin('reporte-msg', 'La fecha Desde no puede ser mayor que Hasta.', true);
      return;
    }
    fechaInicioISO = `${desde}T00:00:00.000Z`;
    fechaFinISO = `${hasta}T23:59:59.999Z`;
    tituloPeriodo = `Cobros del ${desde.split('-').reverse().join('/')} al ${hasta.split('-').reverse().join('/')}`;
  }
  
  btnConsultar.textContent = 'Consultando...';
  btnConsultar.disabled = true;
  
  try {
    const { data, error } = await supabaseClient
      .from('pagos')
      .select('id, created_at, monto_pagado, metodo, concepto, factura_id, clientes(nro_cuenta, personas(nombre, apellido, cedula_ruc))')
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
      
      // No sumamos movimientos internos de saldo_a_favor al efectivo cobrado para no duplicar ingresos
      if (!esUsoSaldoFavor) {
        if (esAnticipo) totalAnticipos += monto;
        else totalFacturas += monto;
      }
    });
    
    const totalGeneral = totalFacturas + totalAnticipos;
    
    document.getElementById('rep-titulo-periodo').textContent = tituloPeriodo;
    document.getElementById('rep-fecha-emision').textContent = 'Emitido: ' + new Date().toLocaleDateString('es-PY') + ' | Movimientos: ' + lista.length;
    document.getElementById('rep-total-facturas').textContent = 'Gs. ' + totalFacturas.toLocaleString('es-PY');
    document.getElementById('rep-total-anticipos').textContent = 'Gs. ' + totalAnticipos.toLocaleString('es-PY');
    document.getElementById('rep-total-general').textContent = 'Gs. ' + totalGeneral.toLocaleString('es-PY');
    
    const tablaCont = document.getElementById('rep-tabla-contenedor');
    if (lista.length === 0) {
      tablaCont.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No se encontraron cobranzas en este período.</p>';
    } else {
      const filasHtml = lista.map((p) => {
        const c = p.clientes || {};
        const per = c.personas || {};
        const fecha = p.created_at ? new Date(p.created_at).toLocaleDateString('es-PY') : '-';
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
    
    areaEl.classList.remove('hidden');
    if (lista.length > 0) btnImprimir.classList.remove('hidden');
  } catch (e) {
    mostrarMensajeAdmin('reporte-msg', 'Error al generar reporte: ' + e.message, true);
  } finally {
    btnConsultar.textContent = 'Consultar Cobros';
    btnConsultar.disabled = false;
  }
};

async function cargarBalance() {
  const [rp, rg, rc] = await Promise.all([
    supabaseClient.from('pagos').select('monto_pagado, factura_id, concepto, metodo'),
    supabaseClient.from('gastos').select('monto'),
    supabaseClient.from('clientes').select('saldo_favor')
  ]);
  
  const pagos = rp.data || [];
  
  // TOTAL COBRADO (FACTURAS) = toda factura pagada, en efectivo/transferencia O con saldo a favor
  // Solo para mostrar en la tarjetita "TOTAL COBRADO (FACTURAS)"
  const totalCobradoFacturas = pagos.filter((p) => {
    const conceptoLower = String(p.concepto || '').toLowerCase();
    const esAnticipo = !p.factura_id || conceptoLower.includes('anticipo');
    return !esAnticipo;
  }).reduce((a, p) => a + Number(p.monto_pagado || 0), 0);
  
  // TOTAL EN EFECTIVO QUE REALMENTE ENTRÓ = facturas en efectivo + anticipos
  // NO contamos el saldo_a_favor porque esa plata ya entró cuando se cobró el anticipo. Si lo contamos 2 veces, se duplica.
  const totalCobradoEfectivo = pagos.filter((p) => {
    const metodoLower = String(p.metodo || '').toLowerCase();
    const conceptoLower = String(p.concepto || '').toLowerCase();
    const esUsoSaldoFavor = metodoLower === 'saldo_a_favor' || conceptoLower.includes('saldo a favor');
    return !esUsoSaldoFavor;
  }).reduce((a, p) => a + Number(p.monto_pagado || 0), 0);
  
  const totalGastado = (rg.data || []).reduce((a, g) => a + Number(g.monto || 0), 0);
  const totalAnticiposClientes = (rc.data || []).reduce((a, c) => a + Number(c.saldo_favor || 0), 0);
  
  // CAJA REAL = efectivo que entró - gastos. MISMA CUENTA QUE EL CIERRE.
  const totalGeneralSaldos = totalCobradoEfectivo - totalGastado;
  // PROPIO DE LA JUNTA = caja real - lo que se debe de anticipos. MISMO QUE "SALDO PROPIO" DEL CIERRE.
  const balanceCaja = totalGeneralSaldos - totalAnticiposClientes;
  
  document.getElementById('total-cobrado').textContent = 'Gs. ' + totalCobradoFacturas.toLocaleString('es-PY');
  document.getElementById('total-gastado').textContent = 'Gs. ' + totalGastado.toLocaleString('es-PY');
  document.getElementById('total-anticipos').textContent = 'Gs. ' + totalAnticiposClientes.toLocaleString('es-PY');
  document.getElementById('balance-total').textContent = 'Gs. ' + balanceCaja.toLocaleString('es-PY');
  document.getElementById('total-general-saldos').textContent = 'Gs. ' + totalGeneralSaldos.toLocaleString('es-PY');
  
  // LEYENDA DEL BALANCE
  const leyendaEl = document.getElementById('leyenda-balance');
  if (leyendaEl) {
    leyendaEl.classList.remove('hidden', 'bg-amber-100', 'text-amber-900', 'bg-red-100', 'text-red-800', 'bg-emerald-100', 'text-emerald-900', 'border', 'border-amber-300', 'border-red-300', 'border-emerald-300');
    if (balanceCaja < 0 && totalAnticiposClientes > 0) {
      leyendaEl.textContent = '⚠️ Caja sin plata propia. En caja hay Gs. ' + totalGeneralSaldos.toLocaleString('es-PY') + ', pero se deben Gs. ' + totalAnticiposClientes.toLocaleString('es-PY') + ' de anticipos de socios. Faltan Gs. ' + Math.abs(balanceCaja).toLocaleString('es-PY') + ' para cubrirlos.';
      leyendaEl.classList.add('bg-amber-100', 'text-amber-900', 'border', 'border-amber-300');
    } else if (balanceCaja < 0) {
      leyendaEl.textContent = '⛔ Balance en negativo: Gs. ' + balanceCaja.toLocaleString('es-PY') + '. La Junta debe más de lo que tiene.';
      leyendaEl.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-300');
    } else if (totalAnticiposClientes > 0) {
      leyendaEl.textContent = 'ℹ️ De los fondos en caja, Gs. ' + totalAnticiposClientes.toLocaleString('es-PY') + ' son anticipos de socios (plata a descontar, no ganancia). Lo propio de la Junta es Gs. ' + balanceCaja.toLocaleString('es-PY') + '.';
      leyendaEl.classList.add('bg-amber-100', 'text-amber-900', 'border', 'border-amber-300');
    } else {
      leyendaEl.textContent = '✅ Todo el saldo en caja es propio de la Junta. No hay anticipos pendientes.';
      leyendaEl.classList.add('bg-emerald-100', 'text-emerald-900', 'border', 'border-emerald-300');
    }
  }
}

window.generarCuotasMasivas = async function(event) {
  event.preventDefault();
  const mes = document.getElementById('inp-mes-cuota').value;
  const monto = limpiarGuaraniesInput(document.getElementById('inp-monto-cuota').value);
  if (!mes || !monto || monto <= 0) {
    mostrarMensajeAdmin('cuotas-msg', 'Elegí mes y monto válido.', true);
    return;
  }
  const btn = document.getElementById('btn-generar-cuotas');
  btn.textContent = 'Generando...';
  btn.disabled = true;
  try {
    const { data: clientes } = await supabaseClient.from('clientes').select('id').eq('activo', true);
    if (!clientes || clientes.length === 0) throw new Error('No hay socios activos.');
    
    const { data: existentes } = await supabaseClient.from('facturas').select('cliente_id').eq('mes', mes);
    const yaTienen = new Set((existentes || []).map((f) => f.cliente_id));
    
    const nuevas = clientes
      .filter((c) => !yaTienen.has(c.id))
      .map((c) => ({ cliente_id: c.id, mes, monto, saldo_pendiente: monto, estado: 'pendiente' }));
    
    if (nuevas.length === 0) throw new Error('Ya se generaron cuotas para ' + mes);
    
    const { error } = await supabaseClient.from('facturas').insert(nuevas);
    if (error) throw error;
    
    await cargarDatosAdmin();
    mostrarMensajeAdmin(
      'cuotas-msg',
      'Cuotas generadas: ' + nuevas.length + ' socios (se aplicó saldo a favor automático donde correspondía). Ya tenían: ' + yaTienen.size,
      false
    );
  } catch (e) {
    mostrarMensajeAdmin('cuotas-msg', 'Error: ' + e.message, true);
  }
  btn.textContent = 'Generar Cuotas a Todos';
  btn.disabled = false;
};