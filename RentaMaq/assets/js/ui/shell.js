/* ============================================================================
   RentaMaq · Estructura de la aplicación
   ----------------------------------------------------------------------------
   Navegación lateral, cabecera, rutas internas y componentes compartidos por
   todas las vistas. La aplicación usa rutas de hash (#catalogo).
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
  planes: 'Planes y precios',
  equipos: 'Mis equipos',
  soporte: 'Soporte y ayuda',
  perfil: 'Mi cuenta',
  acerca: 'Acerca de RentaMaq'
};

const routePages = () => ({
  catalogo: catalog,
  favoritos: favorites,
  reservas: bookings,
  mensajes: messages,
  panel: dashboard,
  planes: plans,
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
  const pending = ['Solicitada', 'Cotización', 'En revisión', 'Pendiente', 'Registrada'].includes(status);
  const cancelled = ['Cancelada', 'Rechazada', 'Pausado'].includes(status);
  return `<span class="status-pill ${pending ? 'pending' : cancelled ? 'cancelled' : ''}">${esc(status)}</span>`;
}

const roleBadge = (role) => role === 'proveedor'
  ? '<span class="badge badge-provider">Proveedor</span>'
  : '<span class="badge badge-client">Contratista</span>';

function verificationBadge(verified) {
  return verified
    ? '<span class="badge badge-verified">✓ Datos comerciales confirmados</span>'
    : '<span class="badge badge-pending">Datos por confirmar</span>';
}

const verifiedLine = (verified) => verified
  ? '<span class="verified" title="Datos comerciales revisados por RentaMaq">✓ Datos confirmados</span>'
  : '<span class="muted" title="El proveedor aún no completa la revisión de datos comerciales">· Datos por confirmar</span>';

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
  window.scrollTo(0, 0);
}

function enterApplication(options = {}) {
  const user = currentUser();
  if (!user) {
    showAuthScreen();
    return;
  }

  document.body.classList.remove('is-auth');
  resetTransientState();

  const cleanHash = location.hash.replace(/^#/, '');
  if (!Object.prototype.hasOwnProperty.call(ROUTE_TITLES, cleanHash)) {
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}#catalogo`);
    } catch {
      location.hash = 'catalogo';
    }
  }

  render();
  window.scrollTo(0, 0);

  if (options.welcome) {
    toast(`${options.confirmed ? 'Correo confirmado. ' : ''}Bienvenido, ${user.name.split(' ')[0]}.`);
  } else if (options.confirmed) {
    toast('Correo confirmado. Tu cuenta está activa.');
  }
}

async function signOut(options = {}) {
  await logoutAccount(options.scope || 'local');
  closeModal();
  resetTransientState();
  authMode = 'login';
  authFlash = options.message || 'Cerraste sesión correctamente.';
  document.body.classList.add('is-auth');
  if (location.hash) {
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
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
    ['panel', 'Resumen de actividad'],
    ['planes', 'Planes y precios']
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
  try {
    pages[route]();
  } catch (error) {
    console.error('RentaMaq · vista', error);
    main.innerHTML = heading('No pudimos mostrar esta sección', friendlyError(error))
      + `<div class="panel"><p class="muted">Actualiza la página o vuelve al catálogo.</p><button class="primary" data-route="catalogo">Ir al catálogo</button></div>`;
  }
  updateCompare();
}

/**
 * Re-renderiza sin interrumpir una búsqueda o un mensaje que la persona está
 * escribiendo. Se usa después de las actualizaciones en tiempo real.
 */
function softRender() {
  if (!currentUser()) return;
  const dialog = $('#modal');
  if (dialog?.open) {
    updateShell();
    return;
  }

  const active = document.activeElement;
  const editingInMain = active
    && active.closest?.('#main')
    && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
  const draft = route === 'mensajes' ? $('#chatForm input')?.value || '' : '';

  if (editingInMain && route !== 'mensajes') {
    updateShell();
    return;
  }

  render();
  if (route === 'mensajes' && draft) {
    const input = $('#chatForm input');
    if (input) {
      input.value = draft;
      input.focus();
      input.setSelectionRange(draft.length, draft.length);
    }
  }
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
    if (!currentUser()) return;
    render();
    window.scrollTo(0, 0);
  });
}
