/* ============================================================================
   RentaMaq · Alquileres
   ----------------------------------------------------------------------------
   Solicitudes y cotizaciones. El contratista sigue sus operaciones; el
   proveedor confirma, entrega y registra la devolución de sus equipos.
   ========================================================================== */

'use strict';

const BOOKING_STATUSES = ['Todas', 'Cotización', 'Solicitada', 'Confirmada', 'En curso', 'Finalizada', 'Cancelada'];

function bookings() {
  const user = currentUser();
  if (!user) return;
  const provider = isProvider(user);
  const all = visibleBookings(user);
  const list = bookingFilter === 'Todas'
    ? all
    : all.filter((booking) => booking.status === bookingFilter);

  const tabs = BOOKING_STATUSES
    .filter((status) => status !== 'Cotización' || !provider)
    .map((status) => {
      const count = status === 'Todas' ? all.length : all.filter((booking) => booking.status === status).length;
      return `<button data-book-filter="${status}" class="${bookingFilter === status ? 'active' : ''}">${status}${count ? ` · ${count}` : ''}</button>`;
    }).join('');

  const rows = list.map((booking) => {
    const asProvider = booking.providerId === user.id;
    return `
    <tr>
      <td>
        <strong>${esc(booking.equipmentName)}</strong>
        <small>${esc(booking.project)}</small>
        <small>${asProvider ? `Cliente: ${esc(booking.clientName)}` : `Proveedor: ${esc(booking.providerName)}`}</small>
      </td>
      <td>${date(booking.start)}<small>al ${date(booking.end)} · ${booking.days} días</small></td>
      <td>${money(booking.total)}<small>Garantía: ${money(booking.deposit)}</small></td>
      <td>${pill(booking.status)}${booking.paid ? '<small>Forma de pago registrada</small>' : ''}</td>
      <td>
        <button data-booking="${booking.id}">Ver detalle</button>
        ${bookingActions(booking)}
      </td>
    </tr>`;
  }).join('');

  $('#main').innerHTML = heading(
    provider ? 'Solicitudes y alquileres' : 'Mis alquileres',
    provider
      ? 'Revisa las solicitudes de tus equipos y los alquileres que hayas solicitado.'
      : 'Controla cada etapa: cotización, confirmación, entrega y devolución.',
    '<button data-export>Descargar CSV</button>'
  ) + `
    <div class="tabs" style="overflow:auto">${tabs}</div>
    ${list.length
      ? `<div class="panel table-wrap"><table>
          <thead><tr><th>Equipo / obra</th><th>Periodo</th><th>Total servicio</th><th>Estado</th><th>Gestión</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : emptyView({
        title: provider ? 'Aún no hay solicitudes en esta vista' : 'Aún no tienes alquileres en esta vista',
        desc: provider
          ? 'Cuando un contratista solicite uno de tus equipos, aparecerá aquí para que lo confirmes.'
          : 'Explora un equipo, calcula sus costos y guarda una cotización o solicita el alquiler.',
        label: provider ? 'Gestionar mis equipos' : 'Explorar equipos',
        route: provider ? 'equipos' : 'catalogo',
        iconName: 'reservas'
      })}
    <div class="notice">${provider
      ? 'Aquí ves las solicitudes de tus equipos y los alquileres que hayas solicitado con otras cuentas. Confirma solo cuando el equipo y las fechas estén verificados.'
      : 'Solo verás las operaciones de tu cuenta. El proveedor recibe la solicitud, revisa la disponibilidad y confirma el alquiler desde su panel.'}</div>`;

  if (bookingFilter !== 'Todas' && !list.length && all.length) {
    $('#main').insertAdjacentHTML('beforeend', `<p class="muted" style="font-size:13px">No hay operaciones con el estado “${esc(bookingFilter)}”. <button class="text-button" data-book-filter="Todas">Ver todas</button></p>`);
  }
}

function bookingActions(booking) {
  const user = currentUser();
  if (!user || !canManageBooking(booking, user)) return '';
  const asProvider = booking.providerId === user.id;
  const asClient = booking.clientId === user.id;
  const actions = [];

  if (asClient && booking.status === 'Cotización') {
    actions.push(`<button class="primary" data-transition="${booking.id}" data-status="Solicitada">Solicitar</button>`);
  }
  if (asProvider && booking.status === 'Solicitada') {
    actions.push(`<button class="primary" data-transition="${booking.id}" data-status="Confirmada">Confirmar</button>`);
    actions.push(`<button data-cancel="${booking.id}">Rechazar</button>`);
  }
  if (asProvider && booking.status === 'Confirmada') {
    actions.push(`<button class="primary" data-transition="${booking.id}" data-status="En curso">Registrar entrega</button>`);
  }
  if (asProvider && booking.status === 'En curso') {
    actions.push(`<button class="primary" data-transition="${booking.id}" data-status="Finalizada">Registrar devolución</button>`);
  }
  if (asClient && ['Cotización', 'Solicitada', 'Confirmada'].includes(booking.status)) {
    actions.push(`<button data-cancel="${booking.id}">Cancelar</button>`);
  }
  if (asClient && ['Confirmada', 'En curso'].includes(booking.status) && !booking.paid) {
    actions.push(`<button data-pay="${booking.id}">Registrar forma de pago</button>`);
  }
  if (asClient && booking.paid) {
    actions.push(`<button data-pay="${booking.id}">Ver forma de pago</button>`);
  }
  if (asClient && booking.status === 'Finalizada' && !booking.reviewed) {
    actions.push(`<button data-review="${booking.id}">Valorar</button>`);
  }
  return actions.join('');
}

const canCancel = (booking, user = currentUser()) => {
  if (!booking || !user || !canManageBooking(booking, user)) return false;
  if (booking.providerId === user.id) return ['Solicitada', 'Confirmada'].includes(booking.status);
  return ['Cotización', 'Solicitada', 'Confirmada'].includes(booking.status);
};

async function transition(id, status, button = null) {
  const booking = bookingById(id);
  const user = currentUser();
  if (!booking || !user) return;
  if (!canManageBooking(booking, user)) {
    toast('Esta operación pertenece a otra cuenta.');
    return;
  }

  const allowed = {
    Cotización: ['Solicitada'],
    Solicitada: ['Confirmada'],
    Confirmada: ['En curso'],
    'En curso': ['Finalizada']
  };
  if (!allowed[booking.status]?.includes(status)) {
    toast('Ese cambio de estado no está permitido.');
    return;
  }

  if (status === 'Solicitada') {
    if (booking.clientId !== user.id) {
      toast('Solo el contratista puede convertir una cotización en solicitud.');
      return;
    }
  } else if (booking.providerId !== user.id) {
    toast('Esta etapa la gestiona el proveedor desde su cuenta.');
    return;
  }

  if (status === 'Confirmada') {
    const item = equipmentById(booking.equipmentId);
    if (!item) {
      toast('El equipo ya no está disponible en el catálogo.');
      return;
    }
    if (!available(item, booking.start, booking.end)) {
      toast('Hay otra reserva confirmada en esas fechas. Coordina una alternativa antes de confirmar.');
      return;
    }
  }

  await withBusy(button, 'Guardando…', async () => {
    const result = await transitionBookingRecord(id, status);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    await refreshCloud({ render: false, silent: true });
    closeModal();
    render();
    toast(`Estado actualizado: ${status}.`);
  });
}

async function cancelBooking(id, button = null) {
  const booking = bookingById(id);
  if (!booking) return;
  if (!canCancel(booking)) {
    toast('No puedes cancelar esta operación en su estado actual.');
    return;
  }
  const user = currentUser();
  const asProvider = booking.providerId === user.id && booking.clientId !== user.id;
  modal(asProvider ? 'Rechazar solicitud' : 'Cancelar operación', `
    <p>${asProvider ? '¿Quieres rechazar' : '¿Quieres cancelar'} la operación <strong>${esc(booking.id)}</strong> de ${esc(booking.equipmentName)}?</p>
    <p class="muted">Se conservará en el historial con estado Cancelada. La otra parte verá el cambio de inmediato.</p>
    <div class="form-actions">
      <button data-booking="${booking.id}">Volver</button>
      <button class="primary" id="confirmCancel">${asProvider ? 'Rechazar solicitud' : 'Cancelar operación'}</button>
    </div>`);
  $('#confirmCancel').onclick = (event) => withBusy(event.currentTarget, 'Guardando…', async () => {
    const result = await cancelBookingRecord(booking.id);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    await refreshCloud({ render: false, silent: true });
    closeModal();
    render();
    toast(asProvider ? 'Solicitud rechazada.' : 'Operación cancelada.');
  });
  if (button) button.disabled = false;
}

function bookingDetail(id) {
  const booking = bookingById(id);
  const user = currentUser();
  if (!booking || !user) return;
  if (!canManageBooking(booking, user)) {
    toast('No tienes acceso a esta operación.');
    return;
  }

  const asProvider = booking.providerId === user.id && booking.clientId !== user.id;
  const otherUserId = asProvider ? booking.clientId : booking.providerId;
  const otherUser = userById(otherUserId);
  const item = equipmentById(booking.equipmentId);
  const review = state.reviews.find((entry) => entry.bookingId === booking.id);

  modal(`Resumen de alquiler · ${booking.id}`, `
    <div class="print-only"><h1>RentaMaq · Resumen de alquiler</h1></div>
    <div class="page-heading">
      <div><h2>${esc(booking.equipmentName)}</h2><p>${esc(booking.providerName)}</p></div>
      ${pill(booking.status)}
    </div>
    <div class="detail-specs">
      ${[['Código', booking.id], ['Contratista', booking.clientName], ['Obra', booking.project], ['Dirección', booking.address], ['Inicio', date(booking.start)], ['Devolución', date(booking.end)]]
        .map(([key, value]) => `<div class="overflow-text"><small>${key}</small>${esc(value)}</div>`).join('')}
    </div>
    <div class="two-col" style="margin-top:22px">
      <div>
        <h3>Condiciones de la operación</h3>
        <p class="muted" style="font-size:14px">${booking.days} jornadas de 8 horas. ${booking.operator ? 'Incluye operador.' : 'Operador no incluido.'} ${booking.transport ? 'Traslado incluido.' : 'Recojo por el cliente.'} Combustible y horas extra no incluidos.</p>
        <p class="muted" style="font-size:14px">La garantía se devuelve después de verificar el estado del equipo. Cualquier incidencia se evalúa con el proveedor antes de definir el ajuste.</p>
        ${otherUser ? `<div class="mini-profile" style="margin:14px 0">
          <span class="avatar">${esc(initials(otherUser.name))}</span>
          <div><strong>${esc(displayName(otherUser))}</strong><small>${asProvider ? 'Contratista' : 'Proveedor'}${otherUser.city ? ` · ${esc(otherUser.city)}` : ''}</small></div>
        </div>` : ''}
        ${booking.paid ? `<div class="info-strip"><b>Forma de pago acordada:</b> ${esc(booking.paymentMethod || 'Registrada')} · ${money(booking.total + booking.deposit)}</div>` : ''}
        ${review ? `<div class="notice">Valoración del contratista: <strong>${'★'.repeat(Number(review.rating))}</strong> ${esc(review.comment)}</div>` : ''}
        <div class="notice">Este resumen lo genera RentaMaq con la información registrada por ambas partes. No sustituye el contrato ni la verificación del estado del equipo al entregarlo.</div>
      </div>
      <div>${costRows(booking)}</div>
    </div>
    <div class="form-actions no-print">
      <button data-print>Imprimir / guardar PDF</button>
      ${otherUserId ? `<button data-contact-user="${otherUserId}">✉ Contactar ${asProvider ? 'al cliente' : 'al proveedor'}</button>` : ''}
      ${bookingActions(booking)}
    </div>
    ${!item ? '<p class="muted" style="font-size:12px;margin-top:14px">El anuncio original ya no está en el catálogo; se conservan los datos de la operación.</p>' : ''}`);
}

function payBooking(id) {
  const booking = bookingById(id);
  const user = currentUser();
  if (!booking || !user) return;
  if (!canManageBooking(booking, user) || booking.clientId !== user.id) {
    toast('La forma de pago la registra el contratista de la operación.');
    return;
  }
  if (!['Confirmada', 'En curso', 'Finalizada'].includes(booking.status)) {
    toast('La forma de pago se registra cuando el proveedor confirma la solicitud.');
    return;
  }
  if (booking.paid) {
    modal('Forma de pago acordada', `
      <div class="center"><div class="success-icon">✓</div><h2>${money(booking.total + booking.deposit)}</h2><p>Servicio ${money(booking.total)} + garantía ${money(booking.deposit)}</p></div>
      <div class="info-strip"><b>Registrada:</b> ${esc(booking.paymentMethod || 'Forma de pago indicada')} · ${formatDateTime(booking.paidAt || booking.created)}</div>
      <div class="notice">RentaMaq deja constancia de la forma de pago acordada entre las partes. La transferencia o el cobro se realiza directamente entre contratista y proveedor.</div>`);
    return;
  }

  modal('Forma de pago acordada', `
    <div class="center"><h2>${money(booking.total + booking.deposit)}</h2><p>Servicio ${money(booking.total)} + garantía ${money(booking.deposit)}</p></div>
    <div class="notice">No ingreses números de tarjeta ni claves bancarias. Este registro solo documenta el medio acordado con el proveedor.</div>
    <div class="field"><label for="paymentMethod">Medio acordado</label>
      <select id="paymentMethod">
        <option>Transferencia bancaria</option>
        <option>Yape / Plin</option>
        <option>Efectivo</option>
        <option>Cheque</option>
        <option>Otro medio coordinado</option>
      </select>
    </div>
    <div class="field" style="margin-top:14px"><label for="paymentNote">Nota para la otra parte (opcional)</label><input id="paymentNote" maxlength="120" placeholder="Ej. Pago coordinado al iniciar la entrega"></div>
    <div class="form-actions"><button class="primary" id="confirmPay">Registrar forma de pago</button></div>`);

  $('#confirmPay').onclick = (event) => withBusy(event.currentTarget, 'Guardando…', async () => {
    const note = $('#paymentNote')?.value.trim();
    const method = note ? `${$('#paymentMethod').value} · ${note}` : $('#paymentMethod').value;
    const result = await registerBookingPayment(booking.id, method.slice(0, 160));
    if (!result.ok) {
      toast(result.error);
      return;
    }
    await refreshCloud({ render: false, silent: true });
    closeModal();
    render();
    toast('Forma de pago registrada para ambas partes.');
  });
}

function reviewBooking(id) {
  const booking = bookingById(id);
  const user = currentUser();
  if (!booking || !user) return;
  if (booking.clientId !== user.id) {
    toast('Solo el contratista puede valorar el servicio.');
    return;
  }
  if (booking.status !== 'Finalizada') {
    toast('La valoración se habilita cuando el alquiler finaliza.');
    return;
  }
  if (booking.reviewed) {
    toast('Esta operación ya tiene una valoración.');
    return;
  }

  modal('Valorar el servicio', `
    <form id="reviewForm">
      <p>${esc(booking.equipmentName)} · ${esc(booking.providerName)}</p>
      <div class="field"><label for="rating">Tu valoración</label>
        <select id="rating" name="rating">
          <option value="5">★★★★★ · Excelente</option>
          <option value="4">★★★★ · Bueno</option>
          <option value="3">★★★ · Regular</option>
          <option value="2">★★ · Deficiente</option>
          <option value="1">★ · Muy deficiente</option>
        </select>
      </div>
      <div class="field" style="margin-top:18px"><label for="comment">Comentario</label><textarea id="comment" name="comment" maxlength="1000" required placeholder="Describe el estado del equipo, la puntualidad y la coordinación."></textarea></div>
      <div class="form-actions"><button class="primary">Publicar valoración</button></div>
    </form>`);

  $('#reviewForm').onsubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    withBusy(form.querySelector('[type="submit"]'), 'Publicando…', async () => {
      const result = await saveBookingReview({
        bookingId: booking.id,
        rating: data.rating,
        comment: data.comment
      });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      await refreshCloud({ render: false, silent: true });
      closeModal();
      render();
      toast('Valoración publicada. El promedio del equipo quedó actualizado.');
    });
  };
}

function exportCSV() {
  const rows = [
    ['Código', 'Equipo', 'Obra', 'Contratista', 'Proveedor', 'Inicio', 'Fin', 'Estado', 'Total servicio PEN', 'Garantía PEN', 'Forma de pago'],
    ...visibleBookings().map((booking) => [
      booking.id,
      booking.equipmentName,
      booking.project,
      booking.clientName,
      booking.providerName,
      booking.start,
      booking.end,
      booking.status,
      booking.total,
      booking.deposit,
      booking.paymentMethod
    ])
  ];
  const cell = (value) => `"${String(value ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""')}"`;
  download('RentaMaq-alquileres.csv', `\ufeff${rows.map((row) => row.map(cell).join(';')).join('\r\n')}`, 'text/csv;charset=utf-8');
  toast('Se descargó el historial de alquileres de tu cuenta.');
}
