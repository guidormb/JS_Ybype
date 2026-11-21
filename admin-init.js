// admin-init.js - Va último, arranca todo
document.getElementById('inp-monto').addEventListener('input', function() { formatearGuaraniesInput(this); });
document.getElementById('inp-monto-anticipo').addEventListener('input', function() { formatearGuaraniesInput(this); });
document.getElementById('gasto-monto').addEventListener('input', function() { formatearGuaraniesInput(this); });
document.getElementById('inp-monto-cuota').addEventListener('input', function() { formatearGuaraniesInput(this); });
document.getElementById('edit-gasto-monto').addEventListener('input', function() { formatearGuaraniesInput(this); });

verificarSesionAdmin();