/* ============================================================================
   RentaMaq · Resumen de actividad
   ----------------------------------------------------------------------------
   Panel de inicio con métricas distintas para contratistas y proveedores.
   ========================================================================== */

'use strict';

function dashboard() {
  const user = currentUser();
  if (!user) return;
  if (isProvider(user)) providerDashboard(user);
  else clientDashboard(user);
}

function clientDashboard(user) {
  const operations = visibleBookings(user);
  const active = operations.filter((booking) => ['Confirmada', 'En curso'].includes(booking.status));
  const finished = operations.filter((booking) => booking.status === 'Finalizada');
  const total = operations
    .filter((booking) => booking.status !== 'Cancelada')
    .reduce((sum, booking) => sum + booking.total, 0);
  const recent = operations.slice(0, 4);

  $('#main').innerHTML = heading(
    'Tu actividad, de un vistazo',
    'Un resumen de las operaciones que realizaste en RentaMaq.',
    '<button class="primary" data-route="catalogo">Buscar equipo</button>'
  ) + `
    <div class="stats">
      <div class="stat"><span>Solicitudes pendientes</span><strong>${operations.filter((booking) => booking.status === 'Solicitada').length}</strong><small>Por confirmar</small></div>
      <div class="stat"><span>Alquileres activos</span><strong>${active.length}</strong><small>Confirmados o en curso</small></div>
      <div class="stat"><span>Volumen cotizado y solicitado</span><strong>${money(total)}</strong><small>No representa ingresos cobrados</small></div>
      <div class="stat"><span>Servicios finalizados</span><strong>${finished.length}</strong><small>Devoluciones registradas</small></div>
    </div>
    <div class="two-col">
      <section class="panel">
        <h3>Distribución por etapa</h3>
        <p class="muted" style="font-size:13px">Cantidad de registros de tu cuenta</p>
        <div class="chart-bars">
          ${['Cotización', 'Solicitada', 'Confirmada', 'En curso', 'Finalizada'].map((status) => {
            const count = operations.filter((booking) => booking.status === status).length;
            return `<div class="bar-column"><b>${count}</b><i style="height:${Math.max(3, count / Math.max(1, operations.length) * 115)}px"></i><span>${status}</span></div>`;
          }).join('')}
        </div>
      </section>
      <section class="panel">
        <h3>Próximos pasos</h3>
        <div class="timeline">
          <div>Encuentra la maquinaria<small>Filtra por ciudad, categoría y tarifa.</small></div>
          <div>Compara y cotiza<small>Revisa traslado, operador y garantía.</small></div>
          <div>Coordina el alquiler<small>El proveedor confirma y registra la entrega.</small></div>
        </div>
        <button data-route="reservas">Gestionar alquileres</button>
      </section>
    </div>
    <section class="panel">
      <h3>Actividad reciente</h3>
      ${recent.length
        ? recent.map((booking) => `<div class="cost-row"><span>${esc(booking.equipmentName)}<small class="muted"> · ${esc(booking.project)}</small></span>${pill(booking.status)}</div>`).join('')
        : '<p class="muted">Tus operaciones aparecerán aquí al guardar una cotización.</p>'}
    </section>`;
}

function providerDashboard(user) {
  const equipment = myEquipment(user);
  const operations = visibleBookings(user);
  const pending = operations.filter((booking) => booking.status === 'Solicitada');
  const active = operations.filter((booking) => ['Confirmada', 'En curso'].includes(booking.status));
  const volume = operations
    .filter((booking) => !['Cancelada', 'Cotización'].includes(booking.status))
    .reduce((sum, booking) => sum + booking.total, 0);
  const recent = operations.slice(0, 4);

  $('#main').innerHTML = heading(
    `Hola, ${esc(user.name.split(' ')[0])}`,
    'Este es el pulso de tu catálogo y de las solicitudes que recibes.',
    '<button class="primary" data-publish>＋ Publicar equipo</button>'
  ) + `
    ${!user.verified ? `<div class="verification-banner">
      <div><strong>Tu cuenta de proveedor está en revisión</strong><p>Completa la verificación simulada para mostrar el sello de proveedor verificado en tus anuncios.</p></div>
      <button class="primary" data-verify-provider>Completar verificación</button>
    </div>` : `<div class="verification-banner ok">
      <div><strong>Proveedor verificado</strong><p>Tu cuenta muestra el sello de confianza en el catálogo.</p></div>
      ${verificationBadge(true)}
    </div>`}
    <div class="stats">
      <div class="stat"><span>Equipos publicados</span><strong>${equipment.length}</strong><small>${equipment.filter((item) => item.available).length} disponibles</small></div>
      <div class="stat"><span>Solicitudes por confirmar</span><strong>${pending.length}</strong><small>Requieren tu respuesta</small></div>
      <div class="stat"><span>Alquileres activos</span><strong>${active.length}</strong><small>Confirmados o en curso</small></div>
      <div class="stat"><span>Volumen de solicitudes</span><strong>${money(volume)}</strong><small>Sin cobros reales</small></div>
    </div>
    <div class="two-col">
      <section class="panel">
        <h3>Solicitudes recientes</h3>
        ${recent.length ? `
          <div class="table-wrap"><table>
            <thead><tr><th>Equipo</th><th>Cliente</th><th>Periodo</th><th>Estado</th></tr></thead>
            <tbody>${recent.map((booking) => `
              <tr>
                <td><strong>${esc(booking.equipmentName)}</strong><small>${esc(booking.project)}</small></td>
                <td>${esc(booking.clientName)}</td>
                <td>${date(booking.start)}<small>${booking.days} días</small></td>
                <td>${pill(booking.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          <div style="margin-top:14px"><button data-route="reservas">Ver todas las solicitudes</button></div>`
          : '<p class="muted">Todavía no hay solicitudes. Comparte tus equipos con una fotografía clara y una tarifa competitiva.</p>'}
      </section>
      <section class="panel">
        <h3>Distribución por etapa</h3>
        <p class="muted" style="font-size:13px">Solicitudes recibidas en tu cuenta</p>
        <div class="chart-bars">
          ${['Solicitada', 'Confirmada', 'En curso', 'Finalizada', 'Cancelada'].map((status) => {
            const count = operations.filter((booking) => booking.status === status).length;
            return `<div class="bar-column"><b>${count}</b><i style="height:${Math.max(3, count / Math.max(1, operations.length) * 115)}px"></i><span>${status}</span></div>`;
          }).join('')}
        </div>
      </section>
    </div>
    <section class="panel">
      <div class="page-heading" style="margin-bottom:14px"><div><h3>Mis equipos</h3><p>${equipment.length ? 'Estado actual de tus publicaciones.' : 'Aún no has publicado maquinaria.'}</p></div><button data-route="equipos">Administrar</button></div>
      ${equipment.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Equipo</th><th>Tarifa</th><th>Ubicación</th><th>Estado</th></tr></thead>
          <tbody>${equipment.slice(0, 5).map((item) => `
            <tr>
              <td><div class="inventory-name">
                ${item.image ? `<img class="thumb" src="${esc(imageSrc(item.image))}" alt="">` : '<span class="thumb-empty">—</span>'}
                <div class="inventory-text"><strong>${esc(item.name)}</strong><small>${esc(item.category)}</small></div>
              </div></td>
              <td>${money(item.price)}</td>
              <td>${esc(item.city)}</td>
              <td>${pill(item.available ? 'Disponible' : 'Pausado')}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>`
        : `<div class="empty compact"><div class="empty-icon">${icon('equipos')}</div><h3>Publica tu primer equipo</h3><p>Agrega una foto, una tarifa y las condiciones del servicio. Aparecerá en el catálogo al instante.</p><button class="primary" data-publish>Publicar equipo</button></div>`}
    </section>`;
}
