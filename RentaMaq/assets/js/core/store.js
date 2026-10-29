/* ============================================================================
   RentaMaq · Estado compartido y sincronización
   ----------------------------------------------------------------------------
   Mantiene en memoria el catálogo, las operaciones, las conversaciones y los
   perfiles que llegan desde Supabase. La sesión la administra Supabase Auth y
   todo lo demás vive en la nube.
   ========================================================================== */

'use strict';

let authUser = null;
let state = {
  profile: null,
  profiles: [],
  equipment: [],
  bookings: [],
  threads: [],
  tickets: [],
  reviews: [],
  favorites: [],
  loaded: false
};

let dataChannel = null;
let refreshTimer = null;
let refreshInFlight = false;
let refreshAgain = false;
let lastSyncAt = 0;

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeUuid = () => {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch { /* continúa con el respaldo */ }
  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
};

const mapProfile = (row) => ({
  id: row.id,
  name: row.name || 'Usuario',
  role: row.role === 'proveedor' ? 'proveedor' : 'cliente',
  company: row.company || '',
  phone: row.phone || '',
  city: row.city || '',
  ruc: row.ruc || '',
  verified: Boolean(row.verified),
  verifiedAt: row.verified_at || null,
  createdAt: row.created_at || new Date().toISOString()
});

const mapEquipment = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  price: number(row.price),
  city: row.city,
  district: row.district || '',
  providerId: row.provider_id,
  provider: row.provider_name || '',
  image: row.image || '',
  available: Boolean(row.available),
  verified: Boolean(row.verified),
  year: number(row.year),
  hours: number(row.hours),
  capacity: row.capacity || '',
  power: row.power || '',
  rating: number(row.rating),
  transport: number(row.transport),
  deposit: number(row.deposit),
  operator: number(row.operator),
  description: row.description || '',
  custom: Boolean(row.custom),
  createdAt: row.created_at || null
});

const mapBooking = (row) => ({
  id: row.id,
  equipmentId: row.equipment_id || '',
  equipmentName: row.equipment_name || 'Equipo',
  equipmentCategory: row.equipment_category || '',
  providerId: row.provider_id,
  providerName: row.provider_name || '',
  clientId: row.client_id,
  clientName: row.client_name || '',
  clientCompany: row.client_company || '',
  status: row.status,
  start: row.start_date,
  end: row.end_date,
  days: number(row.days),
  base: number(row.base),
  operator: number(row.operator),
  transport: number(row.transport),
  fee: number(row.fee),
  total: number(row.total),
  deposit: number(row.deposit),
  project: row.project || '',
  address: row.address || '',
  created: row.created_at,
  paid: Boolean(row.paid),
  paymentMethod: row.payment_method || '',
  paidAt: row.paid_at || null,
  reviewed: Boolean(row.reviewed),
  startedAt: row.started_at || null,
  finishedAt: row.finished_at || null,
  cancelledAt: row.cancelled_at || null,
  cancelledBy: row.cancelled_by || null
});

const mapThread = (row) => ({
  id: row.id,
  participantIds: Array.isArray(row.participant_ids) ? row.participant_ids : [],
  equipmentId: row.equipment_id || '',
  subject: row.subject || 'Consulta general',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  messages: []
});

const mapMessage = (row) => ({
  id: row.id,
  threadId: row.thread_id,
  userId: row.sender_id,
  text: row.body,
  at: row.created_at
});

const mapTicket = (row) => ({
  id: row.id,
  createdBy: row.created_by,
  bookingId: row.booking_id || '',
  subject: row.subject,
  priority: row.priority,
  description: row.description,
  status: row.status,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at || null,
  resolvedBy: row.resolved_by || null
});

const mapReview = (row) => ({
  id: row.id,
  bookingId: row.booking_id,
  equipmentId: row.equipment_id || '',
  providerId: row.provider_id,
  clientId: row.client_id,
  rating: number(row.rating),
  comment: row.comment || '',
  created: row.created_at
});

/* --------------------------- Consultas en memoria ------------------------ */

const currentUser = () => state.profile;

const userById = (id) => {
  if (!id) return null;
  if (state.profile?.id === id) return state.profile;
  return state.profiles.find((profile) => profile.id === id) || null;
};

const equipmentById = (id) => state.equipment.find((item) => item.id === id) || null;
const bookingById = (id) => state.bookings.find((item) => item.id === id) || null;
const threadById = (id) => state.threads.find((item) => item.id === id) || null;
const ticketById = (id) => state.tickets.find((item) => item.id === id) || null;

const isProvider = (user = currentUser()) => user?.role === 'proveedor';
const displayName = (user) => user?.company || user?.name || 'Cuenta RentaMaq';

const favoritesOf = () => state.favorites;

const isFavorite = (equipmentId) => state.favorites.includes(equipmentId);

const myEquipment = (user = currentUser()) => (user
  ? state.equipment.filter((item) => item.providerId === user.id)
  : []);

const bookingRole = (booking, user = currentUser()) => {
  if (!booking || !user) return null;
  if (booking.clientId === user.id) return 'client';
  if (booking.providerId === user.id) return 'provider';
  return null;
};

const incomingBookings = (user = currentUser()) => (!user
  ? []
  : state.bookings.filter((booking) => booking.providerId === user.id && booking.status !== 'Cotización'));

const outgoingBookings = (user = currentUser()) => (!user
  ? []
  : state.bookings.filter((booking) => booking.clientId === user.id));

const visibleBookings = (user = currentUser()) => {
  if (!user) return [];
  return state.bookings.filter((booking) => (
    booking.clientId === user.id
    || (booking.providerId === user.id && booking.status !== 'Cotización')
  ));
};

const visibleThreads = (user = currentUser()) => {
  if (!user) return [];
  return state.threads
    .filter((thread) => thread.participantIds.includes(user.id))
    .sort((a, b) => {
      const lastA = a.messages[a.messages.length - 1]?.at || a.updatedAt || a.createdAt;
      const lastB = b.messages[b.messages.length - 1]?.at || b.updatedAt || b.createdAt;
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
  return state.bookings.filter((booking) => (
    booking.clientId === user.id && ['Cotización', 'Solicitada', 'Confirmada'].includes(booking.status)
  )).length;
};

const threadPartner = (thread, user = currentUser()) => {
  const otherId = thread?.participantIds.find((id) => id !== user?.id);
  return userById(otherId);
};

const canManageBooking = (booking, user = currentUser()) => Boolean(bookingRole(booking, user));

/* ---------------------------- Carga en la nube --------------------------- */

const requireClient = () => {
  if (!sb) throw new Error('No se pudo iniciar la conexión con la base de datos.');
  return sb;
};

async function fetchCloudData() {
  const client = requireClient();
  if (!authUser) throw new Error('Tu sesión no está activa.');

  const requests = [
    client.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
    client.from('profiles_public').select('*'),
    client.from('equipment').select('*').order('created_at', { ascending: false }),
    client.from('bookings').select('*').order('created_at', { ascending: false }),
    client.from('threads').select('*').order('updated_at', { ascending: false }),
    client.from('messages').select('*').order('created_at', { ascending: true }),
    client.from('tickets').select('*').order('created_at', { ascending: false }),
    client.from('reviews').select('*').order('created_at', { ascending: false }),
    client.from('favorites').select('equipment_id')
  ];

  const [
    ownProfile,
    publicProfiles,
    equipment,
    bookings,
    threads,
    messages,
    tickets,
    reviews,
    favorites
  ] = await Promise.all(requests);

  for (const result of [ownProfile, publicProfiles, equipment, bookings, threads, messages, tickets, reviews, favorites]) {
    if (result.error) throw result.error;
  }

  if (!ownProfile.data) {
    throw new Error('No se encontró el perfil de esta cuenta. Vuelve a iniciar sesión.');
  }

  const profile = mapProfile(ownProfile.data);
  profile.email = authUser.email || '';

  state.profile = profile;
  state.profiles = (publicProfiles.data || []).map(mapProfile);
  if (!state.profiles.some((entry) => entry.id === profile.id)) state.profiles.push(profile);

  state.equipment = (equipment.data || []).map(mapEquipment);
  state.bookings = (bookings.data || []).map(mapBooking);
  state.threads = (threads.data || []).map(mapThread);
  state.tickets = (tickets.data || []).map(mapTicket);
  state.reviews = (reviews.data || []).map(mapReview);
  state.favorites = (favorites.data || []).map((row) => row.equipment_id);

  const messagesByThread = new Map();
  (messages.data || []).map(mapMessage).forEach((message) => {
    if (!messagesByThread.has(message.threadId)) messagesByThread.set(message.threadId, []);
    messagesByThread.get(message.threadId).push(message);
  });
  state.threads.forEach((thread) => {
    thread.messages = messagesByThread.get(thread.id) || [];
  });

  // Los nombres y sellos visibles siguen siempre al perfil actual.
  state.equipment.forEach((item) => {
    const owner = userById(item.providerId);
    if (!owner) return;
    item.provider = displayName(owner);
    item.verified = Boolean(owner.verified);
  });
  state.bookings.forEach((booking) => {
    const client = userById(booking.clientId);
    const provider = userById(booking.providerId);
    if (client) {
      booking.clientName = client.name;
      booking.clientCompany = client.company || '';
    }
    if (provider) booking.providerName = displayName(provider);
  });

  state.loaded = true;
  lastSyncAt = Date.now();
  return state;
}

async function refreshCloud(options = {}) {
  if (!state.profile || !authUser) return;
  if (refreshInFlight) {
    refreshAgain = true;
    return;
  }

  refreshInFlight = true;
  try {
    await fetchCloudData();
    if (options.render !== false) {
      if (typeof softRender === 'function') softRender();
      else if (typeof render === 'function') render();
    }
  } catch (error) {
    console.error('RentaMaq · sincronización', error);
    if (!options.silent) toast(friendlyError(error));
  } finally {
    refreshInFlight = false;
    if (refreshAgain) {
      refreshAgain = false;
      setTimeout(() => refreshCloud({ ...options, silent: true }), 120);
    }
  }
}

function resetCloudState() {
  state = {
    profile: null,
    profiles: [],
    equipment: [],
    bookings: [],
    threads: [],
    tickets: [],
    reviews: [],
    favorites: [],
    loaded: false
  };
  authUser = null;
  lastSyncAt = 0;
}

/* --------------------------- Tiempo real --------------------------------- */

function scheduleCloudRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshCloud({ silent: true }), 700);
}

function startRealtime() {
  if (!sb || dataChannel) return;
  const tables = ['profiles', 'equipment', 'bookings', 'threads', 'messages', 'tickets', 'reviews', 'favorites'];
  dataChannel = sb.channel(`rentamaq-live-${Date.now()}`);
  tables.forEach((table) => {
    dataChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      scheduleCloudRefresh
    );
  });
  dataChannel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn('RentaMaq · la sincronización en tiempo real se reintentará automáticamente.');
    }
  });
}

async function stopRealtime() {
  clearTimeout(refreshTimer);
  refreshTimer = null;
  if (dataChannel && sb) {
    const channel = dataChannel;
    dataChannel = null;
    try {
      await sb.removeChannel(channel);
    } catch { /* el canal ya estaba cerrado */ }
  }
}

/* Refresca al volver a la pestaña para reflejar cambios hechos en otro equipo. */
function bindCloudRefreshEvents() {
  const refreshIfNeeded = () => {
    if (!state.profile || document.visibilityState === 'hidden') return;
    if (Date.now() - lastSyncAt < 20000) return;
    refreshCloud({ silent: true });
  };
  window.addEventListener('focus', refreshIfNeeded);
  document.addEventListener('visibilitychange', refreshIfNeeded);
  window.addEventListener('online', () => {
    if (state.profile) refreshCloud({ silent: true });
  });
  window.addEventListener('offline', () => {
    if (state.profile) toast('Sin conexión. Los cambios se enviarán cuando vuelvas a estar en línea.');
  });
}
