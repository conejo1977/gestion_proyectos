/* ============================================================================
   RentaMaq · Mensajes
   ----------------------------------------------------------------------------
   Conversaciones entre contratistas y proveedores. Cada hilo se sincroniza en
   la nube, reúne a dos cuentas y conserva el equipo sobre el que se consulta.
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
    <div class="notice">Las conversaciones se sincronizan en la nube y solo las ven las dos cuentas participantes. No compartas datos de pago sensibles por este medio.</div>
    ${threads.length ? `
      <div class="message-layout">
        <aside class="threads">
          ${threads.map((thread) => {
            const other = threadPartner(thread, user);
            const last = thread.messages[thread.messages.length - 1];
            return `<button class="thread ${thread.id === threadId ? 'active' : ''}" data-thread="${thread.id}">
              <strong>${esc(displayName(other) || 'Conversación')}</strong>
              <small>${esc(thread.subject || 'Consulta general')}</small>
              <small>${last ? esc(last.text.length > 46 ? `${last.text.slice(0, 46)}…` : last.text) : 'Sin mensajes'}${last ? ` · ${formatDateTime(last.at)}` : ''}</small>
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
              <small>${active.subject ? `Sobre: ${esc(active.subject)}` : 'Consulta general'}${partner?.city ? ` · ${esc(partner.city)}` : ''}</small>
              ${active.equipmentId && equipmentById(active.equipmentId) ? `<button class="text-button" style="margin-top:6px" data-detail="${active.equipmentId}">Ver ficha del equipo</button>` : ''}
            </div>
            <div class="chat-log" id="chatLog">
              ${active.messages.length
                ? active.messages.map((message) => `
                  <div class="bubble ${message.userId === user.id ? 'mine' : ''}">
                    ${esc(message.text)}
                    <small>${formatDateTime(message.at)}</small>
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
      const button = form.querySelector('button');
      const text = input.value.trim();
      if (!text) return;

      withBusy(button, 'Enviando…', async () => {
        const result = await sendMessageRecord(active.id, text);
        if (!result.ok) {
          toast(result.error);
          return;
        }
        const thread = threadById(active.id);
        if (thread) {
          thread.messages.push(result.message);
          thread.updatedAt = result.message.at;
        }
        input.value = '';
        renderMessagesOnly();
        refreshCloud({ render: false, silent: true });
      });
    };
  }
}

function renderMessagesOnly() {
  if (route !== 'mensajes') return;
  messages();
  const log = $('#chatLog');
  if (log) log.scrollTop = log.scrollHeight;
}

async function contactUser(userId, button = null) {
  await withBusy(button, 'Abriendo…', async () => {
    const result = await findOrCreateThread(userId);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    threadId = result.thread.id;
    closeModal();
    if (route === 'mensajes') messages();
    else navigate('mensajes');
  });
}
