/* ============================================================================
   RentaMaq · Pantalla de acceso
   ----------------------------------------------------------------------------
   Inicio de sesión, registro de contratistas y proveedores, recuperación de
   contraseña y acceso rápido a las Cuentas Demo.
   ========================================================================== */

'use strict';

let authErrorType = 'error';

function authFieldError(message) {
  const box = $('#authError');
  if (!box) return;
  box.textContent = message;
  box.className = 'auth-error';
  box.removeAttribute('data-email');
  authErrorType = 'error';
}

function authInfo(message, email = '') {
  const box = $('#authError');
  if (!box) return;
  box.textContent = message;
  box.className = message ? 'auth-error auth-info' : 'auth-error';
  if (email) box.dataset.email = email;
  else box.removeAttribute('data-email');
  authErrorType = 'info';
}

function renderAuthScreen(mode = 'login', message = '') {
  const card = $('#authCard');
  if (!card) return;
  authMode = mode;

  const tabs = ['login', 'register'].includes(mode) ? `
    <div class="auth-tabs" role="tablist" aria-label="Acceso a RentaMaq">
      <button type="button" data-auth-tab="login" class="${mode === 'login' ? 'active' : ''}" role="tab" aria-selected="${mode === 'login'}">Iniciar sesión</button>
      <button type="button" data-auth-tab="register" class="${mode === 'register' ? 'active' : ''}" role="tab" aria-selected="${mode === 'register'}">Crear cuenta</button>
    </div>` : '';

  if (mode === 'register') {
    card.innerHTML = `${tabs}
      <h2>Crea tu cuenta</h2>
      <p class="auth-sub">Elige cómo participarás en RentaMaq. Podrás cambiar de rol más adelante.</p>
      <div id="authError" class="auth-error"></div>
      <form id="registerForm" novalidate>
        <div class="form-grid">
          <div class="field full">
            <label>Quiero usar RentaMaq para</label>
            <div class="role-picker">
              <label>
                <input type="radio" name="role" value="cliente" checked>
                <span><strong>Alquilar equipos</strong><small>Soy contratista o constructora.</small></span>
              </label>
              <label>
                <input type="radio" name="role" value="proveedor">
                <span><strong>Publicar equipos</strong><small>Soy propietario o proveedor.</small></span>
              </label>
            </div>
          </div>
          <div class="field full">
            <label for="regName">Nombre completo</label>
            <input id="regName" name="name" maxlength="90" autocomplete="name" placeholder="Ej. Ana Torres" required>
          </div>
          <div class="field">
            <label for="regEmail">Correo electrónico</label>
            <input id="regEmail" name="email" type="email" maxlength="120" autocomplete="email" placeholder="tucorreo@ejemplo.com" required>
          </div>
          <div class="field">
            <label for="regCity">Ciudad</label>
            <input id="regCity" name="city" maxlength="80" autocomplete="address-level2" placeholder="Ej. Trujillo" required>
          </div>
          <div class="field">
            <label for="regPhone">Teléfono (opcional)</label>
            <input id="regPhone" name="phone" maxlength="30" autocomplete="tel" placeholder="999 999 999">
          </div>
          <div class="field">
            <label for="regPassword">Contraseña</label>
            <div class="password-wrap">
              <input id="regPassword" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required>
              <button type="button" class="password-toggle" data-toggle-password="regPassword" aria-label="Mostrar contraseña">Ver</button>
            </div>
            <small>Al menos 8 caracteres, con letras y números.</small>
          </div>
          <div class="field full">
            <label for="regConfirm">Repite la contraseña</label>
            <div class="password-wrap">
              <input id="regConfirm" name="confirmPassword" type="password" autocomplete="new-password" required>
              <button type="button" class="password-toggle" data-toggle-password="regConfirm" aria-label="Mostrar contraseña">Ver</button>
            </div>
          </div>

          <div class="form-section-label provider-field hidden">DATOS DEL PROVEEDOR</div>
          <div class="field provider-field hidden">
            <label for="regCompany">Nombre comercial o razón social</label>
            <input id="regCompany" name="company" maxlength="110" placeholder="Ej. Maquinarias del Norte">
          </div>
          <div class="field provider-field hidden">
            <label for="regRuc">RUC</label>
            <input id="regRuc" name="ruc" inputmode="numeric" maxlength="11" placeholder="11 dígitos">
            <small>Lo usamos para identificar tu actividad comercial.</small>
          </div>

          <label class="check-line full">
            <input type="checkbox" name="terms">
            Acepto las <button type="button" class="link-inline" data-terms>condiciones de uso</button> y el tratamiento de mis datos para gestionar la cuenta y las operaciones de alquiler.
          </label>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Crear mi cuenta</button></div>
      </form>
      <p class="auth-switch-line">¿Ya tienes cuenta? <button type="button" data-auth-link="login">Inicia sesión</button></p>
      <p class="auth-note">Al crear una cuenta recibirás un correo para confirmar tu dirección. Revisa también la carpeta de spam.</p>`;

    const form = $('#registerForm');
    form.elements.role.forEach((radio) => radio.addEventListener('change', () => toggleProviderFieldsForm(form)));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const data = Object.fromEntries(new FormData(form));
      data.terms = form.querySelector('[name="terms"]').checked;

      withBusy(submit, 'Creando cuenta…', async () => {
        const result = await registerAccount(data);
        if (!result.ok) {
          authFieldError(result.error);
          return;
        }
        if (result.needsConfirmation) {
          authInfo(result.message, result.email);
          const box = $('#authError');
          if (box && !$('#resendConfirmation')) {
            const resend = document.createElement('button');
            resend.type = 'button';
            resend.id = 'resendConfirmation';
            resend.className = 'text-button auth-resend';
            resend.textContent = 'Reenviar correo de confirmación';
            resend.onclick = () => withBusy(resend, 'Enviando…', async () => {
              const response = await resendConfirmation(box.dataset.email || data.email);
              if (response.ok) authInfo(response.message, box.dataset.email || data.email);
              else authFieldError(response.error);
            });
            box.appendChild(resend);
          }
          return;
        }
        registrationSuccess(result.user);
      });
    });
  } else if (mode === 'recover') {
    card.innerHTML = `${tabs}
      <h2>Recupera tu contraseña</h2>
      <p class="auth-sub">Escribe el correo de tu cuenta y te enviaremos un enlace seguro para crear una contraseña nueva.</p>
      <div id="authError" class="auth-error ${message ? 'auth-info' : ''}">${esc(message)}</div>
      <form id="recoverForm" novalidate>
        <div class="form-grid">
          <div class="field full">
            <label for="recEmail">Correo electrónico</label>
            <input id="recEmail" name="email" type="email" autocomplete="email" maxlength="120" placeholder="tucorreo@ejemplo.com" required>
          </div>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Enviar enlace</button></div>
      </form>
      <p class="auth-switch-line"><button type="button" data-auth-link="login">Volver a iniciar sesión</button></p>
      <p class="auth-note">Por seguridad, el mensaje es el mismo exista o no una cuenta con ese correo.</p>`;

    const form = $('#recoverForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      withBusy(submit, 'Enviando…', async () => {
        const result = await sendPasswordReset(Object.fromEntries(new FormData(form)).email);
        if (!result.ok) {
          authFieldError(result.error);
          return;
        }
        authInfo(result.message);
      });
    });
    if (message) authInfo(message);
  } else if (mode === 'reset') {
    card.innerHTML = `
      <h2>Crea una contraseña nueva</h2>
      <p class="auth-sub">Elige una clave que no uses en otros servicios. Al guardarla se cerrará la sesión para que entres con la nueva.</p>
      <div id="authError" class="auth-error ${message ? 'auth-info' : ''}">${esc(message)}</div>
      <form id="resetForm" novalidate>
        <div class="form-grid">
          <div class="field full">
            <label for="resetPassword">Nueva contraseña</label>
            <div class="password-wrap">
              <input id="resetPassword" name="password" type="password" minlength="8" autocomplete="new-password" required>
              <button type="button" class="password-toggle" data-toggle-password="resetPassword" aria-label="Mostrar contraseña">Ver</button>
            </div>
            <small>Al menos 8 caracteres, con letras y números.</small>
          </div>
          <div class="field full">
            <label for="resetConfirm">Repite la nueva contraseña</label>
            <input id="resetConfirm" name="confirmPassword" type="password" autocomplete="new-password" required>
          </div>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Guardar contraseña</button></div>
      </form>
      <p class="auth-switch-line"><button type="button" data-auth-link="login">Volver a iniciar sesión</button></p>`;

    const form = $('#resetForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const data = Object.fromEntries(new FormData(form));
      withBusy(submit, 'Guardando…', async () => {
        const result = await updatePassword(data.password, data.confirmPassword);
        if (!result.ok) {
          authFieldError(result.error);
          return;
        }
        showAuthScreen('login', 'Contraseña actualizada. Ya puedes ingresar con tu nueva clave.');
      });
    });
    if (message) authInfo(message);
  } else {
    card.innerHTML = `${tabs}
      <h2>Bienvenido de vuelta</h2>
      <p class="auth-sub">Ingresa para alquilar equipos o gestionar tus publicaciones.</p>
      <div id="authError" class="auth-error ${message ? 'auth-info' : ''}">${esc(message)}</div>
      <form id="loginForm" novalidate>
        <div class="form-grid">
          <div class="field full">
            <label for="loginEmail">Correo electrónico</label>
            <input id="loginEmail" name="email" type="email" autocomplete="email" maxlength="120" placeholder="tucorreo@ejemplo.com" required>
          </div>
          <div class="field full">
            <label for="loginPassword">Contraseña</label>
            <div class="password-wrap">
              <input id="loginPassword" name="password" type="password" autocomplete="current-password" required>
              <button type="button" class="password-toggle" data-toggle-password="loginPassword" aria-label="Mostrar contraseña">Ver</button>
            </div>
          </div>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Entrar a RentaMaq</button></div>
      </form>
      <div class="auth-link-row">
        <button type="button" data-auth-link="recover">¿Olvidaste tu contraseña?</button>
        <span class="muted">Sesión sincronizada</span>
      </div>
      <div class="auth-demo">
        <p><strong>Cuentas Demo</strong> · contraseña <strong>${RM_DEMO_PASSWORD}</strong></p>
        <div class="inline-actions">
          ${RM_DEMO_ACCOUNTS.map((account) => `
            <button type="button" data-demo-login="${account.email}">
              <b>${esc(account.label)}</b>
              <small>${esc(account.name)} · ${esc(account.detail)}</small>
            </button>`).join('')}
        </div>
        <details class="demo-extra">
          <summary>Ver más Cuentas Demo</summary>
          <div class="demo-list">
            ${RM_OTHER_DEMO_ACCOUNTS.map(([email, company]) => `
              <button type="button" data-demo-login="${email}">
                <b>${esc(company)}</b>
                <small>${esc(email)}</small>
              </button>`).join('')}
          </div>
        </details>
      </div>
      <p class="auth-note">RentaMaq usa autenticación segura de Supabase. Tu cuenta funciona en cualquier dispositivo con esta misma dirección.</p>`;

    const form = $('#loginForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const data = Object.fromEntries(new FormData(form));
      withBusy(submit, 'Ingresando…', async () => {
        const result = await loginAccount(data.email, data.password);
        if (!result.ok) authFieldError(result.error);
      });
    });
    form.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        if (authErrorType === 'error') {
          $('#authError').textContent = '';
          $('#authError').className = 'auth-error';
        }
      });
    });
    if (message) authInfo(message);
  }

  bindAuthControls();
}

function registrationSuccess(user) {
  if (isProvider(user)) {
    modal('Tu cuenta de proveedor está lista', `
      <div class="center">
        <div class="success-icon">✓</div>
        <h2>Ya puedes publicar tus equipos</h2>
        <p class="muted">${esc(user.company || user.name)} quedó registrada como proveedor. Completa la revisión de datos comerciales para mostrar el sello de confianza en tus anuncios.</p>
      </div>
      <div class="info-strip"><b>Consejo:</b> agrega una fotografía clara de cada equipo. Ese detalle ayuda a que los contratistas decidan más rápido.</div>
      <div class="form-actions"><button data-route="perfil" data-close>Revisar mis datos</button><button class="primary" data-route="equipos" data-close>Publicar mi primer equipo</button></div>`);
  } else {
    modal('¡Bienvenido a RentaMaq!', `
      <div class="center">
        <div class="success-icon">✓</div>
        <h2>Tu cuenta está lista</h2>
        <p class="muted">Explora el catálogo, guarda favoritos y solicita cotizaciones. Tus operaciones quedan sincronizadas para que las revises desde cualquier dispositivo.</p>
      </div>
      <div class="form-actions"><button class="primary" data-route="catalogo" data-close>Explorar equipos</button></div>`);
  }
}

function toggleProviderFieldsForm(form) {
  const role = form.querySelector('[name="role"]:checked')?.value;
  const provider = role === 'proveedor';
  $$('.provider-field', form).forEach((element) => element.classList.toggle('hidden', !provider));
  $('#regCompany').required = provider;
  $('#regRuc').required = provider;
}

function bindAuthControls() {
  $$('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => showAuthScreen(button.dataset.authTab, ''));
  });

  $$('[data-auth-link]').forEach((button) => {
    button.addEventListener('click', () => showAuthScreen(button.dataset.authLink, ''));
  });

  $$('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Ocultar' : 'Ver';
      button.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  $$('[data-demo-login]').forEach((button) => {
    button.addEventListener('click', () => {
      const email = button.dataset.demoLogin;
      withBusy(button, 'Ingresando…', async () => {
        const result = await loginAccount(email, RM_DEMO_PASSWORD);
        if (!result.ok) authFieldError(result.error);
      });
    });
  });

  $$('[data-terms]').forEach((button) => {
    button.addEventListener('click', () => {
      modal('Condiciones de uso', `
        <p>RentaMaq es una plataforma que conecta a propietarios de maquinaria y equipos con contratistas que necesitan alquilarlos. RentaMaq no es propietaria de los equipos ni procesa pagos.</p>
        <h3>Cuentas y veracidad</h3>
        <p class="muted">Cada persona es responsable de la información que publica. Los proveedores deben describir el estado, las condiciones y la disponibilidad real de sus equipos. Los datos comerciales confirmados por RentaMaq acreditan que la cuenta completó la revisión básica de contacto y RUC; no sustituyen una inspección técnica ni una revisión documental.</p>
        <h3>Operaciones y pagos</h3>
        <p class="muted">Las solicitudes, confirmaciones y devoluciones se coordinan entre las partes. La tarifa, el traslado, el operador y la garantía se muestran antes de solicitar. El pago se acuerda directamente entre contratista y proveedor; la aplicación solo deja constancia de la forma de pago elegida.</p>
        <h3>Datos personales</h3>
        <p class="muted">Usamos el correo, nombre, ciudad y teléfono para operar la cuenta y coordinar alquileres. El correo y el teléfono no se muestran en el catálogo ni en el perfil público. Puedes eliminar tu cuenta desde “Mi cuenta”.</p>
        <h3>Uso responsable</h3>
        <p class="muted">No publiques información falsa, contenido ilícito ni datos de terceros sin autorización. RentaMaq puede suspender cuentas que incumplan estas condiciones o afecten la seguridad de la comunidad.</p>
        <div class="form-actions"><button class="primary" data-close>Entendido</button></div>`);
    });
  });
}
