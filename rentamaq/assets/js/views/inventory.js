/* ============================================================================
   RentaMaq · Mis equipos
   ----------------------------------------------------------------------------
   Administración del catálogo del proveedor: publicar, editar, pausar y
   eliminar anuncios. Incluye carga, vista previa y compresión de fotografías.
   ========================================================================== */

'use strict';

const EQUIPMENT_FIELDS = [
  ['name', 'Nombre del equipo', 'text', ''],
  ['price', 'Tarifa diaria (S/)', 'number', ''],
  ['capacity', 'Capacidad', 'text', ''],
  ['power', 'Potencia / energía', 'text', ''],
  ['city', 'Ciudad', 'text', 'Trujillo'],
  ['district', 'Distrito', 'text', ''],
  ['year', 'Año', 'number', 2024],
  ['hours', 'Horas de uso', 'number', 0],
  ['transport', 'Entrega y recojo (S/)', 'number', 0],
  ['deposit', 'Garantía reembolsable (S/)', 'number', 0],
  ['operator', 'Operador por día (S/; 0 si no ofrece)', 'number', 0]
];

function inventory() {
  const user = currentUser();
  if (!user) return;

  if (!isProvider(user)) {
    $('#main').innerHTML = heading(
      'Publica tus equipos',
      'Convierte tu maquinaria en una fuente de ingresos cuando no la estés usando.',
      '<button class="primary" data-become-provider>Quiero ser proveedor</button>'
    ) + `
      <section class="panel">
        <div class="eyebrow">CUENTA DE PROVEEDOR</div>
        <h2>Tu cuenta actual es de contratista</h2>
        <p class="muted" style="max-width:760px">Para publicar equipos necesitas identificarte como proveedor. Al hacerlo, tu perfil mostrará un distintivo y podrás administrar tu propio catálogo, recibir solicitudes y confirmar alquileres.</p>
        <div class="steps">
          <div class="step"><b>01</b><strong>Identifícate</strong><p>Agrega el nombre comercial, RUC y teléfono de contacto.</p></div>
          <div class="step"><b>02</b><strong>Publica</strong><p>Sube una fotografía, tarifa y condiciones del equipo.</p></div>
          <div class="step"><b>03</b><strong>Recibe solicitudes</strong><p>Confirma fechas y coordina la entrega.</p></div>
          <div class="step"><b>04</b><strong>Gestiona</strong><p>Pausa, edita o retira tus anuncios cuando quieras.</p></div>
        </div>
        <button class="primary" data-become-provider>Convertirme en proveedor</button>
      </section>
      <div class="notice">La conversión y la verificación son simuladas dentro de esta demostración académica. No se validan documentos reales.</div>`;
    return;
  }

  const equipment = myEquipment(user);
  const availableCount = equipment.filter((item) => item.available).length;

  $('#main').innerHTML = heading(
    'Mis equipos',
    'Administra la oferta de tu cuenta de proveedor y mantén las fichas actualizadas.',
    '<button class="primary" data-publish>＋ Publicar equipo</button>'
  ) + `
    ${!user.verified ? `<div class="verification-banner">
      <div><strong>Verificación de proveedor pendiente</strong><p>Tus anuncios se muestran como “en revisión”. Completa la verificación simulada para obtener el sello de confianza.</p></div>
      <button class="primary" data-verify-provider>Verificar mi cuenta</button>
    </div>` : ''}
    <div class="stats">
      <div class="stat"><span>Equipos publicados</span><strong>${equipment.length}</strong><small>${availableCount} disponibles</small></div>
      <div class="stat"><span>Disponibles</span><strong>${availableCount}</strong><small>Visibles para solicitudes</small></div>
      <div class="stat"><span>Pausados</span><strong>${equipment.length - availableCount}</strong><small>Ocultos para nuevas reservas</small></div>
      <div class="stat"><span>Solicitudes activas</span><strong>${visibleBookings(user).filter((booking) => ['Solicitada', 'Confirmada', 'En curso'].includes(booking.status)).length}</strong><small>En tus equipos</small></div>
    </div>
    ${equipment.length ? `
      <div class="panel table-wrap">
        <table>
          <thead><tr><th>Equipo</th><th>Tarifa diaria</th><th>Ubicación</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>${equipment.map((item) => `
            <tr>
              <td>
                <div class="inventory-name">
                  ${item.image ? `<img class="thumb" src="${esc(imageSrc(item.image))}" alt="Fotografía de ${esc(item.name)}">` : '<span class="thumb-empty">—</span>'}
                  <div class="inventory-text">
                    <strong>${esc(item.name)}</strong>
                    <small>${esc(item.category)} · ${item.year}${item.custom ? ' · tu publicación' : ''}</small>
                  </div>
                </div>
              </td>
              <td>${money(item.price)}</td>
              <td>${esc(item.city)}<small>${esc(item.district)}</small></td>
              <td>${pill(item.available ? 'Disponible' : 'Pausado')}</td>
              <td>
                <div class="table-actions">
                  <button data-edit="${item.id}">Editar</button>
                  <button data-toggle="${item.id}">${item.available ? 'Pausar' : 'Activar'}</button>
                  <button data-detail="${item.id}">Ver ficha</button>
                  <button data-delete-equipment="${item.id}" class="danger-btn">Eliminar</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : emptyView({
        title: 'Todavía no publicaste equipos',
        desc: 'Agrega una fotografía, una tarifa diaria y las condiciones del servicio para aparecer en el catálogo.',
        label: '＋ Publicar mi primer equipo',
        attrs: 'data-publish',
        iconName: 'equipos'
      })}
    <div class="notice">Las fotografías se optimizan y se guardan dentro de este navegador. Publica equipos con información veraz: la verificación y los pagos son simulados.</div>`;
}

function uploaderMarkup(image, name = 'equipo') {
  const preview = image
    ? `<img src="${esc(imageSrc(image))}" alt="Vista previa de ${esc(name)}">`
    : `<div class="upload-empty">${icon('camara')}<span>Sin fotografía</span></div>`;
  return `
    <div class="uploader" id="imageUploader">
      <div class="upload-preview" id="imagePreview">${preview}</div>
      <div class="upload-copy">
        <strong>Fotografía del equipo</strong>
        <small>JPG, PNG o WebP. Se optimiza automáticamente para ocupar poco espacio. Una foto clara ayuda a que los contratistas decidan.</small>
        <div class="upload-actions">
          <button type="button" id="pickImage">${icon('subir')} Seleccionar imagen</button>
          <button type="button" id="removeImage" class="${image ? '' : 'hidden'}">Quitar</button>
        </div>
        <div class="upload-meter" id="imageMeter"></div>
      </div>
      <input type="file" id="eq_image" accept="image/jpeg,image/png,image/webp" hidden>
    </div>`;
}

function publish(id = '') {
  const user = currentUser();
  if (!user) return;
  if (!isProvider(user)) {
    becomeProviderModal();
    return;
  }

  const existing = id ? equipmentById(id) : null;
  if (id && !existing) {
    toast('El equipo ya no existe.');
    return;
  }
  if (existing && existing.providerId !== user.id) {
    toast('Solo puedes editar los equipos de tu cuenta.');
    return;
  }

  let imageData = existing?.image || '';
  let processingImage = false;
  const year = new Date().getFullYear();
  const values = existing || {};

  const fields = EQUIPMENT_FIELDS.map(([key, label, type, fallback]) => {
    const value = values[key] ?? fallback;
    const numeric = type === 'number';
    const min = key === 'price' ? 1 : key === 'year' ? 1990 : 0;
    const max = key === 'year' ? year : 10000000;
    const step = ['price', 'transport', 'deposit', 'operator'].includes(key) ? '.01' : '1';
    return `<div class="field">
      <label for="eq_${key}">${label}</label>
      <input id="eq_${key}" name="${key}" type="${type}" value="${esc(value)}"
        ${numeric ? `min="${min}" max="${max}" step="${step}"` : 'maxlength="120"'} required>
    </div>`;
  }).join('');

  modal(existing ? 'Editar equipo' : 'Publicar un equipo', `
    <p class="muted">Completa la información que un contratista necesita para decidir.</p>
    <form id="equipmentForm">
      <div class="form-grid">
        <div class="field full">
          <label for="eq_image">Fotografía del equipo</label>
          ${uploaderMarkup(imageData, existing?.name || 'equipo')}
        </div>
        ${fields}
        <div class="field">
          <label for="eq_category">Categoría</label>
          <select name="category" id="eq_category">
            ${CATEGORIES.map((category) => `<option ${values.category === category ? 'selected' : ''}>${category}</option>`).join('')}
          </select>
        </div>
        <div class="field full">
          <label for="eq_description">Descripción y accesorios</label>
          <textarea id="eq_description" name="description" maxlength="1000" required>${esc(values.description || '')}</textarea>
        </div>
        <label class="check-line full">
          <input type="checkbox" name="available" ${existing ? (existing.available ? 'checked' : '') : 'checked'}>
          Disponible para recibir solicitudes de alquiler
        </label>
      </div>
      <div class="form-actions">
        <button type="button" data-close>Cancelar</button>
        <button type="submit" class="primary" id="saveEquipment">${existing ? 'Guardar cambios' : 'Publicar equipo'}</button>
      </div>
    </form>`);

  const form = $('#equipmentForm');
  const fileInput = $('#eq_image');
  const uploader = $('#imageUploader');
  const preview = $('#imagePreview');
  const meter = $('#imageMeter');
  const removeButton = $('#removeImage');
  const saveButton = $('#saveEquipment');

  const renderPreview = (source) => {
    preview.innerHTML = source
      ? `<img src="${esc(imageSrc(source))}" alt="Vista previa del equipo">`
      : `<div class="upload-empty">${icon('camara')}<span>Sin fotografía</span></div>`;
    removeButton.classList.toggle('hidden', !source);
  };

  const processFile = async (file) => {
    if (!file) return;
    processingImage = true;
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Optimizando imagen…';
    }
    meter.className = 'upload-meter';
    meter.textContent = 'Optimizando imagen…';
    try {
      const result = await compressImage(file);
      imageData = result.dataUrl;
      renderPreview(imageData);
      meter.textContent = `Imagen lista · ${formatBytes(result.bytes)} · ${result.width}×${result.height} px`;
    } catch (error) {
      meter.className = 'upload-meter error';
      meter.textContent = error.message || 'No se pudo procesar la imagen.';
    } finally {
      processingImage = false;
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = existing ? 'Guardar cambios' : 'Publicar equipo';
      }
    }
  };

  $('#pickImage').onclick = () => fileInput.click();
  preview.onclick = () => fileInput.click();
  removeButton.onclick = () => {
    imageData = '';
    fileInput.value = '';
    renderPreview('');
    meter.className = 'upload-meter';
    meter.textContent = 'Fotografía eliminada del anuncio.';
  };

  fileInput.onchange = () => processFile(fileInput.files?.[0]);

  ['dragenter', 'dragover'].forEach((eventName) => {
    uploader.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploader.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    uploader.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploader.classList.remove('dragover');
    });
  });
  uploader.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    processFile(file);
  });

  form.onsubmit = (event) => {
    event.preventDefault();
    if (processingImage) {
      toast('Espera a que termine la optimización de la imagen.');
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    ['price', 'year', 'hours', 'transport', 'deposit', 'operator'].forEach((key) => {
      data[key] = Number(data[key]);
    });
    data.available = form.querySelector('[name="available"]').checked;

    if (!data.name.trim() || !data.city.trim() || !data.district.trim() || !data.description.trim()) {
      toast('Completa el nombre, la ciudad, el distrito y la descripción.');
      return;
    }
    if (!Number.isFinite(data.price) || data.price < 1) {
      toast('La tarifa diaria debe ser mayor que cero.');
      return;
    }

    if (existing) {
      const backup = { ...existing };
      Object.assign(existing, data, {
        image: imageData,
        verified: user.verified,
        provider: displayName(user)
      });
      if (!saveDB()) {
        Object.assign(existing, backup);
        toast('No se pudieron guardar los cambios. Prueba con una imagen más liviana.');
        return;
      }
    } else {
      const item = {
        id: `eq-${uid()}`,
        ...data,
        image: imageData,
        providerId: user.id,
        provider: displayName(user),
        verified: user.verified,
        rating: 0,
        custom: true
      };
      state.equipment.unshift(item);
      if (!saveDB()) {
        state.equipment.shift();
        toast('No se pudo publicar el equipo. Prueba con una imagen más liviana o elimina anuncios antiguos.');
        return;
      }
    }

    closeModal();
    navigate('equipos');
    toast(existing ? 'Equipo actualizado.' : 'Equipo publicado en el catálogo local.');
  };
}

function toggleEquipment(id) {
  const item = equipmentById(id);
  const user = currentUser();
  if (!item || !user) return;
  if (item.providerId !== user.id) {
    toast('Solo puedes pausar tus propios equipos.');
    return;
  }
  item.available = !item.available;
  saveDB();
  updateShell();
  closeModal();
  if (route === 'equipos') inventory();
  else render();
  toast(item.available ? 'Equipo activado para nuevas solicitudes.' : 'Equipo pausado.');
}

function deleteEquipment(id) {
  const item = equipmentById(id);
  const user = currentUser();
  if (!item || !user) return;
  if (item.providerId !== user.id) {
    toast('Solo puedes eliminar tus propios equipos.');
    return;
  }

  const activeBookings = state.bookings.filter((booking) => (
    booking.equipmentId === id && ['Solicitada', 'Confirmada', 'En curso'].includes(booking.status)
  ));
  if (activeBookings.length) {
    toast('No puedes eliminar un equipo con solicitudes activas. Cancélalas o finalízalas primero.');
    return;
  }

  modal('Eliminar equipo', `
    <p>¿Quieres eliminar <strong>${esc(item.name)}</strong> del catálogo?</p>
    <p class="muted">El historial de alquileres se conserva, pero el anuncio y su fotografía dejarán de estar disponibles. Esta acción no se puede deshacer.</p>
    <div class="form-actions">
      <button data-close>Conservar equipo</button>
      <button class="primary danger-btn" id="confirmDeleteEquipment">Eliminar definitivamente</button>
    </div>`);

  $('#confirmDeleteEquipment').onclick = () => {
    state.equipment = state.equipment.filter((entry) => entry.id !== id);
    Object.keys(state.favorites).forEach((userId) => {
      state.favorites[userId] = state.favorites[userId].filter((entry) => entry !== id);
    });
    compare = compare.filter((entry) => entry !== id);
    saveDB();
    closeModal();
    navigate('equipos');
    toast('Equipo eliminado del catálogo.');
  };
}
