/* ============================================================================
   RentaMaq · Arranque y eventos globales
   ----------------------------------------------------------------------------
   Conecta las acciones de la interfaz (delegación de eventos), inicia la base
   local y decide si se muestra el acceso o la aplicación.
   ========================================================================== */

'use strict';

function handleGlobalClick(event) {
  const element = event.target.closest('button,a');
  if (!element) return;
  const data = element.dataset;
  if (!Object.keys(data).length) return;

  if ('close' in data) closeModal();

  if (data.route) {
    navigate(data.route);
    return;
  }

  if (data.detail) {
    detail(data.detail);
    return;
  }

  if (data.favorite) {
    const added = toggleFavorite(data.favorite);
    toast(added ? 'Equipo guardado en favoritos.' : 'Equipo retirado de favoritos.');
    if (route === 'favoritos') favorites();
    else if (route === 'catalogo') results();
    else updateShell();
    return;
  }

  if (data.category) {
    filters.category = data.category;
    catalog();
    return;
  }

  if ('resetFilters' in data) {
    filters = defaultFilters();
    if (route === 'catalogo' || route === 'favoritos') catalog();
    else render();
    return;
  }

  if ('clearCompare' in data) {
    compare = [];
    render();
    return;
  }

  if ('openCompare' in data) {
    compareView();
    return;
  }

  if ('publish' in data) {
    publish();
    return;
  }

  if (data.edit) {
    publish(data.edit);
    return;
  }

  if (data.toggle) {
    toggleEquipment(data.toggle);
    return;
  }

  if (data.deleteEquipment) {
    deleteEquipment(data.deleteEquipment);
    return;
  }

  if (data.booking) {
    bookingDetail(data.booking);
    return;
  }

  if (data.bookFilter) {
    bookingFilter = data.bookFilter;
    bookings();
    return;
  }

  if (data.transition) {
    transition(data.transition, data.status);
    return;
  }

  if (data.cancel) {
    cancelBooking(data.cancel);
    return;
  }

  if (data.pay) {
    payBooking(data.pay);
    return;
  }

  if ('print' in data) {
    window.print();
    return;
  }

  if (data.contactProvider) {
    contactProvider(data.contactProvider, data.equipmentId);
    return;
  }

  if (data.contactUser) {
    contactUser(data.contactUser);
    return;
  }

  if (data.thread) {
    threadId = data.thread;
    messages();
    return;
  }

  if ('ticket' in data) {
    ticketModal();
    return;
  }

  if (data.resolve) {
    resolveTicket(data.resolve);
    return;
  }

  if (data.review) {
    reviewBooking(data.review);
    return;
  }

  if ('export' in data) {
    exportCSV();
    return;
  }

  if ('backup' in data) {
    downloadBackup();
    return;
  }

  if ('resetDemo' in data) {
    resetApplication();
    return;
  }

  if ('logout' in data) {
    signOut();
    return;
  }

  if ('becomeProvider' in data) {
    becomeProviderModal();
    return;
  }

  if ('verifyProvider' in data) {
    verifyProviderModal();
  }
}

function boot() {
  loadDB();
  loadSession();
  bindShellEvents();

  const initialHash = location.hash.replace('#', '');
  if (!currentUser()) {
    if (initialHash === 'registro') authMode = 'register';
    else if (initialHash === 'recuperar') authMode = 'recover';
  }

  render();

  document.addEventListener('click', handleGlobalClick);

  document.addEventListener('change', (event) => {
    const id = event.target.dataset.compare;
    if (!id) return;
    if (event.target.checked) {
      if (compare.length >= 3) {
        event.target.checked = false;
        toast('Puedes comparar hasta tres equipos.');
        return;
      }
      compare.push(id);
    } else {
      compare = compare.filter((entry) => entry !== id);
    }
    updateCompare();
  });

  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY) {
      loadDB();
      render();
    }
    if (event.key === SESSION_KEY) {
      loadSession();
      render();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
