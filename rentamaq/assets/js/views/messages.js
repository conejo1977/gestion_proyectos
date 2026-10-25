/* ============================================================================
   RentaMaq · Mensajes
   ----------------------------------------------------------------------------
   Conversaciones locales entre contratistas y proveedores. Cada hilo reúne a
   dos cuentas del navegador y conserva el equipo sobre el que se consulta.
   ========================================================================== */

'use strict';

function messages() {
  const user = currentUser();
  if (!user) return;
  const threads = visibleThreads(user);

  if (threadId && !threads.some((thread) => thread.id === threadId)) threadId = null;
  if (!threadId && threads.length) threadId = threads[0].id;
  const active = threadById(threadId);
  const partner = active ? threadPartner(active, user) : null;

  $('#main').innerHTML = heading(
    'Mensajes',
    'Coordina disponibilidad, condiciones y entrega con la otra parte.',
    isProvider(user) ? '<button class="primary" data-route="equipos">Gestionar mis equipos</button>' : '<button data-route="catalogo">Buscar equipos</button>'
  ) + `
    <div class="notice">Las conversaciones se guardan en este navegador y no se envían a personas reales. Las respuestas automáticas están identificadas.</div>
    ${threads.length ? `
      <div class="message-layout">
        <aside class="threads">
          ${threads.map((thread) => {
            const other = threadPartner(thread, user);
            const last = thread.messages[thread.messages.length - 1];
            return `<button class="thread ${thread.id === threadId ? 'active' : ''}" data-thread="${thread.id}">
              <strong>${esc(displayName(other) || 'Conversación')}</strong>
              <small>${esc(thread.subject || 'Consulta general')}</small>
              <small>${last ? esc(last.text.length > 46 ? `${last.text.slice(0, 46)}…` : last.text) : 'Sin mensajes'} · ${last ? formatDateTime(last.at) : ''}</small>
            </button>`;
          }).join('')}
        </aside>
        <section class="conversation">
          ${active ? `
            <div class="chat-head">
              <div class="thread-head">
                <strong>${esc(displayName(partner) || 'Conversación')}</strong>
                ${partner ? roleBadge(partner.role) : ''}
              </div>
              <small>${active.subject ? `Sobre: ${esc(active.subject)}` : 'Consulta general'}${partner ? ` · ${esc(partner.city || '')}` : ''}</small>
              ${active.equipmentId && equipmentById(active.equipmentId) ? `<button class="text-button" style="margin-top:6px" data-detail="${active.equipmentId}">Ver ficha del equipo</button>` : ''}
            </div>
            <div class="chat-log" id="chatLog">
              ${active.messages.length
                ? active.messages.map((message) => `
                  <div class="bubble ${message.userId === user.id ? 'mine' : ''}">
                    ${esc(message.text)}
                    <small>${formatDateTime(message.at)}${message.automatic ? ' · respuesta automática de demostración' : ''}</small>
                  </div>`).join('')
                : '<div class="chat-empty">Todavía no hay mensajes. Escribe el primero para coordinar los detalles.</div>'}
            </div>
            <form class="chat-form" id="chatForm">
              <input aria-label="Escribe un mensaje" placeholder="Escribe tu consulta…" maxlength="1500" required autocomplete="off">
              <button class="primary">Enviar</button>
            </form>`
            : '<div class="chat-empty">Selecciona una conversación para ver los mensajes.</div>'}
        </section>
      </div>`
      : emptyView({
        title: 'Aún no tienes conversaciones',
        desc: isProvider(user)
          ? 'Cuando un contratista consulte por uno de tus equipos, la conversación aparecerá aquí.'
          : 'Abre la ficha de un equipo y usa “Consultar al proveedor” para iniciar una conversación.',
        label: isProvider(user) ? 'Ver mis equipos' : 'Explorar equipos',
        route: isProvider(user) ? 'equipos' : 'catalogo',
        iconName: 'mensajes'
      })}`;

  const log = $('#chatLog');
  if (log) log.scrollTop = log.scrollHeight;

  const form = $('#chatForm');
  if (form && active) {
    form.onsubmit = (event) => {
      event.preventDefault();
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      const now = new Date().toISOString();
      active.messages.push({ id: `msg_${uid()}`, userId: user.id, text, at: now });
      input.value = '';
      saveDB();
      renderMessagesOnly();
      scheduleAutoReply(active, partner);
      toast('Mensaje guardado en esta conversación local.');
    };
  }
}

function renderMessagesOnly() {
  if (route === 'mensajes') {
    messages();
    const log = $('#chatLog');
    if (log) log.scrollTop = log.scrollHeight;
  }
}

function scheduleAutoReply(thread, partner) {
  if (!partner) return;
  const text = partner.role === 'proveedor'
    ? 'Gracias por escribir. Revisé tu consulta y puedo coordinar disponibilidad, entrega y condiciones. Si quieres reservar, revisa la ficha del equipo y envía una solicitud; la confirmaré desde mi cuenta de proveedor.'
    : 'Gracias por la información. Revisaré la propuesta con el equipo de obra y te confirmo por este medio. Si hay cambios de fechas o dirección, avísame con anticipación.';
  setTimeout(() => {
    thread.messages.push({
      id: `msg_${uid()}`,
      userId: partner.id,
      text,
      at: new Date().toISOString(),
      automatic: true
    });
    saveDB();
    if (route === 'mensajes' && threadId === thread.id) renderMessagesOnly();
  }, 700);
}

function contactUser(userId) {
  const thread = findOrCreateThread(userId);
  if (!thread) {
    toast('No se pudo iniciar la conversación.');
    return;
  }
  threadId = thread.id;
  closeModal();
  if (route === 'mensajes') messages();
  else navigate('mensajes');
}
