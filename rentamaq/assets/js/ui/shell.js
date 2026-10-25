/* ============================================================================
   RentaMaq · Estructura de la aplicación
   ----------------------------------------------------------------------------
   Navegación lateral, cabecera, rutas internas y componentes compartidos por
   todas las vistas. La aplicación funciona con rutas de hash (#catalogo).
   ========================================================================== */

'use strict';

let route = '';
let compare = [];
let threadId = null;
let bookingFilter = 'Todas';
let authMode = 'login';
let authFlash = '';

const defaultFilters = () => ({
  q: '',
  city: '',
  start: '',
  category: 'Todos',
  max: 2000,
  available: false,
  verified: false,
  operator: false,
  sort: 'recomendado'
});

let filters = defaultFilters();

const ROUTE_TITLES = {
  catalogo: 'Explorar equipos',
  favoritos: 'Mis favoritos',
  reservas: 'Alquileres',
  mensajes: 'Mensajes',
  panel: 'Resumen de actividad',
  equipos: 'Mis equipos',
  soporte: 'Soporte y ayuda',
  perfil: 'Mi cuenta',
  acerca: 'Acerca del prototipo'
};

const routePages = () => ({
  catalogo: catalog,
  favoritos: favorites,
  reservas: bookings,
  mensajes: messages,
  panel: dashboard,
  equipos: inventory,
  soporte: support,
  perfil: profile,
  acerca: about
});

/* --------------------------- Piezas de interfaz -------------------------- */

function heading(title, subtitle, action = '') {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}

function emptyView({ title, desc, label = 'Explorar equipos', route: target = 'catalogo', attrs = '', iconName = 'equipos', compact = false }) {
  return `<div class="empty ${compact ? 'compact' : ''}"><div class="empty-icon">${icon(iconName)}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p><button class="primary" ${attrs || `data-route="${target}"`}>${esc(label)}</button></div>`;
}

function pill(status) {
  const pending = ['Solicitada', 'Cotización', 'En revisión', 'Pendiente'].includes(status);
  const cancelled = ['Cancelada', 'Rechazada', 'Pausado'].includes(status);
  return `<span class="status-pill ${pending ? 'pending' : cancelled ? 'cancelled' : ''}">${esc(status)}</span>`;
}

const roleBadge = (role) => role === 'proveedor'
  ? '<span class="badge badge-provider">Proveedor</span>'
  : '<span class="badge badge-client">Contratista</span>';

function verificationBadge(verified) {
  return verified
    ? '<span class="badge badge-verified">✓ Proveedor verificado</span>'
    : '<span class="badge badge-pending">Verificación en revisión</span>';
}

const verifiedLine = (verified) => verified
  ? '<span class="verified" title="Verificación simulada de la cuenta">✓ Proveedor verificado</span>'
  : '<span class="muted" title="Verificación simulada pendiente">· Verificación en revisión</span>';

const stars = (rating) => rating ? `★ ${rating}` : 'Sin reseñas';

/* ------------------------------- Sesión ---------------------------------- */

function resetTransientState() {
  compare = [];
  threadId = null;
  bookingFilter = 'Todas';
  filters = defaultFilters();
}

function showAuthScreen(mode = authMode, message = authFlash) {
  authMode = mode;
  authFlash = message;
  document.body.classList.add('is-auth');
  renderAuthScreen(mode, message);
}

function enterApplication() {
  const user = currentUser();
  if (!user) {
    showAuthScreen();
    return;
  }
  document.body.classList.remove('is-auth');
  resetTransientState();
  const cleanHash = !location.hash || ['#', '#login', '#registro', '#recuperar'].includes(location.hash);
  if (cleanHash) {
    if (location.hash === '#catalogo') render();
    else location.hash = '#catalogo';
  } else {
    render();
  }
  window.scrollTo(0, 0);
  toast(`Bienvenido, ${user.name.split(' ')[0]}.`);
}

function signOut() {
  logoutAccount();
  closeModal();
  resetTransientState();
  authMode = 'login';
  authFlash = 'Cerraste sesión correctamente.';
  document.body.classList.add('is-auth');
  if (location.hash) {
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      location.hash = '';
    }
  }
  renderAuthScreen('login', authFlash);
  window.scrollTo(0, 0);
}

/* ------------------------------ Navegación ------------------------------- */

function navItems(user = currentUser()) {
  if (!user) return [];
  const items = [
    ['catalogo', 'Explorar equipos'],
    ['favoritos', 'Mis favoritos'],
    ['reservas', isProvider(user) ? 'Solicitudes de alquiler' : 'Mis alquileres'],
    ['mensajes', 'Mensajes'],
    ['panel', 'Resumen de actividad']
  ];
  if (isProvider(user)) items.push(['equipos', 'Mis equipos']);
  items.push(['soporte', 'Soporte y ayuda']);
  return items;
}

function updateShell() {
  const user = currentUser();
  if (!user) return;

  const items = navItems(user);
  const count = pendingRequestsCount(user);
  $('#nav').innerHTML = items.map(([key, label]) => `
    <a href="#${key}" class="${route === key ? 'active' : ''}" ${route === key ? 'aria-current="page"' : ''}>
      ${icon(key)}${label}
      ${key === 'reservas' && count ? `<span class="nav-count">${count}</span>` : ''}
    </a>`).join('');

  $('#breadcrumb').textContent = ROUTE_TITLES[route] || 'Mi cuenta';
  document.title = `${ROUTE_TITLES[route] || 'Mi cuenta'} | RentaMaq`;

  const name = displayName(user);
  $('#sideUser').innerHTML = `
    <span class="avatar ${isProvider(user) ? 'provider' : ''}">${esc(initials(name))}</span>
    <span class="side-user-info">
      <strong>${esc(name)}</strong>
      <small>${roleBadge(user.role)}</small>
    </span>
    <button class="logout-mini" data-logout title="Cerrar sesión" aria-label="Cerrar sesión">${icon('salir')}</button>`;

  $('#headerAvatar').textContent = initials(user.name);
  $('#headerRole').innerHTML = roleBadge(user.role);
  $('#headerPublish').hidden = !isProvider(user);
}

function navigate(target) {
  $('#sidebar').classList.remove('open');
  if (location.hash === `#${target}`) {
    render();
    window.scrollTo(0, 0);
  } else location.hash = target;
}

function render() {
  const user = currentUser();
  if (!user) {
    showAuthScreen();
    return;
  }

  document.body.classList.remove('is-auth');
  const hashRoute = location.hash.replace(/^#/, '') || 'catalogo';
  const pages = routePages();
  route = pages[hashRoute] ? hashRoute : 'catalogo';

  compare = compare.filter((id) => Boolean(equipmentById(id)));
  updateShell();

  const main = $('#main');
  main.innerHTML = '';
  pages[route]();
  updateCompare();
}

function updateCompare() {
  const bar = $('#compareBar');
  if (!bar) return;
  const user = currentUser();
  bar.hidden = !user || !compare.length;
  if (bar.hidden) {
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = `
    <span><strong>${compare.length} de 3</strong> equipos seleccionados</span>
    <div class="inline-actions">
      <button data-clear-compare>Limpiar</button>
      <button class="primary" data-open-compare ${compare.length < 2 ? 'disabled' : ''}>Comparar equipos</button>
    </div>`;
}

/* ------------------------------- Eventos --------------------------------- */

function bindShellEvents() {
  const dialog = $('#modal');
  $('#closeModal').onclick = closeModal;
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      dialog.close();
    }
  });

  $('#menu').onclick = () => $('#sidebar').classList.toggle('open');
  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });
}
