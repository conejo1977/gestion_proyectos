/* ============================================================================
   RentaMaq · Pantalla de acceso
   ----------------------------------------------------------------------------
   Inicio de sesión, registro de contratistas y proveedores, recuperación de
   contraseña y acceso rápido a las cuentas de demostración.
   ========================================================================== */

'use strict';

const RECOVERY_QUESTIONS = [
  'Ciudad donde naciste',
  'Nombre de tu primera mascota',
  'Nombre de tu colegio'
];

let authErrorType = 'error';

function authFieldError(message) {
  const box = $('#authError');
  if (!box) return;
  box.textContent = message;
  box.className = 'auth-error';
  authErrorType = 'error';
}

function authInfo(message) {
  const box = $('#authError');
  if (!box) return;
  box.textContent = message;
  box.className = message ? 'auth-error auth-info' : 'auth-error';
  authErrorType = 'info';
}

function renderAuthScreen(mode = 'login', message = '') {
  const card = $('#authCard');
  if (!card) return;
  authMode = mode;

  const tabs = `
    <div class="auth-tabs" role="tablist" aria-label="Acceso a RentaMaq">
      <button type="button" data-auth-tab="login" class="${mode === 'login' ? 'active' : ''}" role="tab" aria-selected="${mode === 'login'}">Iniciar sesión</button>
      <button type="button" data-auth-tab="register" class="${mode === 'register' ? 'active' : ''}" role="tab" aria-selected="${mode === 'register'}">Crear cuenta</button>
    </div>`;

  if (mode === 'register') {
    card.innerHTML = `${tabs}
      <h2>Crea tu cuenta</h2>
      <p class="auth-sub">Elige cómo participarás en RentaMaq. Podrás cambiarlo más adelante.</p>
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
            <small>La verificación es simulada en este prototipo.</small>
          </div>

          <div class="form-section-label">RECUPERACIÓN DE CUENTA</div>
          <div class="field">
            <label for="regQuestion">Pregunta de seguridad</label>
            <select id="regQuestion" name="recoveryQuestion">${RECOVERY_QUESTIONS.map((question) => `<option>${question}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label for="regAnswer">Respuesta</label>
            <input id="regAnswer" name="recoveryAnswer" maxlength="80" placeholder="La usarás si olvidas tu contraseña" required>
          </div>
          <label class="check-line full">
            <input type="checkbox" name="terms">
            Acepto que esta es una demostración académica y que mis datos se guardan únicamente en este navegador.
          </label>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Crear mi cuenta</button></div>
      </form>
      <p class="auth-switch-line">¿Ya tienes cuenta? <button type="button" data-auth-link="login">Inicia sesión</button></p>
      <p class="auth-note">RentaMaq guarda tus datos de forma local. No se envía información a Internet.</p>`;

    const form = $('#registerForm');
    form.role[0].addEventListener('change', () => toggleProviderFieldsForm(form));
    form.role[1].addEventListener('change', () => toggleProviderFieldsForm(form));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      data.terms = form.querySelector('[name="terms"]').checked;
      const result = registerAccount(data);
      if (!result.ok) {
        authFieldError(result.error);
        return;
      }
      const user = result.user;
      enterApplication();
      if (isProvider(user)) {
        modal('¡Cuenta de proveedor creada!', `
          <div class="center">
            <div class="success-icon">✓</div>
            <h2>Ya puedes publicar tus equipos</h2>
            <p class="muted">${esc(user.company)} quedó registrada como proveedor. La verificación está en revisión; puedes completarla desde tu cuenta para mostrar el sello de proveedor verificado.</p>
          </div>
          <div class="info-strip"><b>Consejo:</b> agrega una fotografía clara de cada equipo. Ese detalle ayuda a que los contratistas decidan más rápido.</div>
          <div class="form-actions"><button data-route="perfil" data-close>Completar verificación</button><button class="primary" data-route="equipos" data-close>Publicar mi primer equipo</button></div>`);
      } else {
        modal('¡Bienvenido a RentaMaq!', `
          <div class="center">
            <div class="success-icon">✓</div>
            <h2>Tu cuenta está lista</h2>
            <p class="muted">Explora el catálogo, guarda favoritos y solicita cotizaciones. Las cuentas de todas las personas que usen este navegador comparten el mismo catálogo local.</p>
          </div>
          <div class="form-actions"><button class="primary" data-route="catalogo" data-close>Explorar equipos</button></div>`);
      }
    });
  } else if (mode === 'recover') {
    card.innerHTML = `${tabs}
      <h2>Recupera tu cuenta</h2>
      <p class="auth-sub">Confirma tu correo y responde la pregunta de seguridad para crear una contraseña nueva.</p>
      <div id="authError" class="auth-error"></div>
      <form id="recoverForm" novalidate>
        <div class="form-grid">
          <div class="field full">
            <label for="recEmail">Correo electrónico</label>
            <input id="recEmail" name="email" type="email" autocomplete="email" maxlength="120" required>
          </div>
          <div class="field full">
            <label for="recAnswer">Respuesta de seguridad</label>
            <input id="recAnswer" name="answer" maxlength="80" placeholder="Escribe la respuesta que registraste" required>
            <small>Por ejemplo, si elegiste “Ciudad donde naciste”, escribe únicamente el nombre de la ciudad.</small>
          </div>
          <div class="field full">
            <label for="recPassword">Nueva contraseña</label>
            <div class="password-wrap">
              <input id="recPassword" name="password" type="password" autocomplete="new-password" minlength="8" required>
              <button type="button" class="password-toggle" data-toggle-password="recPassword">Ver</button>
            </div>
          </div>
          <div class="field full">
            <label for="recConfirm">Repite la nueva contraseña</label>
            <input id="recConfirm" name="confirmPassword" type="password" autocomplete="new-password" required>
          </div>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Cambiar contraseña</button></div>
      </form>
      <p class="auth-switch-line"><button type="button" data-auth-link="login">Volver a iniciar sesión</button></p>`;

    const form = $('#recoverForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (data.password !== data.confirmPassword) {
        authFieldError('Las contraseñas nuevas no coinciden.');
        return;
      }
      const result = recoverAccount(data.email, data.answer, data.password);
      if (!result.ok) {
        authFieldError(result.error);
        return;
      }
      showAuthScreen('login', 'Contraseña actualizada. Ya puedes iniciar sesión con tu nueva clave.');
    });
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
          <label class="check-line full"><input type="checkbox" name="remember" checked> Mantener mi sesión en este navegador</label>
        </div>
        <div class="form-actions"><button class="primary" type="submit">Entrar a RentaMaq</button></div>
      </form>
      <div class="auth-link-row">
        <button type="button" data-auth-link="recover">¿Olvidaste tu contraseña?</button>
        <span class="muted">Cuentas 100 % locales</span>
      </div>
      <div class="auth-demo">
        <p>Probar sin registrarte · contraseña <strong>Demo1234</strong></p>
        <div class="inline-actions">
          <button type="button" data-demo-login="contratista@rentamaq.pe"><b>Contratista demo</b><small>Anderson Castro</small></button>
          <button type="button" data-demo-login="proveedor@rentamaq.pe"><b>Proveedor demo</b><small>Miguel Sánchez · verificado</small></button>
        </div>
      </div>
      <p class="auth-note">¿Problemas con los datos de prueba? <button type="button" class="text-button" data-reset-local>Restablecer datos locales</button></p>`;

    const form = $('#loginForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const result = loginAccount(data.email, data.password, Boolean(data.remember));
      if (!result.ok) {
        authFieldError(result.error);
        return;
      }
      enterApplication();
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

function toggleProviderFieldsForm(form) {
  const isProvider = form.role.value === 'proveedor';
  $$('.provider-field', form).forEach((element) => element.classList.toggle('hidden', !isProvider));
  $('#regCompany').required = isProvider;
  $('#regRuc').required = isProvider;
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
      const result = loginAccount(button.dataset.demoLogin, 'Demo1234', true);
      if (!result.ok) {
        authFieldError(result.error);
        return;
      }
      enterApplication();
    });
  });

  const resetButton = $('[data-reset-local]');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      modal('Restablecer datos locales', `
        <p>Se eliminarán todas las cuentas, equipos publicados, solicitudes y mensajes guardados en este navegador. Las cuentas demo volverán a su estado inicial.</p>
        <p class="muted">Descarga un respaldo desde “Mi cuenta” antes de continuar si necesitas conservar la información.</p>
        <div class="form-actions"><button data-close>Cancelar</button><button class="primary" id="confirmLocalReset">Borrar y reiniciar</button></div>`);
      $('#confirmLocalReset').onclick = () => {
        resetDB();
        location.reload();
      };
    });
  }
}
