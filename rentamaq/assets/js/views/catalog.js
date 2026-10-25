/* ============================================================================
   RentaMaq · Catálogo de equipos
   ----------------------------------------------------------------------------
   Búsqueda, filtros, tarjetas, ficha del equipo, comparación, favoritos y
   creación de cotizaciones o solicitudes de alquiler.
   ========================================================================== */

'use strict';

const CATEGORIES = ['Movimiento de tierras', 'Concreto', 'Topografía', 'Compactación', 'Acceso y herramientas'];

function available(item, start = '', end = start) {
  if (!item || !item.available) return false;
  if (!start) return true;
  return !state.bookings.some((booking) => (
    booking.equipmentId === item.id
    && ['Confirmada', 'En curso'].includes(booking.status)
    && booking.start <= end
    && booking.end >= start
  ));
}

function equipmentImage(item, detail = false) {
  if (!item?.image) {
    return `<div class="no-photo" ${detail ? 'style="height:255px;border-radius:10px"' : ''}>${icon('equipos')}<span>${esc(item?.category || 'Equipo')} · ficha sin fotografía</span></div>`;
  }
  return `<img ${detail ? 'class="detail-photo"' : `class="${item.category === 'Movimiento de tierras' ? 'earth' : ''}"`} src="${esc(imageSrc(item.image))}" alt="Fotografía de ${esc(item.name)}" loading="lazy">`;
}

function card(item) {
  const user = currentUser();
  const mine = user && item.providerId === user.id;
  const favorite = isFavorite(item.id);
  const isAvailable = available(item, filters.start);
  return `
    <article class="equipment">
      <div class="equipment-photo">
        ${equipmentImage(item)}
        <span class="stock ${isAvailable ? '' : 'unavailable'}">${isAvailable ? '● Disponible' : '◷ No disponible'}</span>
        <button class="heart ${favorite ? 'selected' : ''}" data-favorite="${item.id}" aria-label="${favorite ? 'Quitar de' : 'Añadir a'} favoritos" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button>
        ${item.image ? `<span class="photo-label">${item.custom ? 'Fotografía del proveedor' : 'Imagen referencial'}</span>` : ''}
      </div>
      <div class="card-content">
        <div class="card-category">${esc(item.category.toUpperCase())}</div>
        <h3>${esc(item.name)}</h3>
        <div class="card-meta"><span>⌖ ${esc(item.district)}, ${esc(item.city)}</span><span>${item.rating ? `★ ${item.rating}` : 'Nuevo'}</span></div>
        <div class="specs-mini"><span>${esc(item.capacity)}</span><span>${item.year}</span><span>${item.hours.toLocaleString('es-PE')} h</span></div>
        <div class="provider-line">
          <span>${esc(item.provider)}</span>
          ${mine ? '<span class="badge badge-neutral">Tu publicación</span>' : verifiedLine(item.verified)}
        </div>
        <div class="card-bottom">
          <div class="price">${money(item.price)} <small>/ día</small></div>
          <button class="detail-btn outline-orange" data-detail="${item.id}">Ver equipo</button>
        </div>
        <label class="compare-toggle"><input type="checkbox" data-compare="${item.id}" ${compare.includes(item.id) ? 'checked' : ''}> Comparar equipo</label>
      </div>
    </article>`;
}

function filteredEquipment() {
  const query = normalize(filters.q);
  const list = state.equipment.filter((item) => {
    const haystack = normalize(`${item.name} ${item.provider} ${item.category} ${item.city} ${item.district}`);
    return haystack.includes(query)
      && (!filters.city || item.city === filters.city)
      && (filters.category === 'Todos' || item.category === filters.category)
      && item.price <= filters.max
      && (!filters.available || available(item, filters.start))
      && (!filters.verified || item.verified)
      && (!filters.operator || item.operator > 0);
  });

  if (filters.sort === 'precio-asc') list.sort((a, b) => a.price - b.price);
  if (filters.sort === 'precio-desc') list.sort((a, b) => b.price - a.price);
  if (filters.sort === 'valoracion') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return list;
}

function catalog() {
  const user = currentUser();
  const action = isProvider(user)
    ? '<button class="outline-orange" data-publish>＋ Publicar equipo</button>'
    : '<button class="outline-orange" data-become-provider>＋ Publicar equipo</button>';

  const cities = [...new Set(state.equipment.map((item) => item.city))].sort();

  $('#main').innerHTML = heading(
    'El equipo que tu obra necesita',
    'Encuentra, compara y alquila maquinaria en un solo lugar.',
    action
  ) + `
    <form class="searchbox" id="searchForm">
      <div class="search-field">
        <label for="query">¿QUÉ EQUIPO BUSCAS?</label>
        <input id="query" placeholder="Excavadora, mezcladora, estación total…" value="${esc(filters.q)}">
      </div>
      <div class="search-field">
        <label for="location">UBICACIÓN</label>
        <select id="location">
          <option value="">Todas las ciudades</option>
          ${cities.map((city) => `<option ${filters.city === city ? 'selected' : ''}>${esc(city)}</option>`).join('')}
        </select>
      </div>
      <div class="search-field">
        <label for="searchDate">FECHA DE INICIO</label>
        <input id="searchDate" type="date" min="${today()}" value="${esc(filters.start)}">
      </div>
      <button class="primary">⌕ Buscar equipos</button>
    </form>
    <section class="feature-strip">
      <div><h2>Menos búsqueda. Más obra.</h2><p>Información clara para elegir bien y mantener tu proyecto en marcha.</p></div>
      <div class="mini-trust"><span><b>✓</b> Fichas técnicas completas</span><span><b>✓</b> Costos sin sorpresas</span></div>
    </section>
    <div class="categories">
      ${['Todos', ...CATEGORIES].map((category) => `<button class="chip ${filters.category === category ? 'active' : ''}" data-category="${esc(category)}">${category}</button>`).join('')}
    </div>
    <div class="catalog-layout">
      <aside class="filters">
        <div class="filter-title"><strong>Filtros</strong><button class="text-button" data-reset-filters>Limpiar</button></div>
        <div class="filter-group">
          <h4>Precio por día</h4>
          <input aria-label="Precio máximo por día" type="range" id="maxPrice" min="20" max="2000" step="10" value="${filters.max}">
          <div class="range-labels"><span>S/ 0</span><b id="priceLabel">${money(filters.max)}</b></div>
        </div>
        <div class="filter-group">
          <h4>Disponibilidad y confianza</h4>
          <label><input type="checkbox" id="onlyAvailable" ${filters.available ? 'checked' : ''}> Solo disponibles</label>
          <label><input type="checkbox" id="onlyVerified" ${filters.verified ? 'checked' : ''}> Proveedor verificado*</label>
        </div>
        <div class="filter-group">
          <h4>Servicios adicionales</h4>
          <label><input type="checkbox" id="withOperator" ${filters.operator ? 'checked' : ''}> Opción con operador</label>
        </div>
        <div class="filter-note"><strong>Alquilar también es aprovechar.</strong><br>Da más uso a los equipos existentes y evita compras para necesidades temporales.<br><br>ODS 8 · 9 · 12</div>
      </aside>
      <section>
        <div class="results-head">
          <strong id="resultCount"></strong>
          <label>Ordenar:
            <select id="sort" aria-label="Ordenar resultados">
              <option value="recomendado">Recomendados</option>
              <option value="precio-asc">Menor precio</option>
              <option value="precio-desc">Mayor precio</option>
              <option value="valoracion">Mejor valoración</option>
            </select>
          </label>
        </div>
        <div id="results"></div>
        <div class="catalog-bottom"><span>* Verificaciones, reseñas y tarifas de demostración.</span><span>Precios por jornada de 8 h.</span></div>
      </section>
    </div>`;

  $('#sort').value = filters.sort;
  results();

  $('#searchForm').onsubmit = (event) => {
    event.preventDefault();
    filters.q = $('#query').value.trim();
    filters.city = $('#location').value;
    filters.start = $('#searchDate').value;
    results();
  };
  $('#maxPrice').oninput = (event) => {
    filters.max = Number(event.target.value);
    $('#priceLabel').textContent = money(filters.max);
    results();
  };
  [['onlyAvailable', 'available'], ['onlyVerified', 'verified'], ['withOperator', 'operator']].forEach(([id, key]) => {
    $(`#${id}`).onchange = (event) => {
      filters[key] = event.target.checked;
      results();
    };
  });
  $('#sort').onchange = (event) => {
    filters.sort = event.target.value;
    results();
  };
}

function results() {
  const list = filteredEquipment();
  $('#resultCount').textContent = `${list.length} equipo${list.length === 1 ? '' : 's'} encontrado${list.length === 1 ? '' : 's'}`;
  $('#results').innerHTML = list.length
    ? `<div class="grid">${list.map(card).join('')}</div>`
    : emptyView({
      title: 'No encontramos equipos',
      desc: 'Prueba con otra ubicación, amplía el precio máximo o limpia los filtros.',
      label: 'Limpiar filtros',
      attrs: 'data-reset-filters',
      iconName: 'buscar'
    });
}

function favorites() {
  const user = currentUser();
  const ids = favoritesOf(user.id);
  const list = state.equipment.filter((item) => ids.includes(item.id));
  $('#main').innerHTML = heading(
    'Tus equipos favoritos',
    'Guarda alternativas y vuelve a ellas cuando tu obra las necesite.'
  ) + (list.length
    ? `<div class="grid">${list.map(card).join('')}</div>`
    : emptyView({
      title: 'Tu próxima selección empieza aquí',
      desc: 'Marca el corazón de cualquier equipo para guardarlo en tu lista personal.',
      label: 'Explorar equipos',
      iconName: 'favoritos'
    }));
}

function compareView() {
  const items = compare.map(equipmentById).filter(Boolean);
  if (items.length < 2) {
    toast('Selecciona al menos dos equipos para comparar.');
    return;
  }

  const rows = [
    ['Fotografía', (item) => item.image ? `<img class="thumb" src="${esc(imageSrc(item.image))}" alt="">` : '<span class="thumb-empty">—</span>'],
    ['Tarifa diaria', (item) => money(item.price)],
    ['Ciudad', (item) => esc(item.city)],
    ['Proveedor', (item) => `${esc(item.provider)}<small>${item.verified ? 'Verificado' : 'En revisión'}</small>`],
    ['Capacidad', (item) => esc(item.capacity)],
    ['Año', (item) => item.year],
    ['Horas de uso', (item) => `${item.hours} h`],
    ['Operador / día', (item) => item.operator ? money(item.operator) : 'No disponible'],
    ['Entrega y recojo', (item) => money(item.transport)],
    ['Garantía reembolsable', (item) => money(item.deposit)],
    ['Disponibilidad', (item) => available(item, filters.start) ? 'Disponible' : 'No disponible'],
    ['Verificación', (item) => item.verified ? 'Proveedor verificado' : 'En revisión']
  ];

  modal('Comparar equipos', `
    <p class="muted">Revisa las diferencias antes de solicitar una cotización. Tarifas de demostración.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Características</th>${items.map((item) => `<th>${esc(item.name)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(([label, format]) => `<tr><th>${label}</th>${items.map((item) => `<td>${format(item)}</td>`).join('')}</tr>`).join('')}
          <tr><th>Elegir</th>${items.map((item) => `<td><button class="primary" data-detail="${item.id}">Ver y cotizar</button></td>`).join('')}</tr>
        </tbody>
      </table>
    </div>`);
}

function detail(id) {
  const item = equipmentById(id);
  if (!item) return;
  const user = currentUser();
  const mine = user && item.providerId === user.id;
  const start = filters.start && filters.start >= today() ? filters.start : today();
  const providerUser = userById(item.providerId);
  const canRequest = user && !isProvider(user) && !mine;

  const providerCard = `
    <div class="mini-profile" style="margin:17px 0">
      <span class="avatar ${providerUser?.verified ? 'provider' : ''}">${esc(initials(item.provider))}</span>
      <div>
        <strong>${esc(item.provider)}</strong>
        <small>${item.verified ? 'Proveedor verificado' : 'Verificación en revisión'}${providerUser?.city ? ` · ${esc(providerUser.city)}` : ''}</small>
      </div>
    </div>`;

  const quoteForm = canRequest ? `
    <div class="booking-box">
      <h3>Calcula tu alquiler</h3>
      <p class="muted" style="font-size:13px">Fechas inclusivas. Una jornada equivale a un día; el equipo no queda reservado hasta que el proveedor confirme.</p>
      <form id="quoteForm">
        <div class="form-grid">
          <div class="field"><label for="start">Inicio</label><input id="start" type="date" min="${today()}" value="${start}" required></div>
          <div class="field"><label for="end">Devolución</label><input id="end" type="date" min="${start}" value="${addDays(start, 2)}" required></div>
          <div class="field"><label for="delivery">Traslado</label><select id="delivery"><option value="yes">Entrega y recojo (${money(item.transport)})</option><option value="no">Recojo por mi cuenta · sin costo</option></select></div>
          <div class="field"><label for="operator">Operación</label><select id="operator"><option value="no">Sin operador</option>${item.operator ? `<option value="yes">Con operador (${money(item.operator)} / día)</option>` : ''}</select></div>
          <div class="field full"><label for="project">Nombre de obra</label><input id="project" maxlength="100" placeholder="Ej. Vivienda multifamiliar Los Cedros" required></div>
          <div class="field full"><label for="address">Dirección de la obra o punto de coordinación</label><input id="address" maxlength="180" placeholder="Dirección y distrito" required></div>
        </div>
        <div id="costs" style="margin:16px 0"></div>
        <label class="check-line"><input id="terms" type="checkbox" required> Entiendo las condiciones de alquiler y que esta solicitud es una simulación sin pago real. La garantía se considera aparte del costo del servicio.</label>
        <div class="form-actions">
          <button type="button" id="saveQuote">Guardar cotización</button>
          <button class="primary" id="requestBooking">Solicitar alquiler</button>
        </div>
      </form>
    </div>
    <div style="margin-top:22px;font-size:13px;color:var(--muted)">
      <strong>Condiciones de esta propuesta:</strong> el combustible, los permisos de acceso y las horas extra no están incluidos. La entrega depende del acceso a la obra. Cancelación sin cargo antes de confirmar; los cambios posteriores se coordinan con el proveedor. No hay cobro, póliza, contrato firmado ni garantía técnica real en este prototipo.
    </div>`
    : mine
      ? `<div class="booking-box">
          <h3>Este anuncio es tuyo</h3>
          <p class="muted" style="font-size:13px">Puedes actualizar la fotografía, la tarifa y la disponibilidad desde Mis equipos.</p>
          <div class="inline-actions">
            <button class="primary" data-edit="${item.id}">Editar equipo</button>
            <button data-toggle="${item.id}">${item.available ? 'Pausar' : 'Activar'}</button>
          </div>
        </div>`
      : `<div class="booking-box">
          <h3>Consulta con el proveedor</h3>
          <p class="muted" style="font-size:13px">Las solicitudes de alquiler se realizan con una cuenta de contratista. Puedes escribir al proveedor para coordinar condiciones.</p>
          <button class="primary" data-contact-provider="${item.providerId}" data-equipment-id="${item.id}">✉ Enviar consulta</button>
        </div>`;

  modal('Ficha del equipo', `
    <div class="detail-top">
      <div>
        ${equipmentImage(item, true)}
        <p class="muted" style="font-size:11px;margin-top:8px">${item.custom ? 'Fotografía cargada por el proveedor.' : 'Fotografía referencial de demostración.'} Las especificaciones y el anuncio son de demostración.</p>
        <div class="detail-specs">
          ${[['Capacidad', item.capacity], ['Potencia / energía', item.power], ['Año', item.year], ['Horas registradas', `${item.hours} h`], ['Ubicación', `${item.city} · ${item.district}`], ['Jornada', '8 horas por día']].map(([key, value]) => `<div><small>${key}</small>${esc(value)}</div>`).join('')}
        </div>
      </div>
      <div>
        <span class="status-pill ${item.available ? '' : 'pending'}">${item.available ? 'Disponible para solicitudes' : 'En mantenimiento'}</span>
        <h2>${esc(item.name)}</h2>
        <p class="muted">${esc(item.description)}</p>
        <h3 class="price">${money(item.price)} <small>/ día · tarifa de ejemplo</small></h3>
        <div class="role-line">${providerCard}</div>
        <p style="font-size:14px"><span class="verified">★ ${item.rating || 'Sin reseñas'}</span> <small class="muted">· valoración de la comunidad</small></p>
        ${!mine ? `<button data-contact-provider="${item.providerId}" data-equipment-id="${item.id}">✉ Consultar al proveedor</button>` : ''}
        <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
        <h3>Mantenimiento y respaldo</h3>
        <div class="timeline">
          <div>Revisión preventiva registrada<small>Inspección de funcionamiento, seguridad y accesorios · demo.</small></div>
          <div>Entrega con lista de comprobación<small>Revisar estado, accesorios y condiciones al recibir.</small></div>
          <div>Atención de fallas<small>Solicita evaluación o reemplazo desde Soporte. Sujeto a confirmación del proveedor.</small></div>
        </div>
      </div>
    </div>
    ${quoteForm}`);

  if (canRequest) {
    const update = () => {
      const quoteResult = quote(item);
      $('#end').min = $('#start').value || today();
      $('#costs').innerHTML = quoteResult.error
        ? `<p class="error-text">${quoteResult.error}</p>`
        : costRows(quoteResult);
      $('#requestBooking').disabled = Boolean(quoteResult.error) || !item.available;
    };
    ['start', 'end', 'delivery', 'operator'].forEach((field) => {
      $(`#${field}`).onchange = update;
    });
    update();
    $('#quoteForm').onsubmit = (event) => {
      event.preventDefault();
      createBooking(item, 'Solicitada');
    };
    $('#saveQuote').onclick = () => {
      if ($('#quoteForm').reportValidity()) createBooking(item, 'Cotización');
    };
  }
}

function quote(item) {
  const start = $('#start')?.value;
  const end = $('#end')?.value;
  if (!start || !end || start < today() || end < start) {
    return { error: 'Selecciona fechas válidas; la devolución debe ser igual o posterior al inicio.' };
  }
  const days = daysBetween(start, end);
  if (days > 90) return { error: 'Para este prototipo, el periodo máximo es de 90 días.' };
  if (!available(item, start, end)) {
    return { error: 'El equipo no está disponible en este periodo. Cambia las fechas o selecciona otra alternativa.' };
  }

  const base = round2(item.price * days);
  const operator = $('#operator')?.value === 'yes' ? round2(item.operator * days) : 0;
  const transport = $('#delivery')?.value === 'yes' ? round2(item.transport) : 0;
  const fee = round2(base * 0.05);
  return {
    start,
    end,
    days,
    base,
    operator,
    transport,
    fee,
    total: round2(base + operator + transport + fee),
    deposit: item.deposit
  };
}

function costRows(cost) {
  return `
    <div class="cost-row"><span>Alquiler · ${cost.days} día${cost.days > 1 ? 's' : ''}</span><strong>${money(cost.base)}</strong></div>
    <div class="cost-row"><span>Operador</span><span>${money(cost.operator)}</span></div>
    <div class="cost-row"><span>Entrega y recojo</span><span>${money(cost.transport)}</span></div>
    <div class="cost-row"><span>Servicio RentaMaq · 5% de ejemplo</span><span>${money(cost.fee)}</span></div>
    <div class="cost-row total"><span>Total del servicio</span><span>${money(cost.total)}</span></div>
    <div class="cost-row deposit"><span>Garantía reembolsable, aparte</span><span>${money(cost.deposit)}</span></div>
    <div class="cost-row deposit"><span>Desembolso estimado, con garantía</span><span>${money(cost.total + cost.deposit)}</span></div>
    <small class="muted">Importes finales de demostración; no se añade otro impuesto en este cálculo.</small>`;
}

function createBooking(item, status) {
  const user = currentUser();
  if (!user) return;
  if (isProvider(user)) {
    toast('Las solicitudes de alquiler se crean con una cuenta de contratista.');
    return;
  }
  if (item.providerId === user.id) {
    toast('No puedes solicitar tu propio equipo.');
    return;
  }

  const cost = quote(item);
  if (cost.error) {
    toast(cost.error);
    return;
  }
  const project = $('#project').value.trim();
  const address = $('#address').value.trim();
  if (!project || !address) {
    toast('Completa la obra y la dirección.');
    return;
  }
  if (!$('#terms').checked) {
    toast('Confirma que entiendes las condiciones de la simulación.');
    return;
  }

  const booking = {
    id: nextBookingId(),
    equipmentId: item.id,
    equipmentName: item.name,
    equipmentCategory: item.category,
    providerId: item.providerId,
    providerName: item.provider,
    clientId: user.id,
    clientName: user.name,
    clientCompany: user.company || '',
    status,
    ...cost,
    project,
    address,
    created: new Date().toISOString(),
    paid: false,
    paymentMethod: '',
    reviewed: false
  };

  state.bookings.unshift(booking);
  if (!saveDB()) {
    state.bookings.shift();
    toast('No se pudo guardar la solicitud. Revisa el espacio disponible en el navegador.');
    return;
  }

  updateShell();
  modal(status === 'Cotización' ? 'Cotización guardada' : 'Solicitud registrada', `
    <div class="center">
      <div class="success-icon">✓</div>
      <h2>${status === 'Cotización' ? 'Tu cotización está lista' : 'Un paso más cerca de tu equipo'}</h2>
      <p class="muted">${esc(booking.equipmentName)} · ${date(booking.start)} al ${date(booking.end)}</p>
      <p><strong>${booking.id}</strong></p>
      <p>${status === 'Cotización'
        ? 'Puedes revisarla y convertirla en una solicitud desde Mis alquileres.'
        : 'El proveedor verá la solicitud en su panel para confirmarla. Puedes seguir el estado desde Mis alquileres.'}</p>
      <h2>${money(booking.total)}</h2>
      <p class="muted">No se ha realizado ningún cobro ni contacto externo.</p>
      <div class="form-actions">
        <button data-booking="${booking.id}">Ver resumen</button>
        <button class="primary" data-route="reservas" data-close>Ir a mis alquileres</button>
      </div>
    </div>`);
}

function contactProvider(providerId, equipmentId) {
  const equipment = equipmentById(equipmentId);
  const thread = findOrCreateThread(providerId, equipment);
  if (!thread) {
    toast('No se pudo iniciar la conversación.');
    return;
  }
  threadId = thread.id;
  closeModal();
  navigate('mensajes');
}
