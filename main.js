const SUPABASE_URL = 'https://zbwpsemyeejebpfkaepz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dxeFPiwiG1Fjvp7kS8vqOw_bY6kYNXE';
const ADMIN_EMAIL = 'guidorafa92@gmail.com';

const sbMenu = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const visor = document.getElementById('visor');
const tituloVista = document.getElementById('tituloVista');
const botones = document.querySelectorAll('.nav-btn');

const labelAdmin = document.getElementById('labelAdmin');
const btnCaja = document.getElementById('btnCaja');
const btnPadron = document.getElementById('btnPadron');
const btnAccesoAdmin = document.getElementById('btnAccesoAdmin');

function activarBoton(boton) {
  botones.forEach((b) => b.classList.remove('active'));
  boton.classList.add('active');
}

function navegarA(boton) {
  activarBoton(boton);
  visor.src = boton.dataset.src;
  tituloVista.textContent = boton.dataset.titulo;
}

botones.forEach((btn) => {
  btn.addEventListener('click', () => navegarA(btn));
});

function aplicarMenuPorRol(session) {
  const email = session && session.user && session.user.email ?
    session.user.email.toLowerCase() :
    '';
  const esAdmin = email === ADMIN_EMAIL.toLowerCase();
  
  if (esAdmin) {
    labelAdmin.classList.remove('hidden');
    btnCaja.classList.remove('hidden');
    btnPadron.classList.remove('hidden');
    btnAccesoAdmin.classList.add('hidden');
  } else {
    labelAdmin.classList.add('hidden');
    btnCaja.classList.add('hidden');
    btnPadron.classList.add('hidden');
    btnAccesoAdmin.classList.remove('hidden');
    
    // Si estaba parado en Caja o Padrón y cerró sesión, volver a Portal Socio
    const rutaActual = visor.getAttribute('src') || '';
    if (rutaActual.includes('padron') || rutaActual.includes('admin-junta.html')) {
      const btnSocio = document.querySelector('.nav-btn[data-src="./portal-cliente.html"]');
      if (btnSocio) navegarA(btnSocio);
    }
  }
}

async function inicializarMenu() {
  const { data } = await sbMenu.auth.getSession();
  aplicarMenuPorRol(data.session);
  
  // Escucha cambios de login/logout ocurridos dentro de los iframes
  sbMenu.auth.onAuthStateChange((_event, session) => {
    aplicarMenuPorRol(session);
  });
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.error('Error SW:', err));
  });
}

inicializarMenu();