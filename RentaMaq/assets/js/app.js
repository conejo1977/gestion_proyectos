/* ============================================================================
   RentaMaq · Arranque y eventos globales
   ----------------------------------------------------------------------------
   Restaura la sesión de Supabase, carga los datos de la cuenta, conecta las
   acciones de la interfaz y mantiene la aplicación sincronizada.
   ========================================================================== */

'use strict';

function hideBoot() {
  const boot = $('#bootScreen');
  if (boot) boot.hidden = true;
  document.body.classList.remove('is-booting');
}

function showBootError(message) {
  const boot = $('#bootScreen');
  if (!boot) return;
  boot.hidden = false;
  boot.classList.add('boot-error');
  document.body.classList.add('is-booting');
  const label = $('#bootMessage');
  if (label) label.textContent = message;
  const actions = $('#bootActions');
  if (actions) actions.hidden = false;
}

async function handleAuthRecovery() {
  closeModal();
  document.body.classList.add('is-auth');
  showAuthScreen('reset', 'Enlace verificado. Elige una contraseña nueva para tu cuenta.');
}

async function handleExternalSignOut() {
  closeModal();
  resetTransientState();
  authMode = 'login';
  authFlash = 'Tu sesión se cerró. Ingresa de nuevo para continuar.';
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

function handleGlobalClick(event) {
  const element = event.target.closest('button,a');
  if (!element) return;
  const data = element.dataset;
  if (!Object.keys(data).length) return;

  if ('close' in data) closeModal();

  if ('bootRetry' in data) {
    location.reload();
    return;
  }

  if (data.route) {
    navigate(data.route);
    return;
  }

  if (data.detail) {
    detail(data.detail);
    return;
  }

  if (data.favorite) {
    withBusy(element, '', async () => {
      const result = await toggleFavoriteRecord(data.favorite);
      if (!result.ok) {
        toast(result.error);
        return;
      }
      toast(result.added ? 'Equipo guardado en favoritos.' : 'Equipo retirado de favoritos.');
      softRender();
    });
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
    toggleEquipment(data.toggle, element);
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
    transition(data.transition, data.status, element);
    return;
  }

  if (data.cancel) {
    cancelBooking(data.cancel, element);
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
    contactUser(data.contactUser, element);
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
    resolveTicket(data.resolve, element);
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

  if ('deleteAccount' in data) {
    deleteAccountModal();
    return;
  }

  if ('logoutAll' in data) {
    signOut({ scope: 'global', message: 'Cerraste sesión en todos los dispositivos.' });
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

function bindGlobalEvents() {
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
}

async function boot() {
  bindShellEvents();
  bindGlobalEvents();
  bindCloudRefreshEvents();

  const initialHash = location.hash.replace('#', '');
  let initialMode = 'login';
  if (initialHash === 'registro') initialMode = 'register';
  else if (initialHash === 'recuperar') initialMode = 'recover';

  if (!sb) {
    showBootError('No se pudo cargar la conexión segura. Revisa tu conexión a Internet y vuelve a abrir la página.');
    return;
  }

  try {
    const restored = await restoreSession();

    if (restored.recovery) {
      hideBoot();
      watchAuthEvents({
        onRecovery: handleAuthRecovery,
        onSignOut: handleExternalSignOut
      });
      if (restored.session?.user) {
        authUser = restored.session.user;
        await handleAuthRecovery();
      } else {
        showAuthScreen('login', 'El enlace de recuperación venció. Solicita uno nuevo desde “¿Olvidaste tu contraseña?”.');
      }
      return;
    }

    if (restored.session?.user) {
      try {
        await startUserSession(restored.session, { confirmed: RM_AUTH_LINK_TYPE === 'signup' });
        hideBoot();
      } catch (error) {
        console.error('RentaMaq · carga inicial', error);
        showBootError(friendlyError(error));
        return;
      }
    } else {
      hideBoot();
      showAuthScreen(initialMode, '');
    }

    watchAuthEvents({
      onRecovery: handleAuthRecovery,
      onSignOut: handleExternalSignOut
    });
  } catch (error) {
    console.error('RentaMaq · arranque', error);
    showBootError(friendlyError(error));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
