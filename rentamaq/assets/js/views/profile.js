/* ============================================================================
   RentaMaq · Mi cuenta
   ----------------------------------------------------------------------------
   Datos personales, seguridad, identificación como proveedor, verificación
   simulada, respaldo de información y cierre de sesión.
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
          <div class="badges">${roleBadge(user.role)}${provider ? verificationBadge(user.verified) : ''}${user.demo ? '<span class="badge badge-neutral">Cuenta demo</span>' : ''}</div>
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
        <p class="muted" style="font-size:13px">Cambia tu contraseña cuando lo necesites. Se almacena como un hash con sal en este navegador.</p>
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
        <h3>${provider ? 'Verificación de proveedor' : '¿Tienes equipos para alquilar?'}</h3>
        ${provider ? `
          <p class="muted" style="font-size:14px">${user.verified
            ? 'La verificación simulada está aprobada. Tus anuncios muestran el sello de proveedor verificado.'
            : 'Completa la verificación simulada con los datos comerciales para mostrar el sello de confianza en tus anuncios.'}</p>
          <div class="kv-list">
            <div><small>Estado</small><b>${user.verified ? 'Verificado' : 'En revisión'}</b></div>
            <div><small>RUC</small><b>${esc(user.ruc || 'No registrado')}</b></div>
            <div><small>Nombre comercial</small><b>${esc(user.company || 'No registrado')}</b></div>
            <div><small>Verificado desde</small><b>${user.verifiedAt ? new Date(user.verifiedAt).toLocaleDateString('es-PE') : 'Pendiente'}</b></div>
          </div>
          <div class="inline-actions" style="margin-top:16px">
            ${!user.verified ? '<button class="primary" data-verify-provider>Completar verificación</button>' : ''}
            <button data-route="equipos">Gestionar mis equipos</button>
          </div>
          <p class="muted" style="font-size:12px;margin-top:12px">La verificación no consulta registros reales; es parte de la demostración académica.</p>`
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
      <p class="muted" style="font-size:14px">RentaMaq guarda todo en localStorage: cuentas, catálogo, solicitudes, mensajes e imágenes optimizadas. Un respaldo te permite conservar tu información personal.</p>
      <div class="inline-actions">
        <button data-backup>Descargar respaldo JSON</button>
        <button data-export>Exportar alquileres CSV</button>
        <button data-logout>Cerrar sesión</button>
      </div>
      <p class="muted" style="font-size:12px;margin-top:13px">El respaldo incluye solo los datos de tu cuenta y las operaciones que puedes ver. No contiene contraseñas ni hashes.</p>
    </section>

    <section class="panel danger-zone">
      <h3>Zona delicada</h3>
      <p class="muted" style="font-size:13px">Restablecer la aplicación elimina todas las cuentas y datos locales de este navegador, incluidos los de otras personas que hayan usado este equipo.</p>
      <button class="danger-btn" data-reset-demo>Restablecer todos los datos locales</button>
    </section>`;

  $('#profileForm').onsubmit = (event) => {
    event.preventDefault();
    const result = updateAccount(Object.fromEntries(new FormData(event.target)));
    if (!result.ok) {
      toast(result.error);
      return;
    }
    updateShell();
    profile();
    toast('Datos de la cuenta actualizados.');
  };

  $('#passwordForm').onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const result = changePassword(data.current, data.next, data.confirm);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    event.target.reset();
    toast('Contraseña actualizada correctamente.');
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
          Declaro que la información es correcta y acepto que la verificación es simulada en este prototipo.
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
    const result = upgradeToProvider(data);
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
        <p class="muted">Tu perfil mostrará el distintivo de proveedor. La verificación está en revisión; puedes completarla desde Mi cuenta.</p>
      </div>
      <div class="form-actions">
        <button data-route="perfil" data-close>Ver mi cuenta</button>
        <button class="primary" data-publish data-close>Publicar mi primer equipo</button>
      </div>`);
  };
}

function verifyProviderModal() {
  const user = currentUser();
  if (!user) return;
  if (!isProvider(user)) {
    becomeProviderModal();
    return;
  }

  modal('Verificación de proveedor', `
    <p class="muted">Completa los datos comerciales para activar el sello de proveedor verificado. La validación es simulada dentro de esta demostración.</p>
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
          Confirmo que los datos comerciales son correctos y que entiendo que la verificación es simulada.
        </label>
      </div>
      <p class="error-text" id="verifyError"></p>
      <div class="form-actions"><button type="button" data-close>Cancelar</button><button class="primary">Solicitar verificación</button></div>
    </form>`);

  $('#verifyProviderForm').onsubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    data.terms = form.querySelector('[name="terms"]').checked;
    const result = verifyProviderAccount(data);
    if (!result.ok) {
      $('#verifyError').textContent = result.error;
      return;
    }
    updateShell();
    closeModal();
    if (route === 'perfil') profile();
    else render();
    toast('Verificación aprobada. Tus anuncios muestran el sello de proveedor verificado.');
  };
}

function downloadBackup() {
  const user = currentUser();
  if (!user) return;
  const { passwordHash, salt, recoveryAnswerHash, ...account } = user;
  const backup = {
    app: 'RentaMaq',
    version: 2,
    exportedAt: new Date().toISOString(),
    note: 'Respaldo local de la cuenta. No contiene contraseñas ni hashes.',
    account,
    equipment: myEquipment(user),
    bookings: visibleBookings(user),
    threads: visibleThreads(user),
    tickets: visibleTickets(user),
    reviews: state.reviews.filter((review) => review.clientId === user.id || review.providerId === user.id)
  };
  download(`RentaMaq-respaldo-${user.email.split('@')[0]}.json`, JSON.stringify(backup, null, 2), 'application/json');
  toast('Respaldo descargado con los datos de tu cuenta.');
}

function resetApplication() {
  modal('Restablecer todos los datos locales', `
    <p>Se eliminarán <strong>todas las cuentas, equipos, solicitudes, mensajes y fotografías</strong> guardadas en este navegador. Las cuentas de demostración volverán a su estado inicial.</p>
    <p class="muted">Esta acción no se puede deshacer. Si necesitas conservar información, descarga un respaldo antes de continuar.</p>
    <div class="form-actions">
      <button data-close>Cancelar</button>
      <button class="primary danger-btn" id="confirmResetAll">Borrar todo y reiniciar</button>
    </div>`);
  $('#confirmResetAll').onclick = () => {
    resetDB();
    location.reload();
  };
}
