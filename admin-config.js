// admin-config.js
const SUPABASE_URL = 'https://zbwpsemyeejebpfkaepz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dxeFPiwiG1Fjvp7kS8vqOw_bY6kYNXE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabase;

let listaSociosCobro = [];
let gastosRecientesCache = [];
let pagosRecientesCache = [];
let modoReporteActual = 'mes';