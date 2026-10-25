/* ============================================================================
   RentaMaq · Cuentas y sesiones
   ----------------------------------------------------------------------------
   Registro de contratistas y proveedores, inicio y cierre de sesión,
   recuperación de contraseña, cambio de datos y verificación simulada de
   proveedores. Todo funciona sin servidor: los datos quedan en este navegador.
   ========================================================================== */

'use strict';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RUC_PATTERN = /^\d{11}$/;

const validEmail = (email) => EMAIL_PATTERN.test(String(email || '').trim());
const validPassword = (password) => String(password || '').length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

const emailExists = (email, exceptUserId = '') => state.users.some((user) => (
  user.email.toLowerCase() === String(email || '').trim().toLowerCase() && user.id !== exceptUserId
));

const passwordStrength = (password) => {
  const value = String(password || '');
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(score, 4);
};

function registerAccount(payload) {
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const role = payload.role === 'proveedor' ? 'proveedor' : 'cliente';
  const company = String(payload.company || '').trim();
  const phone = String(payload.phone || '').trim();
  const city = String(payload.city || '').trim();
  const ruc = String(payload.ruc || '').replace(/\s/g, '');
  const recoveryQuestion = String(payload.recoveryQuestion || '').trim();
  const recoveryAnswer = normalize(payload.recoveryAnswer || '');

  if (name.length < 3) return { ok: false, error: 'Escribe tu nombre completo (mínimo 3 caracteres).' };
  if (!validEmail(email)) return { ok: false, error: 'El correo electrónico no tiene un formato válido.' };
  if (emailExists(email)) return { ok: false, error: 'Ya existe una cuenta con este correo. Inicia sesión o recupérala.' };
  if (!validPassword(password)) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres e incluir letras y números.' };
  if (password !== String(payload.confirmPassword || '')) return { ok: false, error: 'Las contraseñas no coinciden.' };
  if (role === 'proveedor' && company.length < 3) return { ok: false, error: 'Indica el nombre comercial o la razón social del proveedor.' };
  if (role === 'proveedor' && !RUC_PATTERN.test(ruc)) return { ok: false, error: 'El RUC del proveedor debe tener exactamente 11 dígitos.' };
  if (recoveryQuestion.length < 3) return { ok: false, error: 'Elige una pregunta de seguridad para recuperar tu cuenta.' };
  if (recoveryAnswer.length < 2) return { ok: false, error: 'Escribe una respuesta de seguridad de al menos 2 caracteres.' };
  if (!payload.terms) return { ok: false, error: 'Debes aceptar las condiciones de uso de esta demostración.' };

  const salt = `${uid()}${uid()}`;
  const user = {
    id: `u_${uid()}`,
    name,
    email,
    role,
    company: role === 'proveedor' ? company : company,
    phone,
    city,
    ruc: role === 'proveedor' ? ruc : '',
    verified: false,
    verifiedAt: null,
    demo: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    recoveryQuestion,
    salt,
    passwordHash: hashPassword(salt, password),
    recoveryAnswerHash: hashPassword(salt, recoveryAnswer)
  };

  state.users.push(user);
  state.favorites[user.id] = [];
  if (!saveDB()) {
    state.users.pop();
    delete state.favorites[user.id];
    return { ok: false, error: 'No se pudo guardar la cuenta en este navegador.' };
  }

  startSession(user.id, Boolean(payload.remember));
  return { ok: true, user };
}

function loginAccount(email, password, remember = true) {
  const user = state.users.find((item) => item.email.toLowerCase() === String(email || '').trim().toLowerCase());
  const genericError = 'Correo o contraseña incorrectos. Revisa los datos e inténtalo otra vez.';
  if (!user) return { ok: false, error: genericError };
  if (user.passwordHash !== hashPassword(user.salt, String(password || ''))) return { ok: false, error: genericError };

  user.lastLoginAt = new Date().toISOString();
  saveDB({ silent: true });
  startSession(user.id, Boolean(remember));
  return { ok: true, user };
}

function logoutAccount() {
  endSession();
}

function recoverAccount(email, answer, newPassword) {
  const user = state.users.find((item) => item.email.toLowerCase() === String(email || '').trim().toLowerCase());
  if (!user) return { ok: false, error: 'No encontramos una cuenta con ese correo.' };
  if (!user.recoveryQuestion || !user.recoveryAnswerHash) {
    return { ok: false, error: 'Esta cuenta no tiene pregunta de seguridad. Contacta al administrador de la demostración.' };
  }
  const answerHash = hashPassword(user.salt, normalize(answer));
  if (answerHash !== user.recoveryAnswerHash) return { ok: false, error: 'La respuesta de seguridad no coincide.' };
  if (!validPassword(newPassword)) return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números.' };

  user.passwordHash = hashPassword(user.salt, String(newPassword));
  saveDB();
  return { ok: true, user };
}

function changePassword(currentPassword, newPassword, confirmPassword) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Tu sesión venció. Vuelve a iniciar sesión.' };
  if (user.passwordHash !== hashPassword(user.salt, String(currentPassword || ''))) {
    return { ok: false, error: 'La contraseña actual no es correcta.' };
  }
  if (!validPassword(newPassword)) return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números.' };
  if (newPassword !== confirmPassword) return { ok: false, error: 'La confirmación no coincide con la nueva contraseña.' };
  if (newPassword === currentPassword) return { ok: false, error: 'La nueva contraseña debe ser diferente de la actual.' };

  user.passwordHash = hashPassword(user.salt, String(newPassword));
  saveDB();
  return { ok: true };
}

function updateAccount(data) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Tu sesión venció. Vuelve a iniciar sesión.' };

  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  if (name.length < 3) return { ok: false, error: 'El nombre debe tener al menos 3 caracteres.' };
  if (!validEmail(email)) return { ok: false, error: 'El correo electrónico no es válido.' };
  if (emailExists(email, user.id)) return { ok: false, error: 'Otra cuenta ya usa ese correo electrónico.' };

  user.name = name;
  user.email = email;
  user.phone = String(data.phone || '').trim();
  user.city = String(data.city || '').trim();
  if (user.role === 'proveedor') {
    const company = String(data.company || '').trim();
    if (company.length < 3) return { ok: false, error: 'El nombre comercial del proveedor es obligatorio.' };
    user.company = company;
    state.equipment.forEach((item) => {
      if (item.providerId === user.id) item.provider = company;
    });
    state.bookings.forEach((booking) => {
      if (booking.providerId === user.id) booking.providerName = company;
    });
  } else {
    user.company = String(data.company || '').trim();
  }

  saveDB();
  return { ok: true, user };
}

function upgradeToProvider(data) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Tu sesión venció. Vuelve a iniciar sesión.' };
  const company = String(data.company || '').trim();
  const ruc = String(data.ruc || '').replace(/\s/g, '');
  const phone = String(data.phone || '').trim();

  if (company.length < 3) return { ok: false, error: 'Indica el nombre comercial o la razón social.' };
  if (!RUC_PATTERN.test(ruc)) return { ok: false, error: 'El RUC debe tener exactamente 11 dígitos.' };
  if (phone.length < 6) return { ok: false, error: 'Indica un teléfono de contacto válido.' };
  if (!data.terms) return { ok: false, error: 'Confirma que la información es correcta para continuar.' };

  user.role = 'proveedor';
  user.company = company;
  user.ruc = ruc;
  user.phone = phone;
  user.verified = false;
  user.verifiedAt = null;
  saveDB();
  return { ok: true, user };
}

function verifyProviderAccount(data) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Tu sesión venció. Vuelve a iniciar sesión.' };
  if (user.role !== 'proveedor') return { ok: false, error: 'Primero conviértete en proveedor.' };

  const company = String(data.company || user.company || '').trim();
  const ruc = String(data.ruc || user.ruc || '').replace(/\s/g, '');
  const phone = String(data.phone || user.phone || '').trim();
  if (company.length < 3) return { ok: false, error: 'El nombre comercial es obligatorio.' };
  if (!RUC_PATTERN.test(ruc)) return { ok: false, error: 'El RUC debe tener exactamente 11 dígitos.' };
  if (!data.terms) return { ok: false, error: 'Confirma la declaración para solicitar la verificación.' };

  user.company = company;
  user.ruc = ruc;
  user.phone = phone;
  user.verified = true;
  user.verifiedAt = new Date().toISOString();
  state.equipment.forEach((item) => {
    if (item.providerId === user.id) item.verified = true;
  });
  saveDB();
  return { ok: true, user };
}
