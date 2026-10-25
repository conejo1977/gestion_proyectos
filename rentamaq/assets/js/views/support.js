/* ============================================================================
   RentaMaq · Soporte
   ----------------------------------------------------------------------------
   Registro de incidencias vinculadas a un alquiler, preguntas frecuentes y
   seguimiento local de cada reporte.
   ========================================================================== */

'use strict';

const SUPPORT_FAQ = [
  ['¿Cómo inicio sesión como proveedor?', 'Registra una cuenta y elige “Publicar equipos”, o convierte tu cuenta de contratista desde Mi cuenta. Los proveedores ven un distintivo, administran sus equipos y reciben solicitudes de alquiler.'],
  ['¿Cómo se confirma una solicitud?', 'El contratista envía la solicitud desde la ficha del equipo. El proveedor la recibe en “Solicitudes de alquiler” y puede confirmarla o rechazarla; la aplicación revisa que no exista otra reserva confirmada en las mismas fechas.'],
  ['¿Qué incluye el precio?', 'La tarifa diaria cubre una jornada de 8 horas. El resumen separa operador, traslado, comisión de ejemplo y garantía. El combustible y las horas extra no están incluidos.'],
  ['¿Cómo agrego una fotografía a mi equipo?', 'Desde Mis equipos, elige Publicar o Editar. La fotografía se selecciona desde tu dispositivo, se optimiza en el navegador y se guarda junto con el anuncio.'],
  ['¿Qué hago ante una falla?', 'Detén el uso del equipo si hay riesgo y registra una incidencia aquí. El proveedor puede ver los reportes de sus alquileres y marcarlos como resueltos.'],
  ['¿La garantía es parte del precio?', 'No. Se muestra aparte como un importe reembolsable, sujeto a revisión al devolver el equipo. En este prototipo no se retiene dinero.'],
  ['¿Dónde se guardan mis datos y contraseña?', 'Solo en este navegador. La contraseña se guarda como un hash con sal, no en texto plano, pero al ser una aplicación sin servidor no debe usarse con información sensible real.'],
  ['¿Puedo usar dos cuentas en la misma computadora?', 'Sí. Cierra sesión y entra con otra cuenta. Todas comparten el catálogo, las solicitudes y los mensajes locales, lo que permite probar el flujo completo entre contratista y proveedor.']
];

function support() {
  const user = currentUser();
  if (!user) return;
  const tickets = visibleTickets(user);

  $('#main').innerHTML = heading(
    'Estamos para que tu obra continúe',
    'Registra incidencias y organiza la atención durante el alquiler.',
    '<button class="primary" data-ticket>＋ Crear incidencia</button>'
  ) + `
    <div class="two-col">
      <section class="panel">
        <h3>${isProvider(user) ? 'Incidencias de mis alquileres' : 'Mis incidencias'}</h3>
        ${tickets.length
          ? tickets.map((ticket) => {
            const booking = bookingById(ticket.bookingId);
            const creator = userById(ticket.createdBy);
            return `<div class="ticket">
              <div class="cost-row"><strong>${esc(ticket.subject)}</strong>${pill(ticket.status)}</div>
              <p>${esc(ticket.description)}</p>
              <small class="muted">${esc(ticket.id)} · ${esc(ticket.priority)} · ${booking ? esc(booking.equipmentName) : 'Consulta general'}${creator ? ` · ${esc(creator.name)}` : ''}</small>
              ${ticket.status !== 'Resuelta' ? `<div style="margin-top:12px"><button data-resolve="${ticket.id}">Marcar como resuelta</button></div>` : `<small class="muted">Resuelta ${ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : ''}</small>`}
            </div>`;
          }).join('')
          : '<p class="muted">No tienes incidencias registradas. Puedes informar una falla, un retraso o consultar las condiciones.</p>'}
        <div class="notice">El soporte es simulado. No hay un técnico monitoreando estos reportes ni un servicio 24/7 activo.</div>
      </section>
      <section class="panel faq">
        <h3>Preguntas frecuentes</h3>
        ${SUPPORT_FAQ.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}
      </section>
    </div>`;
}

function ticketModal() {
  const user = currentUser();
  const options = visibleBookings(user)
    .filter((booking) => !['Cotización', 'Cancelada'].includes(booking.status))
    .map((booking) => `<option value="${booking.id}">${esc(booking.equipmentName)} · ${booking.id}${isProvider(user) ? ` · ${esc(booking.clientName)}` : ''}</option>`)
    .join('');

  modal('Registrar una incidencia', `
    <form id="ticketForm">
      <div class="form-grid">
        <div class="field">
          <label for="ticketBooking">Alquiler relacionado</label>
          <select id="ticketBooking" name="bookingId">
            <option value="">Consulta general</option>
            ${options}
          </select>
        </div>
        <div class="field">
          <label for="priority">Prioridad</label>
          <select id="priority" name="priority">
            <option>Normal</option>
            <option>Alta · obra afectada</option>
            <option>Urgente · equipo detenido</option>
          </select>
        </div>
        <div class="field full">
          <label for="subject">Motivo</label>
          <select id="subject" name="subject">
            <option>Falla mecánica</option>
            <option>Retraso en la entrega</option>
            <option>Solicitud de reemplazo</option>
            <option>Daño o accesorio faltante</option>
            <option>Consulta sobre pagos</option>
            <option>Otra consulta</option>
          </select>
        </div>
        <div class="field full">
          <label for="description">Describe lo ocurrido</label>
          <textarea id="description" name="description" minlength="10" maxlength="2000" required placeholder="Indica el problema, el momento en que ocurrió y cómo afecta a tu obra."></textarea>
        </div>
      </div>
      <div class="form-actions"><button class="primary">Registrar incidencia demo</button></div>
    </form>`);

  $('#ticketForm').onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.tickets.unshift({
      id: `TK-${uid().toUpperCase()}`,
      createdBy: user.id,
      bookingId: data.bookingId || '',
      subject: data.subject,
      priority: data.priority,
      description: data.description.trim(),
      status: 'Registrada',
      created: new Date().toISOString()
    });
    saveDB();
    closeModal();
    if (route === 'soporte') support();
    toast('Incidencia guardada en este navegador.');
  };
}

function resolveTicket(id) {
  const ticket = state.tickets.find((entry) => entry.id === id);
  const user = currentUser();
  if (!ticket || !user) return;
  const booking = bookingById(ticket.bookingId);
  const canResolve = ticket.createdBy === user.id || (booking && booking.providerId === user.id);
  if (!canResolve) {
    toast('No puedes modificar esta incidencia.');
    return;
  }
  ticket.status = 'Resuelta';
  ticket.resolvedAt = new Date().toISOString();
  ticket.resolvedBy = user.id;
  saveDB();
  support();
  toast('Incidencia marcada como resuelta.');
}
