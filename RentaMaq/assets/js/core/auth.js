/* ============================================================================
   RentaMaq · Autenticación y sesión
   ----------------------------------------------------------------------------
   Registro, inicio de sesión, recuperación de contraseña, cambio de datos y
   cierre de sesión con Supabase Auth. La sesión se comparte entre pestañas y
   permite entrar desde cualquier dispositivo con la misma cuenta.
   ========================================================================== */

'use strict';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RUC_PATTERN = /^\d{11}$/;

let authEventsReady = false;
let authEventWatcher = null;

const validEmail = (email) => EMAIL_PATTERN.test(String(email || '').trim());
const validPassword = (password) => String(password || '').length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

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

const authClient = () => {
  if (!sb) throw new Error('La conexión con Supabase no está disponible.');
  return sb;
};

async function ensureProfile(user) {
  const client = authClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const profile = mapProfile(data);
    profile.email = user.email || '';
    return profile;
  }

  const meta = user.user_metadata || {};
  const fallback = {
    id: user.id,
    name: String(meta.name || user.email?.split('@')[0] || 'Usuario').slice(0, 90),
    role: 'cliente',
    company: String(meta.company || ''),
    phone: String(meta.phone || ''),
    city: String(meta.city || ''),
    ruc: ''
  };

  const inserted = await client.from('profiles').insert(fallback).select().single();
  if (inserted.error) throw inserted.error;
  const profile = mapProfile(inserted.data);
  profile.email = user.email || '';
  return profile;
}

function rememberProfile(profile) {
  state.profile = profile;
  const index = state.profiles.findIndex((entry) => entry.id === profile.id);
  if (index >= 0) state.profiles[index] = { ...state.profiles[index], ...profile };
  else state.profiles.push(profile);
}

async function startUserSession(session, options = {}) {
  if (!session?.user) throw new Error('No se pudo iniciar la sesión.');
  authUser = session.user;
  const profile = await ensureProfile(session.user);
  state.profile = profile;
  await fetchCloudData();
  startRealtime();
  enterApplication({
    welcome: Boolean(options.welcome),
    confirmed: Boolean(options.confirmed)
  });
  return profile;
}

async function restoreSession() {
  const client = authClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return {
    session: data.session || null,
    recovery: RM_AUTH_LINK_TYPE === 'recovery'
  };
}

function watchAuthEvents(handlers = {}) {
  const client = authClient();
  if (authEventWatcher?.subscription) {
    try { authEventWatcher.subscription.unsubscribe(); } catch { /* ya estaba cerrado */ }
  }

  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (!authEventsReady) return;
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') {
        authUser = session?.user || authUser;
        handlers.onRecovery?.();
        return;
      }
      if (event === 'SIGNED_OUT') {
        if (state.profile || handlers.force) {
          stopRealtime();
          resetCloudState();
          handlers.onSignOut?.();
        }
        return;
      }
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        authUser = session.user;
      }
    }, 0);
  });
  authEventWatcher = data;
  authEventsReady = true;
}

/* ------------------------------- Registro -------------------------------- */

async function registerAccount(payload) {
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const role = payload.role === 'proveedor' ? 'proveedor' : 'cliente';
  const company = String(payload.company || '').trim();
  const phone = String(payload.phone || '').trim();
  const city = String(payload.city || '').trim();
  const ruc = String(payload.ruc || '').replace(/\s/g, '');

  if (name.length < 3) return { ok: false, error: 'Escribe tu nombre completo (mínimo 3 caracteres).' };
  if (!validEmail(email)) return { ok: false, error: 'El correo electrónico no tiene un formato válido.' };
  if (!validPassword(password)) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres e incluir letras y números.' };
  if (password !== String(payload.confirmPassword || '')) return { ok: false, error: 'Las contraseñas no coinciden.' };
  if (role === 'proveedor' && company.length < 3) return { ok: false, error: 'Indica el nombre comercial o la razón social del proveedor.' };
  if (role === 'proveedor' && !RUC_PATTERN.test(ruc)) return { ok: false, error: 'El RUC del proveedor debe tener exactamente 11 dígitos.' };
  if (!payload.terms) return { ok: false, error: 'Debes aceptar las condiciones de uso y la política de privacidad.' };

  try {
    const client = authClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: RM_APP_URL,
        data: { name, role, company, phone, city, ruc }
      }
    });

    if (error) return { ok: false, error: friendlyError(error) };
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, error: 'Ya existe una cuenta con ese correo. Inicia sesión o usa “¿Olvidaste tu contraseña?”.' };
    }

    if (!data.session) {
      return {
        ok: true,
        needsConfirmation: true,
        email,
        message: 'Cuenta creada. Te enviamos un enlace de confirmación; ábrelo para activar tu acceso.'
      };
    }

    const profile = await startUserSession(data.session, { welcome: true });
    return { ok: true, user: profile };
  } catch (error) {
    console.error('RentaMaq · registro', error);
    return { ok: false, error: friendlyError(error) };
  }
}

/* ------------------------------ Inicio de sesión ------------------------- */

async function loginAccount(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!validEmail(cleanEmail)) return { ok: false, error: 'Escribe un correo electrónico válido.' };
  if (!password) return { ok: false, error: 'Escribe tu contraseña.' };

  try {
    const client = authClient();
    const { data, error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) return { ok: false, error: friendlyError(error) };
    const profile = await startUserSession(data.session, { welcome: true });
    return { ok: true, user: profile };
  } catch (error) {
    console.error('RentaMaq · inicio de sesión', error);
    return { ok: false, error: friendlyError(error) };
  }
}

async function resendConfirmation(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!validEmail(cleanEmail)) return { ok: false, error: 'Escribe un correo electrónico válido.' };
  try {
    const client = authClient();
    const { error } = await client.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: { emailRedirectTo: RM_APP_URL }
    });
    if (error) return { ok: false, error: friendlyError(error) };
    return { ok: true, message: 'Te enviamos un nuevo enlace de confirmación. Revisa tu correo y la carpeta de spam.' };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/* --------------------------- Recuperar contraseña ------------------------ */

async function sendPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!validEmail(cleanEmail)) return { ok: false, error: 'Escribe el correo de tu cuenta.' };
  try {
    const client = authClient();
    const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: RM_APP_URL
    });
    if (error) return { ok: false, error: friendlyError(error) };
    return {
      ok: true,
      message: 'Si el correo está registrado, recibirás un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.'
    };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

async function updatePassword(newPassword, confirmPassword) {
  if (!validPassword(newPassword)) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números.' };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'Las contraseñas no coinciden.' };
  }

  try {
    const client = authClient();
    const { error } = await client.auth.updateUser({ password: String(newPassword) });
    if (error) return { ok: false, error: friendlyError(error) };
    try { await client.auth.signOut({ scope: 'local' }); } catch { /* la clave ya cambió */ }
    stopRealtime();
    resetCloudState();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

async function changePassword(currentPassword, newPassword, confirmPassword) {
  if (!validPassword(newPassword)) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números.' };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'La confirmación no coincide con la nueva contraseña.' };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: 'La nueva contraseña debe ser diferente de la actual.' };
  }

  try {
    const client = authClient();
    if (!authUser?.email) throw new Error('Tu sesión no está activa.');

    // Supabase no pide la clave anterior en updateUser; se reautentica primero.
    const reauth = await client.auth.signInWithPassword({
      email: authUser.email,
      password: String(currentPassword || '')
    });
    if (reauth.error) {
      return { ok: false, error: 'La contraseña actual no es correcta.' };
    }
    if (reauth.data.session?.user) authUser = reauth.data.session.user;

    const { error } = await client.auth.updateUser({ password: String(newPassword) });
    if (error) return { ok: false, error: friendlyError(error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/* ------------------------------- Perfil ---------------------------------- */

async function updateAccount(data) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Tu sesión venció. Vuelve a iniciar sesión.' };

  const name = String(data.name || '').trim();
  const company = String(data.company || '').trim();
  const phone = String(data.phone || '').trim();
  const city = String(data.city || '').trim();
  const email = String(data.email || '').trim().toLowerCase();

  if (name.length < 3) return { ok: false, error: 'El nombre debe tener al menos 3 caracteres.' };
  if (!validEmail(email)) return { ok: false, error: 'El correo electrónico no es válido.' };
  if (isProvider(user) && company.length < 3) {
    return { ok: false, error: 'El nombre comercial del proveedor es obligatorio.' };
  }

  try {
    const client = authClient();
    const { data: updated, error } = await client
      .from('profiles')
      .update({ name, company, phone, city })
      .eq('id', user.id)
      .select()
      .single();

    if (error) return { ok: false, error: friendlyError(error) };

    let emailMessage = '';
    if (email !== String(user.email || '').toLowerCase()) {
      const emailUpdate = await client.auth.updateUser({ email });
      if (emailUpdate.error) return { ok: false, error: friendlyError(emailUpdate.error) };
      emailMessage = 'Te enviamos un enlace al nuevo correo para confirmar el cambio.';
    }

    const profile = mapProfile(updated);
    // El nuevo correo queda pendiente hasta que se confirme desde la bandeja.
    profile.email = user.email;
    rememberProfile(profile);
    return { ok: true, user: profile, emailMessage };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

async function becomeProvider(data) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Tu sesión venció. Vuelve a iniciar sesión.' };

  const company = String(data.company || '').trim();
  const ruc = String(data.ruc || '').replace(/\s/g, '');
  const phone = String(data.phone || '').trim();

  if (company.length < 3) return { ok: false, error: 'Indica el nombre comercial o la razón social.' };
  if (!RUC_PATTERN.test(ruc)) return { ok: false, error: 'El RUC debe tener exactamente 11 dígitos.' };
  if (phone.length < 6) return { ok: false, error: 'Indica un teléfono de contacto válido.' };
  if (!data.terms) return { ok: false, error: 'Confirma que la información es correcta para continuar.' };

  try {
    const client = authClient();
    const { data: updated, error } = await client.rpc('become_provider', {
      p_company: company,
      p_ruc: ruc,
      p_phone: phone
    });
    if (error) return { ok: false, error: friendlyError(error) };
    const profile = mapProfile(Array.isArray(updated) ? updated[0] : updated);
    profile.email = user.email;
    rememberProfile(profile);
    return { ok: true, user: profile };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

async function confirmCommercialData(data) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Tu sesión venció. Vuelve a iniciar sesión.' };

  const company = String(data.company || '').trim();
  const ruc = String(data.ruc || '').replace(/\s/g, '');
  const phone = String(data.phone || '').trim();

  if (company.length < 3) return { ok: false, error: 'El nombre comercial es obligatorio.' };
  if (!RUC_PATTERN.test(ruc)) return { ok: false, error: 'El RUC debe tener exactamente 11 dígitos.' };
  if (phone.length < 6) return { ok: false, error: 'Indica un teléfono de contacto válido.' };
  if (!data.terms) return { ok: false, error: 'Confirma la declaración para continuar.' };

  try {
    const client = authClient();
    const { data: updated, error } = await client.rpc('confirm_commercial_data', {
      p_company: company,
      p_ruc: ruc,
      p_phone: phone
    });
    if (error) return { ok: false, error: friendlyError(error) };
    const profile = mapProfile(Array.isArray(updated) ? updated[0] : updated);
    profile.email = user.email;
    rememberProfile(profile);
    return { ok: true, user: profile };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/* ------------------------------- Salida ---------------------------------- */

async function logoutAccount(scope = 'local') {
  try {
    if (sb) await sb.auth.signOut({ scope });
  } catch (error) {
    console.warn('RentaMaq · cierre de sesión', error);
  }
  await stopRealtime();
  resetCloudState();
}

async function deleteOwnAccount() {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Tu sesión venció. Vuelve a iniciar sesión.' };
  try {
    const client = authClient();
    const { error } = await client.rpc('delete_own_account');
    if (error) return { ok: false, error: friendlyError(error) };
    try { await client.auth.signOut({ scope: 'local' }); } catch { /* la cuenta ya no existe */ }
    await stopRealtime();
    resetCloudState();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}
