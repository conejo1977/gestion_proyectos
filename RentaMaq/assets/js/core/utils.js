/* ============================================================================
   RentaMaq · Utilidades generales
   ----------------------------------------------------------------------------
   Selectores, formato de datos, fechas, avisos, modales, descargas y
   compresión de imágenes antes de subirlas a la nube.
   ========================================================================== */

'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const money = (value) => new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 2
}).format(Number(value) || 0);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDays = (isoDate, amount) => {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const date = (isoDate) => new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-PE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const daysBetween = (start, end) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const initials = (name) => String(name || 'RentaMaq')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((word) => word[0] || '')
  .join('')
  .toUpperCase();

const formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'Reciente';
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} d`;
};

const imageSrc = (image) => {
  if (!image) return '';
  if (/^(data:|blob:|https?:|assets\/)/.test(image)) return image;
  return `assets/img/${image}`;
};

/* ------------------------- Avisos y ventanas ----------------------------- */

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 4300);
}

function modal(title, html, options = {}) {
  const dialog = $('#modal');
  if (!dialog) return;
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  dialog.classList.toggle('modal-wide', Boolean(options.wide));
  if (!dialog.open) dialog.showModal();
  const body = $('#modalBody');
  if (options.scrollTop !== false) body.scrollTop = 0;
}

function closeModal() {
  const dialog = $('#modal');
  if (dialog?.open) dialog.close();
}

const download = (name, data, type) => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
};

const debounce = (fn, wait = 250) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

/* ------------------------- Estados de carga ------------------------------ */

async function withBusy(button, label, task) {
  if (!button) return task();
  const original = button.innerHTML;
  const wasDisabled = button.disabled;
  button.disabled = true;
  button.classList.add('is-busy');
  if (label) button.textContent = label;
  try {
    return await task();
  } finally {
    if (button.isConnected) {
      button.disabled = wasDisabled;
      button.innerHTML = original;
      button.classList.remove('is-busy');
    }
  }
}

function friendlyError(error) {
  const raw = String(error?.message || error?.error_description || error || '').trim();
  const code = String(error?.code || error?.status || '');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'No hay conexión a Internet. Revisa tu red e inténtalo de nuevo.';
  }
  if (code === 'PGRST205' || /Could not find the table|schema cache|relation .* does not exist/i.test(raw)) {
    return 'La base de datos aún no está configurada. Ejecuta los archivos supabase/schema.sql y supabase/seed.sql en tu proyecto de Supabase.';
  }
  if (/Invalid login credentials/i.test(raw)) {
    return 'Correo o contraseña incorrectos. Revisa los datos e inténtalo otra vez.';
  }
  if (/Email not confirmed/i.test(raw)) {
    return 'Confirma tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada y la carpeta de spam.';
  }
  if (/User already registered/i.test(raw)) {
    return 'Ya existe una cuenta con ese correo. Inicia sesión o usa “¿Olvidaste tu contraseña?”.';
  }
  if (/Password should be at least|Password is too short/i.test(raw)) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (/For security purposes|rate limit|too many requests|over_email_send_rate_limit/i.test(raw)) {
    return 'Demasiados intentos en poco tiempo. Espera unos minutos y vuelve a probar.';
  }
  if (/duplicate key|23505/i.test(raw)) {
    return 'Este registro ya existe. Actualiza la página e inténtalo otra vez.';
  }
  if (/JWT|not authenticated|session|42501|permission denied/i.test(raw)) {
    return 'Tu sesión venció o no tienes permiso para esta acción. Vuelve a iniciar sesión.';
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch|ETIMEDOUT/i.test(raw)) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }
  if (/[áéíóúñ¿]/i.test(raw) || /^(El|La|No|Ya|Solo|Indica|Completa|Selecciona|Tu|Esta|Los|Las|Debes|Confirma|Ingresa|Escribe)\b/.test(raw)) {
    return raw;
  }
  if (raw && raw.length < 140 && !/relation|column|constraint|syntax|violates/i.test(raw)) return raw;
  return 'No pudimos completar la operación. Inténtalo de nuevo en unos segundos.';
}

/* --------------------------- Imágenes ------------------------------------ */

const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
  reader.readAsDataURL(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('El archivo no parece ser una imagen válida.'));
  img.src = src;
});

const dataUrlBytes = (dataUrl) => {
  const base64 = String(dataUrl).split(',')[1] || '';
  return Math.round((base64.length * 3) / 4);
};

const dataUrlToBlob = (dataUrl) => {
  const [header, base64] = String(dataUrl).split(',');
  const mime = /data:([^;]+)/.exec(header || '')?.[1] || 'image/jpeg';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
};

/**
 * Convierte la imagen elegida en un JPEG optimizado para subirlo a Storage.
 * Ajusta dimensión y calidad hasta quedar por debajo del límite indicado.
 */
async function compressImage(file, options = {}) {
  const {
    maxDimension = 1400,
    quality = 0.84,
    maxBytes = 700 * 1024
  } = options;

  if (!file) throw new Error('Selecciona una imagen.');
  if (!/^image\//.test(file.type)) throw new Error('El archivo debe ser una imagen JPG, PNG o WebP.');
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen supera los 12 MB. Elige una más liviana.');

  const original = await readFileAsDataURL(file);
  const img = await loadImage(original);
  let dimension = maxDimension;
  let currentQuality = quality;
  let result = '';
  let finalWidth = img.width;
  let finalHeight = img.height;

  for (let attempt = 0; attempt < 7; attempt++) {
    const scale = Math.min(1, dimension / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(img, 0, 0, width, height);
    result = canvas.toDataURL('image/jpeg', currentQuality);
    finalWidth = width;
    finalHeight = height;
    if (dataUrlBytes(result) <= maxBytes) break;
    currentQuality = Math.max(0.48, currentQuality - 0.09);
    dimension = Math.round(dimension * 0.86);
  }

  const bytes = dataUrlBytes(result);
  if (bytes > maxBytes * 1.2) {
    throw new Error('No se pudo reducir la imagen lo suficiente. Prueba con otra fotografía.');
  }

  return {
    dataUrl: result,
    blob: dataUrlToBlob(result),
    bytes,
    width: finalWidth,
    height: finalHeight
  };
}
