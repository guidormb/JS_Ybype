// admin-proveedores.js - Gestión de Padrón de Proveedores (personas + proveedores)

const SUPABASE_URL_PROV = 'https://zbwpsemyeejebpfkaepz.supabase.co';
const SUPABASE_KEY_PROV = 'sb_publishable_dxeFPiwiG1Fjvp7kS8vqOw_bY6kYNXE';
const ADMIN_EMAIL_PROV = 'guidorafa92@gmail.com';

const sbProv = window.supabaseClient || window.supabase.createClient(SUPABASE_URL_PROV, SUPABASE_KEY_PROV);

let proveedoresCache = [];

function escProv(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hoyParaguayISO() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).split('-');
  return `${partes[0]}-${partes[1]}-${partes[2]}`;
}

function limpiarRucProv(v) {
  return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
}

function limpiarTimbradoProv(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 8);
}

function mostrarMsgProv(texto, esError = false) {
  const el = document.getElementById('prov-msg');
  if (!el) return;
  el.textContent = texto;
  el.className = esError
    ? 'mt-3 p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-700 border border-red-200'
    : 'mt-3 p-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
  el.classList.remove('hidden');
}

function limpiarFormularioProveedor() {
  document.getElementById('prov-id').value = '';
  document.getElementById('persona-id').value = '';
  document.getElementById('prov-nombre').value = '';
  document.getElementById('prov-apellido').value = '';
  document.getElementById('prov-ruc').value = '';
  document.getElementById('prov-telefono').value = '';
  document.getElementById('prov-direccion').value = '';
  document.getElementById('prov-timbrado').value = '';
  document.getElementById('prov-vencimiento').value = '';
  document.getElementById('prov-notas').value = '';
  document.getElementById('prov-activo').checked = true;
  document.getElementById('prov-form-titulo').textContent = 'Nuevo Proveedor';
  document.getElementById('btn-prov-guardar').textContent = 'Guardar Proveedor';
}

window.nuevoProveedorForm = function () {
  limpiarFormularioProveedor();
  document.getElementById('prov-msg')?.classList.add('hidden');
  document.getElementById('prov-nombre')?.focus();
};

function estadoTimbradoBadge(fechaFin) {
  if (!fechaFin) {
    return '<span class="inline-block text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Sin vencimiento cargado</span>';
  }
  const hoy = hoyParaguayISO();
  if (fechaFin < hoy) {
    return `<span class="inline-block text-[11px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Timbrado vencido (${escProv(fechaFin)})</span>`;
  }
  return `<span class="inline-block text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Vigente hasta ${escProv(fechaFin)}</span>`;
}

function renderizarListaProveedores() {
  const cont = document.getElementById('lista-proveedores');
  const contador = document.getElementById('prov-contador');
  const filtro = (document.getElementById('prov-buscar')?.value || '').trim().toLowerCase();

  const filtrados = proveedoresCache.filter((item) => {
    if (!filtro) return true;
    const p = item.personas || {};
    const texto = [
      p.nombre,
      p.apellido,
      p.cedula_ruc,
      item.timbrado_vigente,
      p.telefono
    ].join(' ').toLowerCase();
    return texto.includes(filtro);
  });

  if (contador) {
    contador.textContent = `${filtrados.length} de ${proveedoresCache.length} proveedores`;
  }

  if (!cont) return;

  if (filtrados.length === 0) {
    cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">No hay proveedores para mostrar.</p>';
    return;
  }

  cont.innerHTML = filtrados.map((item) => {
    const p = item.personas || {};
    const nombreCompleto = `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre';
    const estadoBadge = item.activo
      ? '<span class="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Activo</span>'
      : '<span class="text-[11px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Inactivo</span>';

    return `
      <div class="border border-slate-200 rounded-xl p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-bold text-slate-800">${escProv(nombreCompleto)}</p>
            ${estadoBadge}
            ${estadoTimbradoBadge(item.fecha_fin_timbrado)}
          </div>
          <p class="text-xs text-slate-600">
            <strong>RUC/CI:</strong> ${escProv(p.cedula_ruc || '-')} ·
            <strong>Timbrado:</strong> ${escProv(item.timbrado_vigente || '-')}
          </p>
          <p class="text-xs text-slate-500">
            ${p.telefono ? 'Tel: ' + escProv(p.telefono) + ' · ' : ''}
            ${p.direccion ? escProv(p.direccion) : ''}
          </p>
          ${item.notas ? `<p class="text-[11px] text-slate-500 italic">${escProv(item.notas)}</p>` : ''}
        </div>
        <div class="shrink-0">
          <button
            type="button"
            onclick="editarProveedor('${escProv(item.id)}')"
            class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
          >
            Editar
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.cargarProveedores = async function () {
  const cont = document.getElementById('lista-proveedores');
  if (cont) cont.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">Cargando proveedores...</p>';

  const { data, error } = await sbProv
    .from('proveedores')
    .select('id, persona_id, timbrado_vigente, fecha_fin_timbrado, activo, notas, personas(id, nombre, apellido, cedula_ruc, telefono, direccion)')
    .order('created_at', { ascending: false });

  if (error) {
    if (cont) cont.innerHTML = `<p class="text-xs text-red-600 text-center py-4">Error: ${escProv(error.message)}</p>`;
    return;
  }

  proveedoresCache = data || [];
  renderizarListaProveedores();
};

window.editarProveedor = function (id) {
  const item = proveedoresCache.find((x) => String(x.id) === String(id));
  if (!item) return;
  const p = item.personas || {};

  document.getElementById('prov-id').value = item.id;
  document.getElementById('persona-id').value = item.persona_id || '';
  document.getElementById('prov-nombre').value = p.nombre || '';
  document.getElementById('prov-apellido').value = p.apellido || '';
  document.getElementById('prov-ruc').value = p.cedula_ruc || '';
  document.getElementById('prov-telefono').value = p.telefono || '';
  document.getElementById('prov-direccion').value = p.direccion || '';
  document.getElementById('prov-timbrado').value = item.timbrado_vigente || '';
  document.getElementById('prov-vencimiento').value = item.fecha_fin_timbrado || '';
  document.getElementById('prov-notas').value = item.notas || '';
  document.getElementById('prov-activo').checked = Boolean(item.activo);

  document.getElementById('prov-form-titulo').textContent = 'Editar Proveedor';
  document.getElementById('btn-prov-guardar').textContent = 'Actualizar Proveedor';
  document.getElementById('prov-msg')?.classList.add('hidden');
  document.getElementById('prov-nombre')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.guardarProveedor = async function (event) {
  event.preventDefault();

  const { data: sesData } = await sbProv.auth.getSession();
  const email = (sesData?.session?.user?.email || '').trim().toLowerCase();
  if (!sesData?.session || email !== ADMIN_EMAIL_PROV.toLowerCase()) {
    mostrarMsgProv('Tenés que iniciar sesión como Administrador para guardar proveedores.', true);
    return;
  }

  const provId = document.getElementById('prov-id').value.trim();
  let personaId = document.getElementById('persona-id').value.trim();
  const nombre = document.getElementById('prov-nombre').value.trim();
  const apellido = document.getElementById('prov-apellido').value.trim() || null;
  const ruc = limpiarRucProv(document.getElementById('prov-ruc').value);
  const telefono = document.getElementById('prov-telefono').value.trim() || null;
  const direccion = document.getElementById('prov-direccion').value.trim() || null;
  const timbrado = limpiarTimbradoProv(document.getElementById('prov-timbrado').value) || null;
  const vencimiento = document.getElementById('prov-vencimiento').value || null;
  const notas = document.getElementById('prov-notas').value.trim() || null;
  const activo = document.getElementById('prov-activo').checked;

  if (!nombre) {
    mostrarMsgProv('Completá el nombre o razón social del proveedor.', true);
    return;
  }

  if (timbrado && timbrado.length < 7) {
    mostrarMsgProv('El timbrado debe tener entre 7 y 8 dígitos numéricos.', true);
    return;
  }

  const btn = document.getElementById('btn-prov-guardar');
  const textoBtn = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    // Si no estamos editando pero el RUC ya existe en personas, reutilizamos esa persona
    if (!personaId && ruc) {
      const { data: existentePer, error: errBusq } = await sbProv
        .from('personas')
        .select('id')
        .eq('cedula_ruc', ruc)
        .maybeSingle();
      if (errBusq) throw errBusq;
      if (existentePer?.id) {
        personaId = existentePer.id;
      }
    }

    if (personaId) {
      const { error: errUpdPer } = await sbProv
        .from('personas')
        .update({
          nombre,
          apellido,
          cedula_ruc: ruc || null,
          telefono,
          direccion
        })
        .eq('id', personaId);
      if (errUpdPer) throw errUpdPer;
    } else {
      const { data: nuevaPer, error: errInsPer } = await sbProv
        .from('personas')
        .insert({
          nombre,
          apellido,
          cedula_ruc: ruc || null,
          telefono,
          direccion
        })
        .select('id')
        .single();
      if (errInsPer) throw errInsPer;
      personaId = nuevaPer.id;
    }

    if (provId) {
      const { error: errUpdProv } = await sbProv
        .from('proveedores')
        .update({
          persona_id: personaId,
          timbrado_vigente: timbrado,
          fecha_fin_timbrado: vencimiento,
          activo,
          notas
        })
        .eq('id', provId);
      if (errUpdProv) throw errUpdProv;
      mostrarMsgProv('Proveedor actualizado correctamente.', false);
    } else {
      const { error: errInsProv } = await sbProv
        .from('proveedores')
        .insert({
          persona_id: personaId,
          timbrado_vigente: timbrado,
          fecha_fin_timbrado: vencimiento,
          activo,
          notas
        });
      if (errInsProv) throw errInsProv;
      mostrarMsgProv('Proveedor guardado en el padrón.', false);
      limpiarFormularioProveedor();
    }

    await window.cargarProveedores();
  } catch (err) {
    mostrarMsgProv('Error al guardar: ' + (err?.message || err), true);
  } finally {
    btn.disabled = false;
    btn.textContent = textoBtn;
  }
};

async function iniciarVistaProveedores() {
  const sinAcceso = document.getElementById('prov-sin-acceso');
  const contenido = document.getElementById('prov-contenido');

  document.getElementById('prov-timbrado')?.addEventListener('input', function () {
    this.value = limpiarTimbradoProv(this.value);
  });

  document.getElementById('prov-buscar')?.addEventListener('input', renderizarListaProveedores);

  const { data } = await sbProv.auth.getSession();
  const email = (data?.session?.user?.email || '').trim().toLowerCase();
  const esAdmin = Boolean(data?.session) && email === ADMIN_EMAIL_PROV.toLowerCase();

  if (!esAdmin) {
    sinAcceso?.classList.remove('hidden');
    contenido?.classList.add('hidden');
    return;
  }

  sinAcceso?.classList.add('hidden');
  contenido?.classList.remove('hidden');
  await window.cargarProveedores();
}

document.addEventListener('DOMContentLoaded', iniciarVistaProveedores);