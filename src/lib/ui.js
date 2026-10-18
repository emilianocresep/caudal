// Estado de interfaz compartido: ruta, hoja modal y avisos.
import { signal } from '@preact/signals';

function parseHash() {
  const h = (location.hash || '#/').replace(/^#/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'inicio', id: parts[1] || null, query: new URLSearchParams(qs || '') };
}

export const route = signal(parseHash());
window.addEventListener('hashchange', () => {
  route.value = parseHash();
  window.scrollTo({ top: 0 });
});
export const go = (path) => { location.hash = path; };

// Hojas modales apiladas: [{type: 'tx'|'account'|'category'|'group', props, key}]
export const sheets = signal([]);
export const openSheet = (type, props = {}) => { sheets.value = [...sheets.value, { type, props, key: Date.now() + Math.random() }]; };
export const closeSheet = () => { sheets.value = sheets.value.slice(0, -1); };
export const closeAllSheets = () => { sheets.value = []; };

export const toast = signal(null);
let toastTimer;
export function showToast(text, action) {
  clearTimeout(toastTimer);
  toast.value = { text, action, key: Date.now() };
  toastTimer = setTimeout(() => (toast.value = null), action ? 5000 : 2400);
}
