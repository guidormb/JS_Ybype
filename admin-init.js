// admin-init.js - Va último, arranca todo - CORREGIDO
document.getElementById('inp-monto').addEventListener('input', function() { formatearGuaraniesInput(this); });
document.getElementById('inp-monto-anticipo').addEventListener('input', function() { formatearGuaraniesInput(this); });
document.getElementById('gasto-monto').addEventListener('input', function() { formatearGuaraniesInput(this); });
document.getElementById('inp-monto-cuota').addEventListener('input', function() { formatearGuaraniesInput(this); });
document.getElementById('edit-gasto-monto').addEventListener('input', function() { formatearGuaraniesInput(this); });

// === SEGURO: Si admin-gastos.js falló por algo, creamos la función acá para que no rompa el login ===
if (typeof window.cargarGastosRecientes === 'undefined') {
  console.warn('cargarGastosRecientes no estaba cargada, creo versión de emergencia');
  window.cargarGastosRecientes = async function() {
    var cont = document.getElementById('lista-gastos');
    if (!cont) return;
    try {
      var r = await supabaseClient.from('gastos').select('*').eq('estado', 'activo').order('created_at', { ascending: false }).limit(20);
      var gastos = r.data || [];
      if (gastos.length === 0) {
        cont.innerHTML = '<p class="text-xs text-slate-500 text-center">Sin gastos activos.</p>';
        return;
      }
      cont.innerHTML = gastos.map(function(g) {
        return '<div class="flex justify-between items-start gap-2 border-b pb-2">' +
          '<div class="flex-1"><p class="text-xs font-bold">' + escapeHtml(g.descripcion || '') + '</p>' +
          '<p class="text-[11px] text-slate-500">' + escapeHtml(g.categoria || '') + ' - ' + escapeHtml(g.fecha || '') + '</p></div>' +
          '<div class="flex flex-col items-end gap-1"><span class="text-xs font-bold text-red-600">Gs. ' + Number(g.monto).toLocaleString('es-PY') + '</span>' +
          '<div class="flex gap-1">' +
          '<button type="button" onclick="window.abrirEditarGasto(\'' + g.id + '\', \'' + escapeHtml(g.descripcion || '') + '\', \'' + escapeHtml(g.categoria || 'otros') + '\', ' + g.monto + ', \'' + escapeHtml(g.proveedor_beneficiario || '') + '\', \'' + escapeHtml(g.fecha || '') + '\')" class="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">Editar</button>' +
          '<button type="button" onclick="window.anularGasto(\'' + g.id + '\', \'' + escapeHtml(g.descripcion || '') + '\')" class="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">Anular</button>' +
          '</div></div></div>';
      }).join('');
    } catch (e) {
      console.error('Error emergencia gastos:', e);
    }
  };
  window.cargarGastos = window.cargarGastosRecientes;
}

verificarSesionAdmin();