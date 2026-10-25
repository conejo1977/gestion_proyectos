/* ============================================================================
   RentaMaq · Operaciones en la nube
   ----------------------------------------------------------------------------
   Creación y actualización de alquileres, mensajes, incidencias, favoritos,
   equipos y fotografías. Cada función devuelve { ok, ... } para que la
   interfaz pueda mostrar un mensaje claro cuando algo falla.
   ========================================================================== */

'use strict';

const dataClient = () => {
  if (!sb) throw new Error('No se pudo conectar con la base de datos.');
  if (!authUser) throw new Error('Tu sesión no está activa.');
  return sb;
};

const dataFail = (error) => {
  console.error('RentaMaq · operación', error);
  return { ok: false, error: friendlyError(error) };
};

/* ------------------------------ Alquileres ------------------------------- */

async function createBookingRecord({ equipmentId, status, start, end, withOperator, withTransport, project, address }) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Vuelve a iniciar sesión para continuar.' };

  try {
    const client = dataClient();
    const { data, error } = await client.from('bookings').insert({
      equipment_id: equipmentId,
      client_id: user.id,
      status,
      start_date: start,
      end_date: end,
      operator: withOperator ? 1 : 0,
      transport: withTransport ? 1 : 0,
      project,
      address
    }).select().single();

    if (error) return dataFail(error);
    return { ok: true, booking: mapBooking(data) };
  } catch (error) {
    return dataFail(error);
  }
}

async function transitionBookingRecord(id, status) {
  try {
    const client = dataClient();
    const { data, error } = await client
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) return dataFail(error);
    return { ok: true, booking: mapBooking(data) };
  } catch (error) {
    return dataFail(error);
  }
}

async function cancelBookingRecord(id) {
  return transitionBookingRecord(id, 'Cancelada');
}

async function registerBookingPayment(id, paymentMethod) {
  try {
    const client = dataClient();
    const { data, error } = await client
      .from('bookings')
      .update({ paid: true, payment_method: paymentMethod })
      .eq('id', id)
      .select()
      .single();
    if (error) return dataFail(error);
    return { ok: true, booking: mapBooking(data) };
  } catch (error) {
    return dataFail(error);
  }
}

async function saveBookingReview({ bookingId, rating, comment }) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Vuelve a iniciar sesión para continuar.' };

  try {
    const client = dataClient();
    const { data, error } = await client.from('reviews').insert({
      booking_id: bookingId,
      client_id: user.id,
      rating: Number(rating),
      comment: String(comment || '').trim()
    }).select().single();

    if (error) return dataFail(error);
    return { ok: true, review: mapReview(data) };
  } catch (error) {
    return dataFail(error);
  }
}

/* ------------------------------- Mensajes -------------------------------- */

async function findOrCreateThread(otherUserId, equipment = null) {
  const user = currentUser();
  if (!user || !otherUserId || otherUserId === user.id) {
    return { ok: false, error: 'No se pudo iniciar la conversación.' };
  }

  const equipmentId = equipment?.id || '';
  const existing = state.threads.find((thread) => (
    thread.participantIds.includes(user.id)
    && thread.participantIds.includes(otherUserId)
    && (thread.equipmentId || '') === equipmentId
  ));
  if (existing) return { ok: true, thread: existing };

  try {
    const client = dataClient();
    const { data, error } = await client.from('threads').insert({
      participant_ids: [user.id, otherUserId],
      equipment_id: equipmentId,
      subject: equipment?.name || 'Consulta general'
    }).select().single();

    if (error) {
      if (String(error.code) === '23505') {
        await refreshCloud({ render: false, silent: true });
        const raced = state.threads.find((thread) => (
          thread.participantIds.includes(user.id)
          && thread.participantIds.includes(otherUserId)
          && (thread.equipmentId || '') === equipmentId
        ));
        if (raced) return { ok: true, thread: raced };
      }
      return dataFail(error);
    }

    const thread = mapThread(data);
    state.threads.unshift(thread);
    return { ok: true, thread };
  } catch (error) {
    return dataFail(error);
  }
}

async function sendMessageRecord(threadId, text) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Vuelve a iniciar sesión para continuar.' };
  const body = String(text || '').trim();
  if (!body) return { ok: false, error: 'Escribe un mensaje antes de enviarlo.' };

  try {
    const client = dataClient();
    const { data, error } = await client.from('messages').insert({
      thread_id: threadId,
      sender_id: user.id,
      body
    }).select().single();
    if (error) return dataFail(error);
    return { ok: true, message: mapMessage(data) };
  } catch (error) {
    return dataFail(error);
  }
}

/* ------------------------------- Favoritos ------------------------------- */

async function toggleFavoriteRecord(equipmentId) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Inicia sesión para guardar favoritos.' };

  const exists = state.favorites.includes(equipmentId);
  try {
    const client = dataClient();
    if (exists) {
      const { error } = await client
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('equipment_id', equipmentId);
      if (error) return dataFail(error);
      state.favorites = state.favorites.filter((id) => id !== equipmentId);
      return { ok: true, added: false };
    }

    const { error } = await client.from('favorites').insert({
      user_id: user.id,
      equipment_id: equipmentId
    });
    if (error) return dataFail(error);
    state.favorites.push(equipmentId);
    return { ok: true, added: true };
  } catch (error) {
    return dataFail(error);
  }
}

/* ------------------------------- Equipos --------------------------------- */

async function createEquipmentRecord(values) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Vuelve a iniciar sesión para continuar.' };

  try {
    const client = dataClient();
    const { data, error } = await client.from('equipment').insert({
      ...values,
      id: `eq-${safeUuid()}`,
      provider_id: user.id
    }).select().single();
    if (error) return dataFail(error);
    return { ok: true, equipment: mapEquipment(data) };
  } catch (error) {
    return dataFail(error);
  }
}

async function updateEquipmentRecord(id, values) {
  try {
    const client = dataClient();
    const { data, error } = await client
      .from('equipment')
      .update(values)
      .eq('id', id)
      .select()
      .single();
    if (error) return dataFail(error);
    return { ok: true, equipment: mapEquipment(data) };
  } catch (error) {
    return dataFail(error);
  }
}

async function setEquipmentAvailability(id, available) {
  return updateEquipmentRecord(id, { available });
}

async function deleteEquipmentRecord(id) {
  try {
    const item = equipmentById(id);
    const client = dataClient();
    const { error } = await client.from('equipment').delete().eq('id', id);
    if (error) return dataFail(error);
    if (item?.image) await deleteStorageImage(item.image);
    state.equipment = state.equipment.filter((entry) => entry.id !== id);
    state.favorites = state.favorites.filter((entry) => entry !== id);
    return { ok: true };
  } catch (error) {
    return dataFail(error);
  }
}

/* --------------------------- Fotografías --------------------------------- */

async function uploadEquipmentImage(blob) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Vuelve a iniciar sesión para continuar.' };
  if (!blob) return { ok: false, error: 'Selecciona una imagen.' };

  try {
    const client = dataClient();
    const path = `${user.id}/${safeUuid()}.jpg`;
    const { error } = await client.storage
      .from(RM_IMAGE_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });

    if (error) return dataFail(error);
    const { data } = client.storage.from(RM_IMAGE_BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl, path };
  } catch (error) {
    return dataFail(error);
  }
}

async function deleteStorageImage(url) {
  const user = currentUser();
  if (!url || !user || !url.includes(`/storage/v1/object/public/${RM_IMAGE_BUCKET}/`)) return;
  const marker = `/storage/v1/object/public/${RM_IMAGE_BUCKET}/`;
  const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length));
  if (!path.startsWith(`${user.id}/`)) return;
  try {
    await dataClient().storage.from(RM_IMAGE_BUCKET).remove([path]);
  } catch (error) {
    console.warn('RentaMaq · no se pudo retirar la fotografía anterior', error);
  }
}

/* ------------------------------- Soporte --------------------------------- */

async function createTicketRecord({ bookingId, subject, priority, description }) {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Vuelve a iniciar sesión para continuar.' };

  try {
    const client = dataClient();
    const { data, error } = await client.from('tickets').insert({
      created_by: user.id,
      booking_id: bookingId || null,
      subject,
      priority,
      description: String(description || '').trim()
    }).select().single();
    if (error) return dataFail(error);
    return { ok: true, ticket: mapTicket(data) };
  } catch (error) {
    return dataFail(error);
  }
}

async function resolveTicketRecord(id) {
  try {
    const client = dataClient();
    const { data, error } = await client
      .from('tickets')
      .update({ status: 'Resuelta' })
      .eq('id', id)
      .select()
      .single();
    if (error) return dataFail(error);
    return { ok: true, ticket: mapTicket(data) };
  } catch (error) {
    return dataFail(error);
  }
}
