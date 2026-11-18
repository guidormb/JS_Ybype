import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://zbwpsemyeejebpfkaepz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_dxeFPiwiG1Fjvp7kS8vqOw_bY6kYNXE'
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_KEY)

// 1. Proteger index.html Y padron.html
const path = location.pathname
if (path.includes('index.html') || path.includes('padron.html') || path === '/' || path.endsWith('/')) {
  const { data: { session } } = await supabaseAuth.auth.getSession()
  if (!session) location.replace('login.html')
}
window.logout = async () => {
  await supabaseAuth.auth.signOut()
  location.replace('login.html')
}

// 2. Login
document.getElementById("formLogin")?.addEventListener("submit", async e => {
  e.preventDefault()
  const email = document.getElementById("loginUser").value.trim()
  const password = document.getElementById("loginPass").value
  document.getElementById("msg").textContent = "Verificando..."
  
  const { error } = await supabaseAuth.auth.signInWithPassword({ email, password })
  if (error) {
    document.getElementById("msg").textContent = "❌ " + error.message
  } else {
    location.replace("padron.html")
  }
})

// 3. Registro (crea usuario en Supabase)
document.getElementById("formRegistro")?.addEventListener("submit", async e => {
  e.preventDefault()
  const email = document.getElementById("regUser").value.trim()
  const password = document.getElementById("regPass").value
  
  const { error } = await supabaseAuth.auth.signUp({ email, password })
  if (error) {
    document.getElementById("msg").textContent = "❌ " + error.message
  } else {
    alert("✅ Cuenta creada! Ya podés entrar. Si te pide confirmar email, revisá tu correo.")
    document.getElementById("formRegistro").style.display = "none"
    document.getElementById("formLogin").style.display = "flex"
  }
})

document.getElementById("linkRegistro")?.addEventListener("click", e => {
  e.preventDefault()
  document.getElementById("formLogin").style.display = "none"
  document.getElementById("formRegistro").style.display = "flex"
})
document.getElementById("btnVolver")?.addEventListener("click", () => {
  document.getElementById("formRegistro").style.display = "none"
  document.getElementById("formLogin").style.display = "flex"
})