// PEGA ACÁ TUS CLAVES DE SUPABASE
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const nombreInput = document.getElementById('nombre');
const emailInput = document.getElementById('email');
const edadInput = document.getElementById('edad');
const btnGuardar = document.getElementById('btn-guardar');
const listaUsers = document.getElementById('lista-users');

async function cargarUsers() {
  const { data, error } = await supabaseClient.from('users').select('*').order('id', {ascending: true});
  if (error) { console.error(error); return; }
  
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
  const nombre = nombreInput.value;
  const email = emailInput.value;
  const edad = edadInput.value ? parseInt(edadInput.value) : null;

  if (!nombre || !email) { alert('Falta nombre o email'); return; }

  const { error } = await supabaseClient.from('users').insert([{ nombre, email, edad }]);
  if (error) { alert('Error: ' + error.message); return; }
  
  nombreInput.value = ''; emailInput.value = ''; edadInput.value = '';
  cargarUsers();
}

async function borrarUser(id) {
  await supabaseClient.from('users').delete().eq('id', id);
  cargarUsers();
}

btnGuardar.addEventListener('click', guardarUser);
cargarUsers();