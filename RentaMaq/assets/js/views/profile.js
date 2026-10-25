/* ============================================================================
   RentaMaq · Mi cuenta
   ----------------------------------------------------------------------------
   Datos personales, seguridad, identificación como proveedor, confirmación de
   datos comerciales, respaldo y eliminación de la cuenta.
   ========================================================================== */

'use strict';

function profile() {
  const user = currentUser();
  if (!user) return;
  const provider = isProvider(user);
  const created = new Date(user.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
  const name = displayName(user);

  $('#main').innerHTML = heading('Mi cuenta', 'Administra tus datos, tu seguridad y la forma en que participas en RentaMaq.') + `
    <section class="panel">
      <div class="account-head">
        <span class="avatar lg ${provider ? 'provider' : ''}">${esc(initials(name))}</span>
        <div>
          <h2>${esc(name)}</h2>
          <p>${esc(user.name)}${user.city ? ` · ${esc(user.city)}` : ''} · Miembro desde ${created}</p>
          <div class="badges">${roleBadge(user.role)}${provider ? verificationBadge(user.verified) : ''}</div>
        </div>
      </div>
      <div class="info-strip"><b>Identidad:</b> ${provider
        ? 'Tu cuenta está identificada como proveedor. Puedes publicar equipos y recibir solicitudes de alquiler.'
        : 'Tu cuenta está identificada como contratista. Puedes buscar, comparar y solicitar equipos.'}</div>
      <form id="profileForm">
        <div class="form-grid">
          <div class="field">
            <label for="pf_name">Nombre completo</label>
            <input id="pf_name" name="name" maxlength="90" value="${esc(user.name)}" required>
          </div>
          <div class="field">
            <label for="pf_email">Correo electrónico</label>
            <input id="pf_email" name="email" type="email" maxlength="120" value="${esc(user.email)}" required>
            <small>Si lo cambias, deberás confirmar la nueva dirección desde tu correo.</small>
          </div>
          <div class="field">
            <label for="pf_phone">Teléfono</label>
            <input id="pf_phone" name="phone" maxlength="30" value="${esc(user.phone)}" placeholder="999 999 999">
          </div>
          <div class="field">
            <label for="pf_city">Ciudad</label>
            <input id="pf_city" name="city" maxlength="80" value="${esc(user.city)}">
          </div>
          <div class="field ${provider ? 'full' : ''}">
            <label for="pf_company">${provider ? 'Nombre comercial o razón social' : 'Empresa (opcional)'}</label>
            <input id="pf_company" name="company" maxlength="110" value="${esc(user.company)}">
          </div>
        </div>
        <div class="form-actions"><button class="primary">Guardar datos</button></div>
      </form>
    </section>

    <div class="two-col">
      <section class="panel">
        <h3>Seguridad de la cuenta</h3>
        <p class="muted" style="font-size:13px">Tu acceso está protegido por Supabase Auth. Cambia la contraseña cuando lo necesites; la sesión se mantiene en los dispositivos donde ya iniciaste sesión.</p>
        <form id="passwordForm">
          <div class="form-grid">
            <div class="field full">
              <label for="pw_current">Contraseña actual</label>
              <input id="pw_current" name="current" type="password" autocomplete="current-password" required>
            </div>
            <div class="field">
              <label for="pw_new">Nueva contraseña</label>
              <input id="pw_new" name="next" type="password" minlength="8" autocomplete="new-password" required>
            </div>
            <div class="field">
              <label for="pw_confirm">Repite la nueva contraseña</label>
              <input id="pw_confirm" name="confirm" type="password" autocomplete="new-password" required>
            </div>
          </div>
          <div class="form-actions"><button class="primary">Cambiar contraseña</button></div>
        </form>
      </section>

      <section class="panel">
        <h3>${provider ? 'Datos comerciales' : '¿Tienes equipos para alquilar?'}</h3>
        ${provider ? `
          <p class="muted" style="font-size:14px">${user.verified
            ? 'Tus datos comerciales están confirmados. Tus anuncios muestran el sello de confianza.'
            : 'Completa la revisión básica de nombre comercial, RUC y teléfono para mostrar el sello de confianza en tus anuncios.'}</p>
          <div class="kv-list">
            <div><small>Estado</small><b>${user.verified ? 'Datos confirmados' : 'Por confirmar'}</b></div>
            <div><small>RUC</small><b>${esc(user.ruc || 'No registrado')}</b></div>
            <div><small>Nombre comercial</small><b>${esc(user.company || 'No registrado')}</b></div>
            <div><small>Confirmado desde</small><b>${user.verifiedAt ? new Date(user.verifiedAt).toLocaleDateString('es-PE') : 'Pendiente'}</b></div>
          </div>
          <div class="inline-actions" style="margin-top:16px">
            ${!user.verified ? '<button class="primary" data-verify-provider>Confirmar datos comerciales</button>' : ''}
            <button data-route="equipos">Gestionar mis equipos</button>
          </div>
          <p class="muted" style="font-size:12px;margin-top:12px">La confirmación acredita la revisión básica de contacto y RUC. No reemplaza una inspección técnica del equipo.</p>`
          : `
          <p class="muted" style="font-size:14px">Convierte tu cuenta en proveedor para publicar maquinaria, subir fotografías y recibir solicitudes de alquiler. Conservarás tus favoritos y tu historial como contratista.</p>
          <div class="steps" style="grid-template-columns:1fr 1fr">
            <div class="step"><b>01</b><strong>Identifícate</strong><p>Nombre comercial y RUC.</p></div>
            <div class="step"><b>02</b><strong>Publica</strong><p>Fotos y tarifas de tus equipos.</p></div>
          </div>
          <button class="primary" data-become-provider>Convertirme en proveedor</button>`}
      </section>
    </div>

    <section class="panel">
      <h3>Datos y respaldo</h3>
      <p class="muted" style="font-size:14px">Tu cuenta se sincroniza en la nube. Puedes descargar una copia de la información visible para tu perfil o exportar el historial de alquileres para tu contabilidad.</p>
      <div class="inline-actions">
        <button data-backup>Descargar respaldo JSON</button>
        <button data-export>Exportar alquileres CSV</button>
        <button data-logout>Cerrar sesión</button>
        <button data-logout-all>Cerrar sesión en todos los dispositivos</button>
      </div>
      <p class="muted" style="font-size:12px;margin-top:13px">El respaldo incluye los datos y operaciones que puedes ver. No contiene contraseñas ni claves de acceso.</p>
    </section>

    <section class="panel danger-zone">
      <h3>Privacidad y eliminación</h3>
      <p class="muted" style="font-size:13px">Puedes eliminar tu cuenta de forma permanente. Se borrarán tu perfil, tus publicaciones, tus fotografías y tus conversaciones. Los alquileres compartidos conservan el historial para la otra parte.</p>
      <button class="danger-btn" data-delete-account>Eliminar mi cuenta</button>
    </section>`;

  $('#profileForm').onsubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    withBusy(form.querySelector('[type="submit"]'), 'Guardando…', async () => {
      const result = await updateAccount(Object.fromEntries(new FormData(form)));
      if (!result.ok) {
        toast(result.error);
        return;
      }
      updateShell();
      profile();
      toast(result.emailMessage || 'Datos de la cuenta actualizados.');
    });
  };

  $('#passwordForm').onsubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    withBusy(form.querySelector('[type="submit"]'), 'Actualizando…', async () => {
      const result = await changePassword(data.current, data.next, data.confirm);
      if (!result.ok) {
        toast(result.error);
        return;
      }
      form.reset();
      toast('Contraseña actualizada correctamente.');
    });
  };
}

function becomeProviderModal() {
  const user = currentUser();
  if (!user) return;
  if (isProvider(user)) {
    verifyProviderModal();
    return;
  }

  modal('Convertirme en proveedor', `
    <p class="muted">Identifícate como proveedor para publicar equipos. Tus datos de contratista se conservan.</p>
    <form id="becomeProviderForm">
      <div class="form-grid">
        <div class="field full">
          <label for="bp_company">Nombre comercial o razón social</label>
          <input id="bp_company" name="company" maxlength="110" value="${esc(user.company)}" required>
        </div>
        <div class="field">
          <label for="bp_ruc">RUC</label>
          <input id="bp_ruc" name="ruc" inputmode="numeric" maxlength="11" placeholder="11 dígitos" required>
        </div>
        <div class="field">
          <label for="bp_phone">Teléfono de contacto</label>
          <input id="bp_phone" name="phone" maxlength="30" value="${esc(user.phone)}" required>
        </div>
        <label class="check-line full">
          <input type="checkbox" name="terms">
          Declaro que la información es correcta y acepto las condiciones de uso de RentaMaq.
        </label>
      </div>
      <p class="error-text" id="providerError"></p>
      <div class="form-actions"><button type="button" data-close>Cancelar</button><button class="primary">Convertirme en proveedor</button></div>
    </form>`);

  $('#becomeProviderForm').onsubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    data.terms = form.querySelector('[name="terms"]').checked;
    withBusy(form.querySelector('[type="submit"]'), 'Guardando…', async () => {
      const result = await becomeProvider(data);
      if (!result.ok) {
        $('#providerError').textContent = result.error;
        return;
      }
      updateShell();
      closeModal();
      navigate('perfil');
      modal('Ahora eres proveedor', `
        <div class="center">
          <div class="success-icon">✓</div>
          <h2>Tu cuenta ya puede publicar equipos</h2>
          <p class="muted">Tu perfil mostrará el distintivo de proveedor. Puedes confirmar tus datos comerciales para activar el sello de confianza.</p>
        </div>
        <div class="form-actions">
          <button data-route="perfil" data-close>Ver mi cuenta</button>
          <button class="primary" data-publish data-close>Publicar mi primer equipo</button>
        </div>`);
    });
  };
}

function verifyProviderModal() {
  const user = currentUser();
  if (!user) return;
  if (!isProvider(user)) {
    becomeProviderModal();
    return;
  }

  modal('Confirmar datos comerciales', `
    <p class="muted">Revisa el nombre comercial, el RUC y el teléfono de contacto. Al confirmarlos, tus anuncios mostrarán el sello de datos comerciales confirmados.</p>
    <form id="verifyProviderForm">
      <div class="form-grid">
        <div class="field full">
          <label for="vp_company">Nombre comercial o razón social</label>
          <input id="vp_company" name="company" maxlength="110" value="${esc(user.company)}" required>
        </div>
        <div class="field">
          <label for="vp_ruc">RUC</label>
          <input id="vp_ruc" name="ruc" inputmode="numeric" maxlength="11" value="${esc(user.ruc)}" placeholder="11 dígitos" required>
        </div>
        <div class="field">
          <label for="vp_phone">Teléfono de contacto</label>
          <input id="vp_phone" name="phone" maxlength="30" value="${esc(user.phone)}" required>
        </div>
        <label class="check-line full">
          <input type="checkbox" name="terms" required>
          Confirmo que los datos comerciales son correctos y autorizo su uso para identificarme como proveedor en RentaMaq.
        </label>
      </div>
      <p class="error-text" id="verifyError"></p>
      <div class="form-actions"><button type="button" data-close>Cancelar</button><button class="primary">Confirmar datos</button></div>
    </form>`);

  $('#verifyProviderForm').onsubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    data.terms = form.querySelector('[name="terms"]').checked;
    withBusy(form.querySelector('[type="submit"]'), 'Confirmando…', async () => {
      const result = await confirmCommercialData(data);
      if (!result.ok) {
        $('#verifyError').textContent = result.error;
        return;
      }
      updateShell();
      closeModal();
      if (route === 'perfil') profile();
      else render();
      toast('Datos comerciales confirmados. Tus anuncios muestran el sello de confianza.');
    });
  };
}

function downloadBackup() {
  const user = currentUser();
  if (!user) return;
  const backup = {
    app: 'RentaMaq',
    version: 3,
    exportedAt: new Date().toISOString(),
    note: 'Respaldo de la cuenta. No contiene contraseñas ni claves de acceso.',
    account: user,
    equipment: myEquipment(user),
    bookings: visibleBookings(user),
    threads: visibleThreads(user),
    tickets: visibleTickets(user),
    reviews: state.reviews.filter((review) => review.clientId === user.id || review.providerId === user.id),
    favorites: favoritesOf()
  };
  download(`RentaMaq-respaldo-${user.email.split('@')[0]}.json`, JSON.stringify(backup, null, 2), 'application/json');
  toast('Respaldo descargado con los datos de tu cuenta.');
}

function deleteAccountModal() {
  const user = currentUser();
  if (!user) return;

  modal('Eliminar mi cuenta', `
    <p>Esta acción elimina de forma permanente la cuenta <strong>${esc(user.email)}</strong> y sus datos asociados.</p>
    <ul class="about-list">
      <li>Se borran tu perfil, tus publicaciones y las fotografías que subiste.</li>
      <li>Se eliminan tus conversaciones y favoritos.</li>
      <li>Los alquileres compartidos conservan el historial para la otra parte, sin tus datos personales.</li>
      <li>Se cierra la sesión en todos los dispositivos.</li>
    </ul>
    <p class="muted">Si necesitas conservar información, descarga un respaldo antes de continuar. Esta acción no se puede deshacer.</p>
    <div class="field" style="margin-top:16px">
      <label for="deleteConfirm">Escribe <strong>ELIMINAR</strong> para confirmar</label>
      <input id="deleteConfirm" autocomplete="off" placeholder="ELIMINAR">
    </div>
    <div class="form-actions">
      <button data-close>Cancelar</button>
      <button class="primary danger-btn" id="confirmDeleteAccount" disabled>Eliminar mi cuenta</button>
    </div>`);

  const input = $('#deleteConfirm');
  const button = $('#confirmDeleteAccount');
  input.oninput = () => {
    button.disabled = input.value.trim().toUpperCase() !== 'ELIMINAR';
  };

  button.onclick = () => withBusy(button, 'Eliminando…', async () => {
    const result = await deleteOwnAccount();
    if (!result.ok) {
      toast(result.error);
      return;
    }
    closeModal();
    resetTransientState();
    authMode = 'login';
    authFlash = 'Tu cuenta y sus datos fueron eliminados.';
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
  });
}
