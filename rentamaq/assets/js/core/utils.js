/* ============================================================================
   RentaMaq · Utilidades generales
   ----------------------------------------------------------------------------
   Selectores, formato de datos, fechas, avisos, modales, descargas, hash de
   contraseñas y compresión de imágenes para publicar equipos.
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

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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

/* ------------------------------ SHA-256 ---------------------------------- */

function sha256(text) {
  const bytes = new TextEncoder().encode(String(text));
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const maxWord = Math.pow(2, 32);
  let result = '';
  let words = [];
  const asciiBitLength = bytes.length * 8;

  const hash = sha256.h = sha256.h || [];
  const k = sha256.k = sha256.k || [];
  let primeCounter = k.length;
  const isComposite = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  const ascii = Array.from(bytes, (byte) => String.fromCharCode(byte));
  ascii.push('\x80');
  while (ascii.length % 64 !== 56) ascii.push('\x00');

  for (let i = 0; i < ascii.length; i++) {
    const code = ascii[i].charCodeAt(0);
    words[i >> 2] |= code << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  let current = hash.slice(0, 8);

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = current.slice();
    let working = current.slice();

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = working[0];
      const e = working[4];
      const temp1 = (working[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & working[5]) ^ ((~e) & working[6]))
        + k[i]
        + (w[i] = i < 16 ? w[i] : (w[i - 16]
          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + w[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0));
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & working[1]) ^ (a & working[2]) ^ (working[1] & working[2]));

      working = [(temp1 + temp2) | 0].concat(working);
      working[4] = (working[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) working[i] = (working[i] + oldHash[i]) | 0;
    current = working.slice(0, 8);
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const byte = (current[i] >> (j * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

const hashPassword = (salt, password) => sha256(`${salt}:${password}`);

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

/**
 * Convierte una imagen elegida por el usuario en un JPEG optimizado para
 * guardarse en localStorage. Mantiene una relación de aspecto y reduce la
 * calidad y el tamaño hasta quedar por debajo del límite indicado.
 */
async function compressImage(file, options = {}) {
  const {
    maxDimension = 1200,
    quality = 0.82,
    maxBytes = 360 * 1024
  } = options;

  if (!file) throw new Error('Selecciona una imagen.');
  if (!/^image\//.test(file.type)) throw new Error('El archivo debe ser una imagen JPG, PNG o WebP.');
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen supera los 12 MB. Elige una más liviana.');

  const original = await readFileAsDataURL(file);
  const img = await loadImage(original);
  let dimension = maxDimension;
  let currentQuality = quality;
  let result = '';

  for (let attempt = 0; attempt < 6; attempt++) {
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
    if (dataUrlBytes(result) <= maxBytes) break;
    currentQuality = Math.max(0.5, currentQuality - 0.1);
    dimension = Math.round(dimension * 0.85);
  }

  return {
    dataUrl: result,
    bytes: dataUrlBytes(result),
    width: Math.round(img.width * Math.min(1, dimension / Math.max(img.width, img.height))),
    height: Math.round(img.height * Math.min(1, dimension / Math.max(img.width, img.height)))
  };
}
