// admin-auth.js - CORREGIDO - Nunca más rompe el login si falla una función
const supabaseClient = window.supabaseClient;

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
  const textoOriginal = btn.textContent;
  btn.textContent = 'Verificando...';
  btn.disabled = true;
  try {
    const r = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (r.error) {
      mostrarMensajeAdmin('login-msg', 'Correo o contraseña incorrecta: ' + r.error.message, true);
      btn.textContent = textoOriginal;
      btn.disabled = false;
      return;
    }
    await window.verificarSesionAdmin();
  } catch (e) {
    alert('Error al entrar: ' + (e?.message || e));
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
};

window.cerrarSesion = async function() {
  try {
    await Promise.race([
      supabaseClient.auth.signOut(),
      new Promise((res) => setTimeout(res, 1500))
    ]);
  } catch (e) {}
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k);
    });
    sessionStorage.clear();
  } catch (e) {}
  window.location.href = 'admin-junta.html?logout=1';
};

window.verificarSesionAdmin = async function() {
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
      const btn = document.getElementById('btn-login-admin');
      if (btn) { btn.textContent = 'Ingresar'; btn.disabled = false; }
      return;
    }
    const email = session.user.email || '';
    const rol = session.user.user_metadata?.rol;
    const esAdmin = rol === 'admin' || !email.startsWith('ci_');
    if (!esAdmin) {
      alert('Esta sección es solo para Admin.');
      await supabaseClient.auth.signOut();
      location.reload();
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
    await window.cargarDatosAdmin();
    const btn = document.getElementById('btn-login-admin');
    if (btn) { btn.textContent = 'Ingresar'; btn.disabled = false; }
  } catch (e) {
    console.error('verificarSesionAdmin', e);
    // Ya no tiramos alert que traba todo, solo logueamos
    const btn = document.getElementById('btn-login-admin');
    if (btn) { btn.textContent = 'Ingresar'; btn.disabled = false; }
  }
};

// Alias por si otro archivo la llama sin window
var verificarSesionAdmin = window.verificarSesionAdmin;

window.cargarDatosAdmin = async function() {
  // CORREGIDO: con window. + ?. + allSettled, si una falla no rompe las demás
  await Promise.allSettled([
    window.cargarSocios ? window.cargarSocios() : Promise.resolve(),
    window.cargarPagosRecientes ? window.cargarPagosRecientes() : Promise.resolve(),
    window.cargarGastosRecientes ? window.cargarGastosRecientes() : Promise.resolve(),
    window.cargarBalance ? window.cargarBalance() : Promise.resolve()
  ]);
};
var cargarDatosAdmin = window.cargarDatosAdmin;

// Al abrir la página, verifica si ya hay sesión
document.addEventListener('DOMContentLoaded', () => {
  window.verificarSesionAdmin();
}); 