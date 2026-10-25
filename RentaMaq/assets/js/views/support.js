/* ============================================================================
   RentaMaq · Soporte
   ----------------------------------------------------------------------------
   Registro de incidencias vinculadas a un alquiler, preguntas frecuentes y
   seguimiento compartido de cada reporte.
   ========================================================================== */

'use strict';

const SUPPORT_FAQ = [
  ['¿Cómo publico mis equipos?', 'Registra una cuenta y elige “Publicar equipos”, o convierte tu cuenta de contratista desde Mi cuenta. Los proveedores administran su catálogo y reciben solicitudes de alquiler.'],
  ['¿Cómo se confirma una solicitud?', 'El contratista envía la solicitud desde la ficha del equipo. El proveedor la recibe en “Solicitudes de alquiler” y puede confirmarla o rechazarla. La plataforma revisa que no exista otra reserva confirmada en las mismas fechas.'],
  ['¿Qué incluye la tarifa?', 'La tarifa diaria cubre una jornada de 8 horas. El resumen separa operador, traslado, servicio RentaMaq y garantía. El combustible, los permisos de acceso y las horas extra no están incluidos.'],
  ['¿La garantía forma parte del precio?', 'No. Se muestra aparte como un importe reembolsable, sujeto a la revisión del estado del equipo al devolverlo. La devolución se coordina directamente entre contratista y proveedor.'],
  ['¿Cuándo se registra la forma de pago?', 'Cuando el proveedor confirma la solicitud. El contratista indica el medio acordado (transferencia, Yape/Plin, efectivo u otro) y ambas partes lo ven en el resumen del alquiler. RentaMaq no procesa pagos ni solicita datos de tarjetas.'],
  ['¿Qué significa “Datos comerciales confirmados”?', 'Indica que la cuenta completó la revisión básica del nombre comercial, RUC y teléfono de contacto. No acredita una inspección técnica del equipo ni una revisión documental completa.'],
  ['¿Dónde se guardan mis datos?', 'En la infraestructura de Supabase asociada a RentaMaq. El acceso está protegido por autenticación y reglas por cuenta. Tu correo y teléfono no se muestran en el catálogo ni en el perfil público.'],
  ['¿Puedo usar mi cuenta en otro dispositivo?', 'Sí. Inicia sesión con el mismo correo y contraseña desde cualquier dispositivo. Tus alquileres, mensajes y publicaciones se sincronizan automáticamente.'],
  ['¿Qué hago ante una falla del equipo?', 'Detén el uso si existe riesgo para las personas y registra una incidencia aquí. El proveedor del alquiler puede ver el reporte y marcarlo como resuelto. Para una urgencia en obra, contacta directamente al proveedor.'],
  ['¿Cómo elimino mi cuenta?', 'Desde Mi cuenta, en la zona de privacidad, puedes eliminar tu cuenta y los datos asociados. La acción es permanente y cierra la sesión en todos los dispositivos.']
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
        <div class="notice">El reporte queda visible para las dos cuentas del alquiler y se actualiza en todos sus dispositivos. Para emergencias, detén el equipo y contacta directamente al proveedor.</div>
      </section>
      <section class="panel faq">
        <h3>Preguntas frecuentes</h3>
        ${SUPPORT_FAQ.map(([question, answer]) => `<details><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`).join('')}
      </section>
    </div>`;
}

function ticketModal() {
  const user = currentUser();
  if (!user) return;
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
      <div class="form-actions"><button class="primary">Registrar incidencia</button></div>
    </form>`);

  $('#ticketForm').onsubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    withBusy(form.querySelector('[type="submit"]'), 'Registrando…', async () => {
      const result = await createTicketRecord({
        bookingId: data.bookingId || '',
        subject: data.subject,
        priority: data.priority,
        description: data.description
      });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      await refreshCloud({ render: false, silent: true });
      closeModal();
      if (route === 'soporte') support();
      toast('Incidencia registrada. Ambas partes del alquiler pueden verla.');
    });
  };
}

async function resolveTicket(id, button = null) {
  const ticket = ticketById(id);
  const user = currentUser();
  if (!ticket || !user) return;
  const booking = bookingById(ticket.bookingId);
  const canResolve = ticket.createdBy === user.id || (booking && booking.providerId === user.id);
  if (!canResolve) {
    toast('No puedes modificar esta incidencia.');
    return;
  }

  await withBusy(button, 'Guardando…', async () => {
    const result = await resolveTicketRecord(id);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    await refreshCloud({ render: false, silent: true });
    if (route === 'soporte') support();
    toast('Incidencia marcada como resuelta.');
  });
}
