/* =========================================================================
   Hotel Las Cañas — panel de administración (JS vanilla, sin dependencias).
   Página privada (no enlazada): se entra escribiendo /admin.html
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const MAX_BYTES = 6 * 1024 * 1024;
const TEMAS = ['esmeralda', 'costa-azul', 'carbon-oro', 'editorial-blanco'];

// Backend por defecto (el túnel): el admin del demo (github.io) funciona con solo
// abrir /admin.html, sin pasar ?api=. ?api=<URL> lo cambia; ?api=off vuelve a estático.
const API_DEFECTO = 'https://jamie-loan-mesh-roses.trycloudflare.com';
try {
  const _qp = new URLSearchParams(location.search).get('api');
  if (_qp != null) {
    const v = _qp.trim().replace(/\/+$/, '');
    if (v === '' || v.toLowerCase() === 'off') localStorage.removeItem('apiBase');
    else if (/^https?:\/\//.test(v)) localStorage.setItem('apiBase', v);
  }
} catch (e) { /* storage bloqueado */ }

async function pedir(url, opciones = {}) {
  let base = API_DEFECTO;
  try { base = localStorage.getItem('apiBase') || API_DEFECTO; } catch (e) { /* storage */ }
  const full = (base && typeof url === 'string' && url.indexOf('/api') === 0) ? base + url : url;
  const res = await fetch(full, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opciones });
  let data = {};
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { ok: res.ok, status: res.status, data };
}
function cargando(btn, activo) {
  if (!btn) return;
  btn.disabled = activo;
  if (activo) { btn.dataset.txt = btn.dataset.txt || btn.textContent; btn.textContent = 'Guardando…'; }
  else if (btn.dataset.txt) { btn.textContent = btn.dataset.txt; }
}
function mensaje(el, texto, tipo) { el.textContent = texto; el.className = 'msg' + (tipo ? ' ' + tipo : ''); }

/* ----- Pantallas ----- */
function mostrarLogin(err) {
  $('panelScreen').hidden = true;
  $('loginScreen').hidden = false;
  if (err) mensaje($('loginMsg'), err, 'err');
  $('adminPass').focus();
}
function mostrarPanel() {
  $('loginScreen').hidden = true;
  $('panelScreen').hidden = false;
  cargarConfig();
  cargarCatalogo();
  mostrarVista('viewReservas', { foco: false });
}

/* ----- Navegación por secciones (tablist) ----- */
const VISTAS = ['viewReservas', 'viewEstadisticas', 'viewClientes', 'viewPromociones', 'viewCorreo', 'viewWhatsapp', 'viewResenas', 'viewAjustes'];
const cargadas = new Set();

function cargarVista(id) {
  if (id === 'viewReservas') cargarReservas();
  else if (id === 'viewEstadisticas') cargarEstadisticas();
  else if (id === 'viewClientes') cargarClientes();
  else if (id === 'viewCorreo') cargarCorreo();
  else if (id === 'viewWhatsapp') cargarWhatsapp();
  else if (id === 'viewResenas') cargarResenas();
}

function mostrarVista(id, { foco = true } = {}) {
  VISTAS.forEach((v) => { const el = $(v); if (el) el.hidden = v !== id; });
  document.querySelectorAll('.adminnav__tab').forEach((t) => {
    const activo = t.dataset.view === id;
    t.setAttribute('aria-selected', String(activo));
    t.tabIndex = activo ? 0 : -1;
    if (activo && foco) t.focus();
  });
  // Carga diferida la primera vez que se abre la sección.
  if (!cargadas.has(id)) { cargadas.add(id); cargarVista(id); }
}

(function initNav() {
  const tabs = Array.from(document.querySelectorAll('.adminnav__tab'));
  tabs.forEach((t) => t.addEventListener('click', () => mostrarVista(t.dataset.view)));
  const nav = $('adminnav');
  if (nav) nav.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); mostrarVista(tabs[(i + 1) % tabs.length].dataset.view); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); mostrarVista(tabs[(i - 1 + tabs.length) % tabs.length].dataset.view); }
    else if (e.key === 'Home') { e.preventDefault(); mostrarVista(tabs[0].dataset.view); }
    else if (e.key === 'End') { e.preventDefault(); mostrarVista(tabs[tabs.length - 1].dataset.view); }
  });
})();

// Si una llamada admin responde 401, vuelve al login.
function manejar401() { mostrarLogin('Tu sesión de administrador expiró. Inicia sesión de nuevo.'); }

/* ----- Inicio de sesión ----- */
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = $('adminUser'); const pass = $('adminPass');
  mensaje($('loginMsg'), '', '');
  if (!user.value || !pass.value) { mensaje($('loginMsg'), 'Escribe tu usuario y contraseña.', 'err'); return; }
  const btn = $('btnLogin'); cargando(btn, true); btn.textContent = 'Entrando…';
  try {
    const { data } = await pedir('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: user.value.trim(), password: pass.value }),
    });
    if (data.ok) { pass.value = ''; mostrarPanel(); } // no se guarda la contraseña
    else mensaje($('loginMsg'), data.error || 'Usuario o contraseña incorrectos.', 'err');
  } catch {
    mensaje($('loginMsg'), 'Error de conexión. Intenta de nuevo.', 'err');
  } finally { btn.disabled = false; btn.textContent = 'Entrar'; }
});

$('btnSalir').addEventListener('click', async () => {
  try { await pedir('/api/admin/logout', { method: 'POST' }); } catch { /* ignora */ }
  mostrarLogin();
});

/* ----- Carga de configuración ----- */
async function cargarConfig() {
  const { status, data } = await pedir('/api/admin/config');
  if (status === 401) { manejar401(); return; }
  if (!data || !data.ok) return;
  llenarConfig(data.config || {});
}

function llenarConfig(c) {
  // Pagos
  $('pagoActivo').checked = c.pagoActivo !== false;
  document.querySelectorAll('.metodo').forEach((cb) => { cb.checked = (c.metodosPago || []).includes(cb.value); });
  $('modoPago').value = c.modoPago || 'simulado';
  const pas = c.pasarela || {};
  $('pasProveedor').value = pas.proveedor || '';
  $('pasModo').value = pas.modo || 'sandbox';
  $('pasarelaBox').hidden = $('modoPago').value !== 'pasarela';

  // Tarifas
  const cont = $('tarifas');
  cont.innerHTML = '';
  (c.tarifas || []).forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'tarifa';
    row.innerHTML =
      `<span class="tarifa__name">${esc(t.tipo)}<small>${esc(t.descripcion || '')}</small></span>` +
      `<label>RD$ <input type="number" min="0" step="50" class="tarifa-precio" data-tipo="${esc(t.tipo)}" data-desc="${esc(t.descripcion || '')}" value="${Number(t.precioNoche) || 0}"></label>`;
    cont.appendChild(row);
  });

  // Contacto
  const ct = c.contacto || {};
  $('cTelefono').value = ct.telefono || '';
  $('cWhatsapp').value = ct.whatsapp || '';
  $('cDireccion').value = ct.direccion || '';
  $('cEmail').value = ct.email || '';
  $('cInstagram').value = ct.instagram || '';
  $('cFacebook').value = ct.facebook || '';

  // Tema
  $('temaDefecto').value = TEMAS.includes(c.temaDefecto) ? c.temaDefecto : 'esmeralda';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Guarda un trozo de config (merge en el backend). Devuelve true si ok.
async function guardar(parcial, btn, msgEl) {
  cargando(btn, true); mensaje(msgEl, '', '');
  try {
    const { status, data } = await pedir('/api/admin/config', { method: 'POST', body: JSON.stringify(parcial) });
    if (status === 401) { manejar401(); return false; }
    if (data && data.ok) { mensaje(msgEl, 'Guardado.', 'ok'); if (data.config) llenarConfig(data.config); return true; }
    mensaje(msgEl, (data && data.error) || 'No se pudo guardar.', 'err'); return false;
  } catch {
    mensaje(msgEl, 'Error de conexión.', 'err'); return false;
  } finally { cargando(btn, false); }
}

/* ----- Guardar: Pagos ----- */
$('modoPago').addEventListener('change', () => { $('pasarelaBox').hidden = $('modoPago').value !== 'pasarela'; });
$('guardarPagos').addEventListener('click', () => {
  const metodos = Array.from(document.querySelectorAll('.metodo:checked')).map((c) => c.value);
  guardar({
    pagoActivo: $('pagoActivo').checked,
    metodosPago: metodos,
    modoPago: $('modoPago').value,
    pasarela: { proveedor: $('pasProveedor').value, modo: $('pasModo').value },
  }, $('guardarPagos'), $('pagosMsg'));
});

/* ----- Guardar: Tarifas ----- */
$('guardarTarifas').addEventListener('click', () => {
  const tarifas = Array.from(document.querySelectorAll('.tarifa-precio')).map((i) => ({
    tipo: i.dataset.tipo,
    descripcion: i.dataset.desc,
    precioNoche: Number(i.value) || 0,
  }));
  guardar({ tarifas }, $('guardarTarifas'), $('tarifasMsg'));
});

/* ----- Guardar: Contacto ----- */
$('guardarContacto').addEventListener('click', () => {
  guardar({
    contacto: {
      telefono: $('cTelefono').value.trim(),
      whatsapp: $('cWhatsapp').value.replace(/\D/g, ''),
      direccion: $('cDireccion').value.trim(),
      email: $('cEmail').value.trim(),
      instagram: $('cInstagram').value.trim(),
      facebook: $('cFacebook').value.trim(),
    },
  }, $('guardarContacto'), $('contactoMsg'));
});

/* ----- Guardar: Tema por defecto ----- */
$('guardarTema').addEventListener('click', () => {
  guardar({ temaDefecto: $('temaDefecto').value }, $('guardarTema'), $('temaMsg'));
});

/* ----- Fotos de habitaciones ----- */
async function cargarCatalogo() {
  const cont = $('rooms');
  try {
    const { data } = await pedir('/api/catalogo');
    if (!data || !data.ok) { cont.innerHTML = '<p class="msg err">No se pudo cargar el catálogo.</p>'; return; }
    cont.innerHTML = '';
    data.habitaciones.forEach((h) => cont.appendChild(filaHabitacion(h)));
  } catch {
    cont.innerHTML = '<p class="msg err">Error de conexión al cargar el catálogo.</p>';
  }
}

function filaHabitacion(h) {
  const row = document.createElement('div');
  row.className = 'room';
  row.innerHTML =
    `<img class="room__thumb" alt="Foto de ${esc(h.nombre)}" src="${esc(h.foto)}">` +
    `<div class="room__info"><h3>${esc(h.nombre)}</h3>` +
    `<p><span class="room__tipo">${esc(h.tipo)}</span> · ${esc(h.descripcion || '')}</p></div>` +
    `<div class="room__file"><span class="btn btn--ghost btn--sm">Cambiar foto<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Cambiar foto de ${esc(h.nombre)}"></span></div>` +
    `<p class="room__err" role="alert"></p>`;
  const input = row.querySelector('input[type="file"]');
  const err = row.querySelector('.room__err');
  const thumb = row.querySelector('.room__thumb');
  input.addEventListener('change', () => subirFoto(h.id, input, thumb, err));
  return row;
}

function subirFoto(id, input, thumb, err) {
  err.textContent = '';
  const file = input.files && input.files[0];
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { err.textContent = 'Usa PNG, JPG o WEBP.'; input.value = ''; return; }
  if (file.size > MAX_BYTES) { err.textContent = 'La imagen supera 6 MB.'; input.value = ''; return; }

  const lector = new FileReader();
  lector.onload = async () => {
    const dataUrl = lector.result;
    err.textContent = 'Subiendo…';
    try {
      const { status, data } = await pedir('/api/catalogo/foto', { method: 'POST', body: JSON.stringify({ id, imagen: dataUrl }) });
      if (status === 401) { manejar401(); return; }
      if (data && data.ok && data.habitacion) { thumb.src = data.habitacion.foto; err.textContent = ''; }
      else err.textContent = (data && data.error) || 'No se pudo subir la foto.';
    } catch {
      err.textContent = 'Error de conexión.';
    } finally { input.value = ''; }
  };
  lector.onerror = () => { err.textContent = 'No se pudo leer el archivo.'; };
  lector.readAsDataURL(file);
}

/* =========================================================================
   Secciones ampliadas: Reservas, Estadísticas, Clientes y Promociones.
   ========================================================================= */
const seleccionados = new Set(); // correos elegidos para promoción específica

function fmtFecha(f) {
  const s = String(f || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return f ? esc(String(f)) : '—';
  const [y, m, d] = s.split('-').map(Number);
  try { return new Date(y, m - 1, d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return s; }
}
function fmtMoneda(n, mon) { return `${mon || 'RD$'}${Number(n || 0).toLocaleString('es-DO')}`; }

function badgeEstado(estado) {
  const e = String(estado || '').trim().toUpperCase();
  const map = {
    ACTIVA: ['badge--ok', 'Activa'],
    HOSPEDADA: ['badge--info', 'Hospedada'],
    DECLINADA: ['badge--off', 'Cancelada'],
  };
  const [cls, txt] = map[e] || ['badge--off', estado || '—'];
  return `<span class="badge ${cls}">${esc(txt)}</span>`;
}

/* ----- Reservas ----- */
async function cargarReservas() {
  const wrap = $('reservasWrap');
  wrap.innerHTML = '<p class="msg">Cargando…</p>';
  try {
    const { status, data } = await pedir('/api/admin/reservas');
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { wrap.innerHTML = `<p class="msg err">${esc((data && data.error) || 'No se pudieron cargar las reservas.')}</p>`; return; }
    const r = data.reservas || [];
    if (!r.length) { wrap.innerHTML = '<p class="msg">Todavía no hay reservas web.</p>'; return; }
    const filas = r.map((x) =>
      `<tr><td data-th="N.º">${esc(String(x.numero))}</td>` +
      `<td data-th="Cliente">${esc(x.cliente || '—')}</td>` +
      `<td data-th="Tipo">${esc(x.tipo || '—')}</td>` +
      `<td data-th="Llegada">${fmtFecha(x.fecha)}</td>` +
      `<td data-th="Estado">${badgeEstado(x.estado)}</td>` +
      `<td data-th="Total">${x.total != null ? esc(fmtMoneda(x.total)) : '—'}</td>` +
      `<td data-th="Creado">${fmtFecha(x.creado)}</td></tr>`).join('');
    wrap.innerHTML =
      `<table class="table"><thead><tr>` +
      `<th scope="col">N.º</th><th scope="col">Cliente</th><th scope="col">Tipo</th>` +
      `<th scope="col">Llegada</th><th scope="col">Estado</th><th scope="col">Total</th><th scope="col">Creado</th>` +
      `</tr></thead><tbody>${filas}</tbody></table>`;
  } catch {
    wrap.innerHTML = '<p class="msg err">Error de conexión al cargar las reservas.</p>';
  }
}

/* ----- Estadísticas ----- */
async function cargarEstadisticas() {
  const wrap = $('estadisticasWrap');
  wrap.innerHTML = '<p class="msg">Cargando…</p>';
  try {
    const { status, data } = await pedir('/api/admin/estadisticas');
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { wrap.innerHTML = `<p class="msg err">${esc((data && data.error) || 'No se pudieron cargar las estadísticas.')}</p>`; return; }
    const mon = data.moneda || 'RD$';
    const tiles =
      `<div class="kpis">` +
      kpi('Reservas', data.total) +
      kpi('Activas', data.activas) +
      kpi('Hospedadas', data.hospedadas) +
      kpi('Canceladas', data.canceladas) +
      kpi('Ingresos', fmtMoneda(data.ingresos, mon)) +
      `</div>`;
    const tipos = Object.entries(data.porTipo || {});
    const desglose = tipos.length
      ? `<h3 class="kpis__sub">Reservas por tipo</h3>` +
        `<ul class="bytipo">${tipos.map(([t, n]) =>
          `<li><span class="bytipo__name">${esc(t)}</span><span class="bytipo__n">${esc(String(n))}</span></li>`).join('')}</ul>`
      : '<p class="hint">Aún no hay reservas por tipo.</p>';
    wrap.innerHTML = tiles + desglose;
  } catch {
    wrap.innerHTML = '<p class="msg err">Error de conexión al cargar las estadísticas.</p>';
  }
}
function kpi(label, valor) {
  return `<div class="kpi"><span class="kpi__val">${esc(String(valor))}</span><span class="kpi__lbl">${esc(label)}</span></div>`;
}

/* ----- Clientes ----- */
async function cargarClientes() {
  const wrap = $('clientesWrap');
  wrap.innerHTML = '<p class="msg">Cargando…</p>';
  try {
    const { status, data } = await pedir('/api/admin/clientes');
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { wrap.innerHTML = `<p class="msg err">${esc((data && data.error) || 'No se pudieron cargar los clientes.')}</p>`; return; }
    const cl = data.clientes || [];
    if (!cl.length) { wrap.innerHTML = '<p class="msg">Todavía no hay clientes registrados.</p>'; return; }
    const filas = cl.map((c) => {
      const promos = Number(c.acepta_promos) === 1;
      const marcado = seleccionados.has(c.email) ? ' checked' : '';
      return `<tr>` +
        `<td data-th="Elegir"><input type="checkbox" class="cliente-sel" value="${esc(c.email)}"${marcado} aria-label="Seleccionar ${esc(c.email)}"></td>` +
        `<td data-th="Nombre">${esc(c.nombre || '—')}</td>` +
        `<td data-th="Correo">${esc(c.email || '—')}</td>` +
        `<td data-th="Teléfono">${esc(c.telefono || '—')}</td>` +
        `<td data-th="Cédula">${esc(c.cedula || '—')}</td>` +
        `<td data-th="Dirección">${esc(c.direccion || '—')}</td>` +
        `<td data-th="Promos">${promos ? '<span class="badge badge--ok">Sí</span>' : '<span class="badge badge--off">No</span>'}</td>` +
        `<td data-th="Registrado">${fmtFecha(c.creado)}</td>` +
        `</tr>`;
    }).join('');
    wrap.innerHTML =
      `<table class="table"><thead><tr>` +
      `<th scope="col"><span class="sr-only">Elegir</span></th>` +
      `<th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Teléfono</th>` +
      `<th scope="col">Cédula</th><th scope="col">Dirección</th><th scope="col">Acepta promos</th><th scope="col">Registrado</th>` +
      `</tr></thead><tbody>${filas}</tbody></table>`;
    wrap.querySelectorAll('.cliente-sel').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) seleccionados.add(cb.value); else seleccionados.delete(cb.value);
      actualizarContadorPromo();
    }));
    actualizarContadorPromo();
  } catch {
    wrap.innerHTML = '<p class="msg err">Error de conexión al cargar los clientes.</p>';
  }
}

/* ----- Promociones ----- */
function actualizarContadorPromo() {
  const el = $('promoSelCount');
  if (!el) return;
  const n = seleccionados.size;
  el.textContent = n ? `${n} cliente${n > 1 ? 's' : ''} seleccionado${n > 1 ? 's' : ''}.` : 'Ningún cliente seleccionado todavía.';
}

$('promoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('promoMsg');
  const asunto = $('promoAsunto').value.trim();
  const mensaje = $('promoMensaje').value.trim();
  if (!mensaje) { mensaje_promo('Escribe el mensaje de la promoción.', 'err'); $('promoMensaje').focus(); return; }
  const dest = (document.querySelector('input[name="promoDest"]:checked') || {}).value;
  const body = { asunto, mensaje };
  if (dest === 'elegidos') {
    if (!seleccionados.size) { mensaje_promo('Selecciona al menos un cliente en la sección Clientes, o elige "Todos".', 'err'); return; }
    body.emails = Array.from(seleccionados);
  }
  const btn = $('enviarPromo'); cargando(btn, true); mensaje_promo('', '');
  try {
    const { status, data } = await pedir('/api/admin/promocion', { method: 'POST', body: JSON.stringify(body) });
    if (status === 401) { manejar401(); return; }
    if (data && data.ok) { mensaje_promo(`Promoción enviada a ${data.enviados} de ${data.total} destinatario(s).`, 'ok'); return; }
    // "SMTP no configurado" y similares: es un aviso esperado, no un fallo de la app.
    const err = (data && data.error) || 'No se pudo enviar la promoción.';
    mensaje_promo(err, /smtp/i.test(err) ? 'warn' : 'err');
  } catch {
    mensaje_promo('Error de conexión al enviar la promoción.', 'err');
  } finally { cargando(btn, false); }
});
function mensaje_promo(texto, tipo) {
  const el = $('promoMsg');
  el.textContent = texto; el.className = 'msg' + (tipo ? ' ' + tipo : '');
}

/* ----- Recargar manual ----- */
$('recargarReservas').addEventListener('click', cargarReservas);
$('recargarEstadisticas').addEventListener('click', cargarEstadisticas);
$('recargarClientes').addEventListener('click', cargarClientes);

/* =========================================================================
   Secciones nuevas: Correo, WhatsApp y Reseñas.
   ========================================================================= */

// Fecha + hora legible a partir de un ISO (bandeja de correo, reseñas).
function fmtFechaHora(f) {
  if (!f) return '—';
  const d = new Date(f);
  if (isNaN(d.getTime())) return esc(String(f));
  try {
    return d.toLocaleString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return esc(String(f)); }
}

// Estrellas (relleno según rating 0-5) para mostrar valoraciones.
function estrellas(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  let out = '<span class="stars" aria-hidden="true">';
  for (let i = 1; i <= 5; i++) out += `<span class="star${i <= n ? ' star--on' : ''}">★</span>`;
  out += '</span>';
  return out;
}

/* ----- Correo ----- */
async function cargarCorreo() {
  const msg = $('correoMsg');
  mensaje(msg, 'Cargando configuración…', '');
  try {
    const { status, data } = await pedir('/api/admin/correo');
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { mensaje(msg, (data && data.error) || 'No se pudo cargar la configuración.', 'err'); return; }
    llenarCorreo(data.config || {});
    mensaje(msg, '', '');
  } catch {
    mensaje(msg, 'Error de conexión al cargar la configuración.', 'err');
  }
}

function llenarCorreo(c) {
  const s = c.smtp || {}; const r = c.recibo || {};
  $('smtpHost').value = s.host || '';
  $('smtpPort').value = s.port != null ? s.port : '';
  $('smtpUser').value = s.user || '';
  $('smtpFrom').value = s.from || '';
  $('smtpPass').value = '';
  $('smtpPass').placeholder = s.tienePass ? 'Dejar en blanco para conservar la actual' : '••••••••';

  $('recProtocolo').value = r.protocolo === 'pop3' ? 'pop3' : 'imap';
  $('recHost').value = r.host || '';
  $('recPort').value = r.port != null ? r.port : '';
  $('recUser').value = r.user || '';
  $('recPass').value = '';
  $('recPass').placeholder = r.tienePass ? 'Dejar en blanco para conservar la actual' : '••••••••';
}

function cuerpoCorreo() {
  const body = {
    smtp: {
      host: $('smtpHost').value.trim(), port: Number($('smtpPort').value) || 587,
      user: $('smtpUser').value.trim(), from: $('smtpFrom').value.trim(),
    },
    recibo: {
      protocolo: $('recProtocolo').value, host: $('recHost').value.trim(),
      port: Number($('recPort').value) || 993, user: $('recUser').value.trim(),
    },
  };
  // La contraseña es opcional: solo se envía si el usuario escribió una.
  if ($('smtpPass').value) body.smtp.pass = $('smtpPass').value;
  if ($('recPass').value) body.recibo.pass = $('recPass').value;
  return body;
}

$('correoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('guardarCorreo'); const msg = $('correoMsg');
  cargando(btn, true); mensaje(msg, '', '');
  try {
    const { status, data } = await pedir('/api/admin/correo', { method: 'POST', body: JSON.stringify(cuerpoCorreo()) });
    if (status === 401) { manejar401(); return; }
    if (data && data.ok) { mensaje(msg, 'Configuración guardada.', 'ok'); llenarCorreo(data.config || {}); return; }
    mensaje(msg, (data && data.error) || 'No se pudo guardar la configuración.', 'err');
  } catch {
    mensaje(msg, 'Error de conexión al guardar.', 'err');
  } finally { cargando(btn, false); }
});

$('probarCorreo').addEventListener('click', async () => {
  const btn = $('probarCorreo'); const wrap = $('correoPruebaWrap');
  const txt = btn.textContent; btn.disabled = true; btn.textContent = 'Probando…';
  wrap.hidden = false; wrap.innerHTML = '<p class="msg">Probando conexión…</p>';
  try {
    const { status, data } = await pedir('/api/admin/correo/probar', { method: 'POST', body: '{}' });
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { wrap.innerHTML = `<p class="msg err">${esc((data && data.error) || 'No se pudo probar la conexión.')}</p>`; return; }
    wrap.innerHTML = lineaPrueba('SMTP (envío)', data.smtp) + lineaPrueba('IMAP (recepción)', data.imap);
  } catch {
    wrap.innerHTML = '<p class="msg err">Error de conexión al probar.</p>';
  } finally { btn.disabled = false; btn.textContent = txt; }
});

function lineaPrueba(nombre, r) {
  const ok = r && r.ok;
  const icono = ok ? '✓' : '✗';
  const detalle = ok ? 'Conexión correcta.' : esc((r && r.error) || 'Sin conexión.');
  return `<p class="prueba__linea ${ok ? 'prueba__linea--ok' : 'prueba__linea--err'}">` +
    `<span class="prueba__icono" aria-hidden="true">${icono}</span>` +
    `<strong>${esc(nombre)}:</strong> ${detalle}</p>`;
}

$('actualizarBandeja').addEventListener('click', cargarBandeja);

async function cargarBandeja() {
  const wrap = $('bandejaWrap');
  wrap.innerHTML = '<p class="msg">Cargando bandeja…</p>';
  // Aviso: la lectura POP3 aún no está implementada (solo IMAP).
  if ($('recProtocolo').value === 'pop3') {
    wrap.innerHTML = '<p class="msg warn">La lectura por POP3 aún no está implementada. Cambia el protocolo a IMAP para ver la bandeja.</p>';
    return;
  }
  try {
    const { status, data } = await pedir('/api/admin/correo/bandeja');
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { wrap.innerHTML = `<p class="msg warn">${esc((data && data.error) || 'No se pudo leer la bandeja.')}</p>`; return; }
    const m = data.mensajes || [];
    if (!m.length) { wrap.innerHTML = '<p class="msg">No hay correos en la bandeja.</p>'; return; }
    const filas = m.map((x) =>
      `<tr class="bandeja-row" data-seq="${x.seq != null ? x.seq : ''}" tabindex="0" role="button" title="Abrir correo">` +
      `<td data-th="De">${esc(x.de || x.correo || '—')}</td>` +
      `<td data-th="Asunto">${esc(x.asunto || '(sin asunto)')}</td>` +
      `<td data-th="Fecha">${fmtFechaHora(x.fecha)}</td></tr>`).join('');
    wrap.innerHTML =
      `<p class="hint">Haz clic en un correo para leer su contenido.</p>` +
      `<div class="tablewrap"><table class="table"><thead><tr>` +
      `<th scope="col">De</th><th scope="col">Asunto</th><th scope="col">Fecha</th>` +
      `</tr></thead><tbody>${filas}</tbody></table></div>`;
    wrap.querySelectorAll('.bandeja-row').forEach((tr) => {
      const abrir = () => { const s = tr.getAttribute('data-seq'); if (s) verMensaje(s); };
      tr.addEventListener('click', abrir);
      tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); } });
    });
  } catch {
    wrap.innerHTML = '<p class="msg err">Error de conexión al leer la bandeja.</p>';
  }
}

// Abre el contenido (cuerpo) de un correo de la bandeja.
async function verMensaje(seq) {
  const wrap = $('mensajeWrap');
  wrap.hidden = false;
  wrap.innerHTML = '<p class="msg">Abriendo correo…</p>';
  try {
    const { status, data } = await pedir('/api/admin/correo/mensaje?seq=' + encodeURIComponent(seq));
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { wrap.innerHTML = `<p class="msg warn">${esc((data && data.error) || 'No se pudo abrir el correo.')}</p>`; return; }
    const cuerpo = data.esHtml
      ? `<iframe sandbox="" srcdoc="${String(data.texto || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" style="width:100%;height:320px;border:1px solid var(--line);border-radius:8px;background:#fff"></iframe>`
      : `<pre style="white-space:pre-wrap;word-break:break-word;font:inherit;margin:0">${esc(data.texto || '(sin contenido)')}</pre>`;
    wrap.innerHTML =
      `<div class="card__head"><h3>${esc(data.asunto || '(sin asunto)')}</h3>` +
      `<button class="btn btn--ghost btn--sm" type="button" id="cerrarMensaje">Cerrar</button></div>` +
      `<p class="hint">De: ${esc(data.de || data.correo || '—')} · ${fmtFechaHora(data.fecha)}</p>` +
      cuerpo;
    $('cerrarMensaje').addEventListener('click', () => { wrap.hidden = true; wrap.innerHTML = ''; });
  } catch {
    wrap.innerHTML = '<p class="msg err">Error al abrir el correo.</p>';
  }
}

// Enviar un correo desde el panel.
$('enviarForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('btnEnviarCorreo'); const msg = $('enviarMsg');
  msg.textContent = ''; msg.className = 'msg';
  const to = $('envTo').value.trim();
  if (!to) { mensaje(msg, 'Indica el correo del destinatario.', 'err'); return; }
  cargando(btn, true);
  try {
    const { status, data } = await pedir('/api/admin/correo/enviar', {
      method: 'POST',
      body: JSON.stringify({ to, asunto: $('envAsunto').value.trim(), mensaje: $('envMensaje').value }),
    });
    if (status === 401) { manejar401(); return; }
    if (data && data.ok) { mensaje(msg, data.mensaje || 'Correo enviado.', 'ok'); $('enviarForm').reset(); }
    else { mensaje(msg, (data && data.error) || 'No se pudo enviar.', 'err'); }
  } catch {
    mensaje(msg, 'Error de conexión al enviar.', 'err');
  } finally { cargando(btn, false); }
});

/* ----- WhatsApp (PREPARADO) ----- */
async function cargarWhatsapp() {
  const el = $('waCount');
  try {
    const { status, data } = await pedir('/api/admin/whatsapp/destinatarios');
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { el.textContent = 'No se pudieron cargar los destinatarios.'; return; }
    const n = (data.destinatarios || []).length;
    el.textContent = n
      ? `${n} destinatario${n > 1 ? 's' : ''} con teléfono y consentimiento.`
      : 'No hay destinatarios con teléfono y consentimiento todavía.';
  } catch {
    el.textContent = 'Error de conexión al cargar los destinatarios.';
  }
}

$('waForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('prepararWa'); const msg = $('waMsg'); const aviso = $('waAvisoWrap');
  const mensajeTxt = $('waMensaje').value.trim();
  if (!mensajeTxt) { mensaje(msg, 'Escribe el mensaje de la promoción.', 'err'); $('waMensaje').focus(); return; }
  cargando(btn, true); mensaje(msg, '', ''); aviso.hidden = true;
  try {
    const { status, data } = await pedir('/api/admin/whatsapp/promocion', { method: 'POST', body: JSON.stringify({ mensaje: mensajeTxt }) });
    if (status === 401) { manejar401(); return; }
    if (data && data.ok) {
      mensaje(msg, `Promoción preparada para ${data.total} destinatario(s).`, 'ok');
      aviso.hidden = false;
      aviso.innerHTML = `<p class="msg warn">${esc(data.aviso || 'El envío real se activará al conectar un proveedor de WhatsApp.')}</p>`;
      return;
    }
    mensaje(msg, (data && data.error) || 'No se pudo preparar la promoción.', 'err');
  } catch {
    mensaje(msg, 'Error de conexión al preparar la promoción.', 'err');
  } finally { cargando(btn, false); }
});

/* ----- Reseñas ----- */
let filtroResenas = '';

async function cargarResenas() {
  cargarResenasStats();
  cargarResenasLista();
}

async function cargarResenasStats() {
  const wrap = $('resenasStatsWrap');
  wrap.innerHTML = '<p class="msg">Cargando…</p>';
  try {
    const { status, data } = await pedir('/api/admin/resenas/estadisticas');
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { wrap.innerHTML = `<p class="msg err">${esc((data && data.error) || 'No se pudieron cargar las estadísticas.')}</p>`; return; }
    const s = data.estadisticas || {};
    const prom = Number(s.promedio) || 0;
    const tiles =
      `<div class="kpis">` +
      kpi('Total', s.total || 0) +
      `<div class="kpi"><span class="kpi__val">${esc(prom.toFixed(2))} ${estrellas(prom)}</span><span class="kpi__lbl">Promedio</span></div>` +
      kpi('Positivas', s.positivas || 0) +
      kpi('Neutras', s.neutras || 0) +
      kpi('Negativas', s.negativas || 0) +
      `</div>`;
    const dist = s.distribucion || {};
    const max = Math.max(1, ...[1, 2, 3, 4, 5].map((k) => Number(dist[k]) || 0));
    const barras = [5, 4, 3, 2, 1].map((k) => {
      const n = Number(dist[k]) || 0;
      const pct = Math.round((n / max) * 100);
      return `<li class="distrow"><span class="distrow__lbl">${k}★</span>` +
        `<span class="distrow__bar"><span class="distrow__fill" style="width:${pct}%"></span></span>` +
        `<span class="distrow__n">${n}</span></li>`;
    }).join('');
    wrap.innerHTML = tiles + `<h3 class="kpis__sub">Distribución</h3><ul class="distlist">${barras}</ul>`;
  } catch {
    wrap.innerHTML = '<p class="msg err">Error de conexión al cargar las estadísticas.</p>';
  }
}

async function cargarResenasLista() {
  const wrap = $('resenasListaWrap');
  wrap.innerHTML = '<p class="msg">Cargando…</p>';
  try {
    const q = filtroResenas ? `?filtro=${encodeURIComponent(filtroResenas)}` : '';
    const { status, data } = await pedir(`/api/admin/resenas${q}`);
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { wrap.innerHTML = `<p class="msg err">${esc((data && data.error) || 'No se pudieron cargar las reseñas.')}</p>`; return; }
    const r = data.resenas || [];
    if (!r.length) { wrap.innerHTML = '<p class="msg">No hay reseñas para este filtro.</p>'; return; }
    wrap.innerHTML = `<ul class="resenas">${r.map(filaResena).join('')}</ul>`;
    wrap.querySelectorAll('.resena__toggle input').forEach((cb) => cb.addEventListener('change', () => moderarResena(cb)));
  } catch {
    wrap.innerHTML = '<p class="msg err">Error de conexión al cargar las reseñas.</p>';
  }
}

function tonoResena(rating) {
  const n = Number(rating) || 0;
  if (n >= 4) return 'resena--pos';
  if (n <= 2) return 'resena--neg';
  return 'resena--neu';
}

function filaResena(x) {
  const id = Number(x.id);
  const aprobada = Number(x.aprobada) === 1;
  return `<li class="resena ${tonoResena(x.rating)}">` +
    `<div class="resena__top">` +
      `<span class="resena__nombre">${esc(x.nombre || 'Huésped')}</span>` +
      `<span class="resena__rating">${estrellas(x.rating)}<span class="resena__num">${esc(String(x.rating))}/5</span></span>` +
    `</div>` +
    `<p class="resena__coment">${esc(x.comentario || '')}</p>` +
    `<div class="resena__pie">` +
      `<span class="resena__fecha">${fmtFechaHora(x.creado)}</span>` +
      `<label class="switch resena__toggle"><input type="checkbox" data-id="${id}"${aprobada ? ' checked' : ''}>` +
      `<span class="switch__track" aria-hidden="true"></span><span class="switch__label">Aprobada</span></label>` +
    `</div></li>`;
}

async function moderarResena(cb) {
  const id = Number(cb.dataset.id);
  const aprobada = cb.checked;
  cb.disabled = true;
  try {
    const { status, data } = await pedir('/api/admin/resenas/moderar', { method: 'POST', body: JSON.stringify({ id, aprobada }) });
    if (status === 401) { manejar401(); return; }
    if (!data || !data.ok) { cb.checked = !aprobada; }
    else { cargarResenasStats(); }
  } catch {
    cb.checked = !aprobada;
  } finally { cb.disabled = false; }
}

$('recargarResenas').addEventListener('click', cargarResenas);
$('resenasFiltros').addEventListener('click', (e) => {
  const btn = e.target.closest('.resfiltro');
  if (!btn) return;
  filtroResenas = btn.dataset.filtro || '';
  document.querySelectorAll('.resfiltro').forEach((b) => b.classList.toggle('is-active', b === btn));
  cargarResenasLista();
});

/* ----- Arranque: ¿ya es admin? ----- */
(async function init() {
  try {
    const { data } = await pedir('/api/admin/estado');
    if (data && data.ok && data.admin) mostrarPanel();
    else mostrarLogin();
  } catch { mostrarLogin(); }
})();
