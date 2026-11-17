const SUPABASE_URL = 'https://zbwpsemyeejebpfkaepz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dxeFPiwiG1Fjvp7kS8vqOw_bY6kYNXE';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const nombreInput = document.getElementById('nombre');
const emailInput = document.getElementById('email');
const edadInput = document.getElementById('edad');
const btnGuardar = document.getElementById('btn-guardar');
const listaUsers = document.getElementById('lista-users');

async function cargarUsers() {
  const { data, error } = await supabaseClient.from('users').select('*').order('id', {ascending: true});
  if (error) { console.error(error); alert(error.message); return; }
  
  listaUsers.innerHTML = '';
  data.forEach(user => {
    listaUsers.innerHTML += `
      <tr>
        <td>${user.id}</td>
        <td>${user.nombre}</td>
        <td>${user.email}</td>
        <td>${user.edad ?? '-'}</td>
        <td><button onclick="borrarUser(${user.id})">Borrar</button></td>
      </tr>
    `;
  });
}

async function guardarUser() {
  const nombre = nombreInput.value.trim();
  const email = emailInput.value.trim();
  const edad = edadInput.value ? parseInt(edadInput.value) : null;

  if (!nombre || !email) { alert('Falta nombre o email'); return; }

  const { error } = await supabaseClient.from('users').insert([{ nombre, email, edad }]);
  if (error) { alert('Error: ' + error.message); return; }
  
  nombreInput.value = ''; emailInput.value = ''; edadInput.value = '';
  cargarUsers();
}

async function borrarUser(id) {
  const { error } = await supabaseClient.from('users').delete().eq('id', id);
  if(error) alert(error.message);
  cargarUsers();
}

btnGuardar.addEventListener('click', guardarUser);
cargarUsers();