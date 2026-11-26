const SUPABASE_URL = 'https://zbwpsemyeejebpfkaepz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dxeFPiwiG1Fjvp7kS8vqOw_bY6kYNXE';
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

let ultimoUserIdVerificado = null;
let ultimoResultadoEsAdmin = false;

function activarBoton(boton) {
  if (!boton) return;
  botones.forEach((b) => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  boton.classList.add('active');
  boton.setAttribute('aria-current', 'page');
}

function navegarA(boton) {
  if (!boton || !visor) return;
  activarBoton(boton);
  if (boton.dataset.src) {
    visor.src = boton.dataset.src;
  }
  const nuevoTitulo = boton.dataset.titulo || 'Portal del Socio';
  if (tituloVista) {
    tituloVista.textContent = nuevoTitulo;
  }
  visor.title = nuevoTitulo;
}

botones.forEach((btn) => {
  btn.addEventListener('click', () => navegarA(btn));
});

function toggleElemento(el, mostrar) {
  if (!el) return;
  el.classList.toggle('hidden', !mostrar);
}

async function verificarRolAdminMenu(session) {
  const userId = session?.user?.id || null;
  if (!userId || !sbMenu) {
    ultimoUserIdVerificado = null;
    ultimoResultadoEsAdmin = false;
    return false;
  }

  if (ultimoUserIdVerificado === userId) {
    return ultimoResultadoEsAdmin;
  }

  try {
    const { data, error } = await sbMenu
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data?.role === 'admin') {
      ultimoUserIdVerificado = userId;
      ultimoResultadoEsAdmin = true;
      return true;
    }

    const rpcRes = await sbMenu.rpc('es_admin');
    const esAdminRpc = !rpcRes.error && rpcRes.data === true;

    ultimoUserIdVerificado = userId;
    ultimoResultadoEsAdmin = esAdminRpc;
    return esAdminRpc;
  } catch (err) {
    console.warn('Error al verificar rol en menú:', err);
    return false;
  }
}

async function aplicarMenuPorRol(session) {
  const esAdmin = await verificarRolAdminMenu(session);

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
        if (tituloVista) tituloVista.textContent = 'Portal del Socio';
        visor.title = 'Portal del Socio';
      }
    }
  }
}

async function inicializarMenu() {
  if (!sbMenu?.auth) return;

  try {
    const { data, error } = await sbMenu.auth.getSession();
    if (!error) {
      await aplicarMenuPorRol(data?.session || null);
    }
  } catch (err) {
    console.error('Error al obtener sesión inicial:', err);
  }

  // Escucha cambios de login/logout ocurridos dentro de los iframes o pestañas
  sbMenu.auth.onAuthStateChange(async (_event, session) => {
    await aplicarMenuPorRol(session);
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