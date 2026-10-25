/* ============================================================================
   RentaMaq · Almacenamiento local
   ----------------------------------------------------------------------------
   Una sola base de datos en localStorage para que las cuentas de una misma
   computadora compartan catálogo, solicitudes y mensajes. La sesión se guarda
   aparte para poder iniciar y cerrar sesión sin alterar los datos.
   ========================================================================== */

'use strict';

const DB_KEY = 'rentamaq-db-v2';
const SESSION_KEY = 'rentamaq-session-v2';

let state = null;
let session = null;

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const randomToken = () => {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${uid()}${uid()}`;
  }
};

const publicUser = (user) => {
  if (!user) return null;
  const { passwordHash, salt, recoveryAnswerHash, ...safe } = user;
  return safe;
};

function buildSeedUser(seedUser) {
  const salt = `demo-${seedUser.id}`;
  return {
    id: seedUser.id,
    name: seedUser.name,
    email: seedUser.email.toLowerCase(),
    role: seedUser.role,
    company: seedUser.company || '',
    phone: seedUser.phone || '',
    city: seedUser.city || '',
    ruc: seedUser.ruc || '',
    verified: Boolean(seedUser.verified),
    verifiedAt: seedUser.verified ? seedUser.createdAt : null,
    demo: true,
    createdAt: seedUser.createdAt,
    recoveryQuestion: seedUser.recoveryQuestion || '',
    salt,
    passwordHash: hashPassword(salt, seedUser.password),
    recoveryAnswerHash: hashPassword(salt, normalize(seedUser.recoveryAnswer || ''))
  };
}

function buildSeedBooking(template) {
  const equipment = RM_SEED_EQUIPMENT.find((item) => item.id === template.equipmentId);
  const client = RM_SEED_USERS.find((user) => user.id === template.clientId);
  const provider = RM_SEED_USERS.find((user) => user.id === template.providerId);
  const start = addDays(today(), template.startOffset);
  const end = addDays(today(), template.endOffset);
  const days = daysBetween(start, end);
  const base = round2(equipment.price * days);
  const operator = template.withOperator ? round2(equipment.operator * days) : 0;
  const transport = template.withTransport ? round2(equipment.transport) : 0;
  const fee = round2(base * 0.05);

  return {
    id: template.id,
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    equipmentCategory: equipment.category,
    providerId: template.providerId,
    providerName: equipment.provider,
    clientId: template.clientId,
    clientName: client.name,
    clientCompany: client.company,
    status: template.status,
    start,
    end,
    days,
    base,
    operator,
    transport,
    fee,
    total: round2(base + operator + transport + fee),
    deposit: equipment.deposit,
    project: template.project,
    address: template.address,
    created: new Date(Date.now() - template.createdHoursAgo * 3600 * 1000).toISOString(),
    paid: Boolean(template.paid),
    paymentMethod: template.paid ? 'Transferencia bancaria demo' : '',
    reviewed: Boolean(template.reviewed)
  };
}

function buildInitialDB() {
  const users = RM_SEED_USERS.map(buildSeedUser);
  const equipment = RM_SEED_EQUIPMENT.map((item) => ({ ...item }));
  const bookings = RM_SEED_BOOKINGS.map(buildSeedBooking);
  const threads = RM_SEED_THREADS.map((thread) => ({
    ...thread,
    participantIds: [...thread.participantIds],
    messages: thread.messages.map((message) => ({ ...message }))
  }));

  return {
    version: 2,
    createdAt: new Date().toISOString(),
    users,
    equipment,
    bookings,
    threads,
    tickets: [],
    reviews: [],
    favorites: { u_cliente_demo: ['eq1', 'eq3'] }
  };
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2 && Array.isArray(parsed.users) && Array.isArray(parsed.equipment)) {
        state = parsed;
        state.bookings = Array.isArray(state.bookings) ? state.bookings : [];
        state.threads = Array.isArray(state.threads) ? state.threads : [];
        state.tickets = Array.isArray(state.tickets) ? state.tickets : [];
        state.reviews = Array.isArray(state.reviews) ? state.reviews : [];
        state.favorites = state.favorites && typeof state.favorites === 'object' ? state.favorites : {};
        return state;
      }
    }
  } catch (error) {
    console.warn('No se pudo leer la base local de RentaMaq:', error);
  }

  state = buildInitialDB();
  saveDB({ silent: true });
  return state;
}

function saveDB(options = {}) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('No se pudo guardar RentaMaq:', error);
    if (!options.silent) {
      toast('No se pudo guardar: el navegador se quedó sin espacio. Prueba con una imagen más liviana o elimina equipos antiguos.');
    }
    return false;
  }
}

function resetDB() {
  state = buildInitialDB();
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* sin sesión */ }
  session = null;
  saveDB({ silent: true });
  return state;
}

/* ------------------------------- Sesión ---------------------------------- */

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      session = null;
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !state.users.some((user) => user.id === parsed.userId)) {
      session = null;
      return null;
    }
    session = parsed;
    return session;
  } catch {
    session = null;
    return null;
  }
}

function startSession(userId, remember = true) {
  session = {
    userId,
    token: randomToken(),
    since: new Date().toISOString(),
    remember: Boolean(remember)
  };
  const raw = JSON.stringify(session);
  try {
    if (remember) {
      localStorage.setItem(SESSION_KEY, raw);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, raw);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    toast('La sesión no se pudo recordar en este navegador.');
  }
  return session;
}

function endSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* sin sesión */ }
  session = null;
}

/* ----------------------------- Consultas --------------------------------- */

const currentUser = () => session ? state.users.find((user) => user.id === session.userId) || null : null;
const userById = (id) => state.users.find((user) => user.id === id) || null;
const equipmentById = (id) => state.equipment.find((item) => item.id === id) || null;
const bookingById = (id) => state.bookings.find((item) => item.id === id) || null;
const threadById = (id) => state.threads.find((item) => item.id === id) || null;

const isProvider = (user = currentUser()) => user?.role === 'proveedor';

const displayName = (user) => user?.company || user?.name || 'Proveedor';

const favoritesOf = (userId) => {
  if (!state.favorites[userId]) state.favorites[userId] = [];
  return state.favorites[userId];
};

const isFavorite = (equipmentId) => {
  const user = currentUser();
  return user ? favoritesOf(user.id).includes(equipmentId) : false;
};

const myEquipment = (user = currentUser()) => user
  ? state.equipment.filter((item) => item.providerId === user.id)
  : [];

const visibleBookings = (user = currentUser()) => {
  if (!user) return [];
  return isProvider(user)
    ? state.bookings.filter((booking) => booking.providerId === user.id && booking.status !== 'Cotización')
    : state.bookings.filter((booking) => booking.clientId === user.id);
};

const visibleThreads = (user = currentUser()) => {
  if (!user) return [];
  return state.threads
    .filter((thread) => thread.participantIds.includes(user.id))
    .sort((a, b) => {
      const lastA = a.messages[a.messages.length - 1]?.at || a.createdAt;
      const lastB = b.messages[b.messages.length - 1]?.at || b.createdAt;
      return new Date(lastB) - new Date(lastA);
    });
};

const visibleTickets = (user = currentUser()) => {
  if (!user) return [];
  return state.tickets.filter((ticket) => {
    if (ticket.createdBy === user.id) return true;
    const booking = bookingById(ticket.bookingId);
    return Boolean(booking && booking.providerId === user.id);
  });
};

const pendingRequestsCount = (user = currentUser()) => {
  if (!user) return 0;
  if (isProvider(user)) {
    return state.bookings.filter((booking) => booking.providerId === user.id && booking.status === 'Solicitada').length;
  }
  return state.bookings.filter((booking) => booking.clientId === user.id && ['Cotización', 'Solicitada', 'Confirmada'].includes(booking.status)).length;
};

const threadPartner = (thread, user = currentUser()) => {
  const otherId = thread.participantIds.find((id) => id !== user?.id);
  return userById(otherId);
};

function findOrCreateThread(otherUserId, equipment = null) {
  const user = currentUser();
  if (!user || !otherUserId) return null;
  let thread = state.threads.find((item) => (
    item.participantIds.includes(user.id) && item.participantIds.includes(otherUserId)
    && (!equipment || item.equipmentId === equipment.id)
  ));
  if (thread) return thread;

  thread = {
    id: `th_${uid()}`,
    participantIds: [user.id, otherUserId],
    equipmentId: equipment?.id || '',
    subject: equipment?.name || 'Consulta general',
    createdAt: new Date().toISOString(),
    messages: [{
      userId: otherUserId,
      text: equipment
        ? `Hola, gracias por tu interés en "${equipment.name}". Escríbeme tu consulta y coordinamos disponibilidad, entrega y condiciones.`
        : 'Hola, envíame tu consulta y la revisamos juntos.',
      at: new Date().toISOString(),
      automatic: true
    }]
  };
  state.threads.unshift(thread);
  saveDB();
  return thread;
}

function recomputeEquipmentRating(equipmentId) {
  const item = equipmentById(equipmentId);
  if (!item) return;
  const reviews = state.reviews.filter((review) => review.equipmentId === equipmentId);
  if (!reviews.length) return;
  item.rating = Math.round((reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length) * 10) / 10;
}

function toggleFavorite(equipmentId) {
  const user = currentUser();
  if (!user) return false;
  const list = favoritesOf(user.id);
  const index = list.indexOf(equipmentId);
  if (index >= 0) list.splice(index, 1);
  else list.push(equipmentId);
  saveDB();
  return index < 0;
}

function nextBookingId() {
  const base = `RM-${uid().slice(-6).toUpperCase()}`;
  return bookingById(base) ? `${base}-${Math.floor(Math.random() * 90 + 10)}` : base;
}

function canManageBooking(booking, user = currentUser()) {
  if (!booking || !user) return false;
  return isProvider(user) ? booking.providerId === user.id : booking.clientId === user.id;
}
