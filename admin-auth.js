// admin-auth.js
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

window.manejarLoginAdmin = async function(event) {
  event.preventDefault();
  const email = document.getElementById('login-email-admin').value.trim();
  const pass = document.getElementById('login-pass-admin').value;
  const btn = document.getElementById('btn-login-admin');
  btn.textContent = 'Verificando...';
  btn.disabled = true;
  const r = await supabase.auth.signInWithPassword({ email, password: pass });
  if (r.error) {
    mostrarMensajeAdmin('login-msg', 'Correo o contraseña incorrecta.', true);
    btn.textContent = 'Ingresar';
    btn.disabled = false;
    return;
  }
  await verificarSesionAdmin();
};

window.cerrarSesion = async function() {
  await supabase.auth.signOut();
  location.reload();
};

async function verificarSesionAdmin() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const acciones = document.getElementById('header-acciones');
  if (!session) {
    document.getElementById('box-login').classList.remove('hidden');
    document.getElementById('box-contenido').classList.add('hidden');
    if (acciones) acciones.classList.add('hidden');
    document.getElementById('modal-nuevo-socio').classList.add('hidden');
    return;
  }
  document.getElementById('box-login').classList.add('hidden');
  document.getElementById('box-contenido').classList.remove('hidden');
  if (acciones) acciones.classList.remove('hidden');
  const hoy = new Date();
  const ym = hoy.toISOString().slice(0, 7);
  const ymd = hoy.toISOString().slice(0, 10);
  const repMesEl = document.getElementById('rep-mes-input');
  const repDesdeEl = document.getElementById('rep-fecha-desde');
  const repHastaEl = document.getElementById('rep-fecha-hasta');
  if (repMesEl && !repMesEl.value) repMesEl.value = ym;
  if (repDesdeEl && !repDesdeEl.value) repDesdeEl.value = `${ym}-01`;
  if (repHastaEl && !repHastaEl.value) repHastaEl.value = ymd;
  await cargarDatosAdmin();
}

async function cargarDatosAdmin() {
  await Promise.all([cargarSocios(), cargarPagosRecientes(), cargarGastosRecientes(), cargarBalance()]);
}