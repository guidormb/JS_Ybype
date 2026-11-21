// admin-config.js - DEFINITIVO
const SUPABASE_URL = 'https://zbwpsemyeejebpfkaepz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dxeFPiwiG1Fjvp7kS8vqOw_bY6kYNXE';

// Guardamos el cliente en un nombre propio que nadie pisa
if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let listaSociosCobro = [];
let gastosRecientesCache = [];
let pagosRecientesCache = [];
let modoReporteActual = 'mes';