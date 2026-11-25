const SUPABASE_URL = 'https://zbwpsemyeejebpfkaepz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dxeFPiwiG1Fjvp7kS8vqOw_bY6kYNXE';
const ADMIN_EMAIL = 'guidorafa92@gmail.com';
const RUTA_PORTAL_SOCIO = './portal-cliente.html';

const sbMenu = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

const visor = document.getElementById('visor');
const tituloVista = document.getElementById('tituloVista');
const botones = document.querySelectorAll('.nav-btn');

const labelAdmin = document.getElementById('labelAdmin');
const btnCaja = document.getElementById('btnCaja');
const btnPadron = document.getElementById('btnPadron');
const btnProveedores = document.getElementById('btnProveedores');
const btnAccesoAdmin = document.getElementById('btnAccesoAdmin');

function activarBoton(boton) {
  if (!boton) return;
  botones.forEach((b) => b.classList.remove('active'));
  boton.classList.add('active');
}

function navegarA(boton) {
  if (!boton || !visor) return;
  activarBoton(boton);
  if (boton.dataset.src) {
    visor.src = boton.dataset.src;
  }
  if (tituloVista && boton.dataset.titulo) {
    tituloVista.textContent = boton.dataset.titulo;
  }
}

botones.forEach((btn) => {
  btn.addEventListener('click', () => navegarA(btn));
});

function toggleElemento(el, mostrar) {
  if (!el) return;
  el.classList.toggle('hidden', !mostrar);
}

function aplicarMenuPorRol(session) {
  const email = session?.user?.email ? session.user.email.trim().toLowerCase() : '';
  const esAdmin = email === ADMIN_EMAIL.toLowerCase();

  toggleElemento(labelAdmin, esAdmin);
  toggleElemento(btnCaja, esAdmin);
  toggleElemento(btnPadron, esAdmin);
  toggleElemento(btnProveedores, esAdmin);
  toggleElemento(btnAccesoAdmin, !esAdmin);

  if (!esAdmin && visor) {
    const rutaActual = visor.getAttribute('src') || '';
    if (
      rutaActual.includes('padron') ||
      rutaActual.includes('proveedores') ||
      rutaActual.includes('admin-junta.html')
    ) {
      const btnSocio = document.querySelector(`.nav-btn[data-src="${RUTA_PORTAL_SOCIO}"]`);
      if (btnSocio) {
        navegarA(btnSocio);
      } else {
        visor.src = RUTA_PORTAL_SOCIO;
      }
    }
  }
}

async function inicializarMenu() {
  if (!sbMenu?.auth) return;

  const { data, error } = await sbMenu.auth.getSession();
  if (!error) {
    aplicarMenuPorRol(data?.session || null);
  }

  // Escucha cambios de login/logout ocurridos dentro de los iframes
  sbMenu.auth.onAuthStateChange((_event, session) => {
    aplicarMenuPorRol(session);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => console.log('SW registrado:', reg.scope))
      .catch((err) => console.error('Error SW:', err));
  });
}

inicializarMenu();