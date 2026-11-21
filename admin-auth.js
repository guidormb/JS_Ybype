// admin-auth.js - con supabaseClient
window.abrirModalNuevoSocio = async function() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    alert('Tenés que iniciar sesión como Admin primero.');
    return;
  }
  document.getElementById('modal-nuevo-socio')?.classList.remove('hidden');
};

window.abrirPadron = async function() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    alert('Tenés que iniciar sesión como Admin primero.');
    return;
  }
  if (window.parent && window.parent !== window) {
    const btnPadron = window.parent.document.querySelector('.nav-btn[data-src*="padron.html"]');
    if (btnPadron) { btnPadron.click(); return; }
  }
  window.location.href = 'padron.html';
};

window.cerrarModalNuevoSocio = function() {
  document.getElementById('modal-nuevo-socio')?.classList.add('hidden');
  document.getElementById('ns-msg')?.classList.add('hidden');
};

window.manejarLoginAdmin = async function(event) {
  event.preventDefault();
  const email = document.getElementById('login-email-admin').value.trim();
  const pass = document.getElementById('login-pass-admin').value;
  const btn = document.getElementById('btn-login-admin');
  btn.textContent = 'Verificando...';
  btn.disabled = true;
  try {
    const r = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (r.error) {
      mostrarMensajeAdmin('login-msg', 'Correo o contraseña incorrecta: ' + r.error.message, true);
      btn.textContent = 'Ingresar';
      btn.disabled = false;
      return;
    }
    await verificarSesionAdmin();
  } catch (e) {
    alert('Error al entrar: ' + (e?.message || e));
    btn.textContent = 'Ingresar';
    btn.disabled = false;
  }
};

window.cerrarSesion = async function() {
  await supabaseClient.auth.signOut();
  location.reload();
};

async function verificarSesionAdmin() {
  try {
    const { data } = await supabaseClient.auth.getSession();
    const session = data.session;
    const acciones = document.getElementById('header-acciones');
    const boxLogin = document.getElementById('box-login');
    const boxContenido = document.getElementById('box-contenido');
    if (!session) {
      boxLogin?.classList.remove('hidden');
      boxContenido?.classList.add('hidden');
      if (acciones) acciones.classList.add('hidden');
      document.getElementById('modal-nuevo-socio')?.classList.add('hidden');
      return;
    }
    boxLogin?.classList.add('hidden');
    boxContenido?.classList.remove('hidden');
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
  } catch (e) {
    console.error('verificarSesionAdmin', e);
    alert('Entraste, pero falló al cargar datos: ' + (e?.message || e));
    const btn = document.getElementById('btn-login-admin');
    if (btn) { btn.textContent = 'Ingresar'; btn.disabled = false; }
  }
}

async function cargarDatosAdmin() {
  await Promise.all([cargarSocios(), cargarPagosRecientes(), cargarGastosRecientes(), cargarBalance()]);
}