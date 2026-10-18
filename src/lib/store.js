// Almacén local (IndexedDB) + sincronización con Cloudflare D1.
// La app funciona 100% sin conexión; los cambios se suben en cuanto hay internet.
import { signal, computed, batch } from '@preact/signals';
import { get, set } from 'idb-keyval';
import { expandMovements } from './finance.js';
import { today, addMonths, monthEnd, monthKey } from './dates.js';
import { DEFAULT_CATEGORIES, DEFAULT_BUDGET } from './defaults.js';

const K_RECORDS = 'caudal:records';
const K_META = 'caudal:meta';

const records = new Map(); // id → {id, kind, data, updated_at, deleted}
let meta = { since: 0, dirty: [], seeded: false };
const dirty = new Set();

export const version = signal(0);
export const ready = signal(false);
export const syncState = signal({ status: 'idle', at: 0, message: '' }); // idle|syncing|ok|offline|auth|error

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

// ---------- Vista de datos ----------
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt || 0) - (b.createdAt || 0);

export const db = computed(() => {
  version.value; // dependencia
  const accounts = [], categories = [], txs = [], rules = [];
  let budget = null, settings = {};
  for (const r of records.values()) {
    if (r.deleted) continue;
    const d = { ...r.data, id: r.id };
    switch (r.kind) {
      case 'account': accounts.push(d); break;
      case 'category': categories.push(d); break;
      case 'tx': txs.push(d); break;
      case 'rule': rules.push(d); break;
      case 'budget': budget = d; break;
      case 'settings': settings = d; break;
    }
  }
  accounts.sort(byOrder);
  categories.sort(byOrder);
  const accountsById = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const rulesById = Object.fromEntries(rules.map((r) => [r.id, r]));
  return { accounts, categories, txs, rules, budget, settings, accountsById, categoriesById, rulesById };
});

/** Horizonte: hoy + 24 meses (para proyecciones y MSI). */
export const horizon = computed(() => monthEnd(monthKey(addMonths(today(), 24))));
export const movements = computed(() => expandMovements(db.value, horizon.value));

// ---------- Escritura ----------
let persistTimer = null;
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 150);
}
async function persistNow() {
  meta.dirty = [...dirty];
  try {
    await set(K_RECORDS, [...records.values()]);
    await set(K_META, meta);
  } catch (e) { console.warn('No se pudo guardar localmente', e); }
}

export function put(kind, data) {
  const id = data.id || uid();
  const prev = records.get(id);
  const clean = { ...data };
  delete clean.id;
  if (!clean.createdAt) clean.createdAt = prev?.data?.createdAt || Date.now();
  records.set(id, { id, kind, data: clean, updated_at: Math.max(Date.now(), (prev?.updated_at || 0) + 1), deleted: false });
  dirty.add(id);
  version.value++;
  persistSoon();
  syncSoon();
  return id;
}

export function remove(id) {
  const prev = records.get(id);
  if (!prev) return;
  records.set(id, { ...prev, deleted: true, updated_at: Math.max(Date.now(), prev.updated_at + 1) });
  dirty.add(id);
  version.value++;
  persistSoon();
  syncSoon();
}

export function putMany(list) {
  batch(() => list.forEach(([kind, data]) => put(kind, data)));
}

// ---------- Sincronización ----------
let syncTimer = null;
let syncing = false;
let again = false;

export function syncSoon(ms = 800) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, ms);
}

function mergeRow(row) {
  const local = records.get(row.id);
  if (local && dirty.has(row.id) && local.updated_at > row.updated_at) return false;
  if (local && local.updated_at > row.updated_at) return false;
  records.set(row.id, { id: row.id, kind: row.kind, data: row.data, updated_at: row.updated_at, deleted: row.deleted });
  dirty.delete(row.id);
  return true;
}

async function post(body) {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    redirect: 'manual', // si Access pide iniciar sesión, responde con una redirección
    body: JSON.stringify(body),
  });
  const type = res.headers.get('content-type') || '';
  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400) || !type.includes('json')) {
    const err = new Error('Cloudflare Access pide iniciar sesión'); err.code = 'auth'; throw err;
  }
  if (res.status === 401 || res.status === 403) {
    let msg = 'Sesión no válida';
    try { msg = (await res.json()).message || msg; } catch { /* sin detalle */ }
    const err = new Error(msg); err.code = 'auth'; throw err;
  }
  const data = await res.json();
  if (!res.ok) { const err = new Error(data.message || 'Error del servidor'); err.code = data.error; throw err; }
  return data;
}

export async function syncNow() {
  if (syncing) { again = true; return; }
  if (!navigator.onLine) { syncState.value = { ...syncState.value, status: 'offline' }; return; }
  syncing = true;
  syncState.value = { ...syncState.value, status: 'syncing' };
  try {
    // 1) subir cambios en bloques
    const pending = [...dirty].map((id) => records.get(id)).filter(Boolean);
    let lastRev = meta.since;
    let changed = false;
    const sentAt = new Map(pending.map((r) => [r.id, r.updated_at]));
    for (let i = 0; i < Math.max(1, pending.length); i += 400) {
      const chunk = pending.slice(i, i + 400);
      let res = await post({ since: meta.since, changes: chunk });
      for (const row of res.rows) changed = mergeRow(row) || changed;
      while (res.more) {
        res = await post({ since: meta.since, cursor: res.cursor, changes: [] });
        for (const row of res.rows) changed = mergeRow(row) || changed;
      }
      lastRev = Math.max(lastRev, res.rev);
      // limpiar sucios que no cambiaron mientras se enviaban
      for (const r of chunk) if (records.get(r.id)?.updated_at === sentAt.get(r.id)) dirty.delete(r.id);
    }
    meta.since = lastRev;
    if (changed) version.value++;
    await persistNow();
    syncState.value = { status: 'ok', at: Date.now(), message: '' };
  } catch (e) {
    if (!navigator.onLine) syncState.value = { ...syncState.value, status: 'offline' };
    else if (e.code === 'auth') syncState.value = { ...syncState.value, status: 'auth', message: e.message || 'Tu sesión expiró' };
    else syncState.value = { ...syncState.value, status: 'error', message: e.message || 'Sin conexión con el servidor' };
  } finally {
    syncing = false;
    if (again) { again = false; syncSoon(200); }
  }
}

/** Abre el inicio de sesión de Cloudflare Access y regresa a la app. */
export function login() { location.href = '/api/login'; }

export const pendingCount = computed(() => { version.value; syncState.value; return dirty.size; });

// ---------- Arranque ----------
function seedDefaults() {
  // IDs fijos y updated_at = 1: si otro dispositivo ya los tiene (o los borró), gana el servidor.
  const seed = (kind, data) => {
    if (records.has(data.id)) return;
    const clean = { ...data }; delete clean.id;
    records.set(data.id, { id: data.id, kind, data: clean, updated_at: 1, deleted: false });
    dirty.add(data.id);
  };
  DEFAULT_CATEGORIES.forEach((c, i) => seed('category', { ...c, order: i, createdAt: 1 }));
  seed('budget', DEFAULT_BUDGET);
  meta.seeded = true;
}

export async function init() {
  try {
    const [recs, m] = await Promise.all([get(K_RECORDS), get(K_META)]);
    if (Array.isArray(recs)) recs.forEach((r) => records.set(r.id, r));
    if (m) { meta = { ...meta, ...m }; (m.dirty || []).forEach((id) => dirty.add(id)); }
  } catch (e) { console.warn('IndexedDB no disponible', e); }

  if (!meta.seeded) {
    if (navigator.onLine) await syncNow();
    if (![...records.values()].some((r) => r.kind === 'category')) seedDefaults();
    else meta.seeded = true;
    await persistNow();
  }
  version.value++;
  ready.value = true;
  syncSoon(50);

  window.addEventListener('online', () => syncSoon(100));
  window.addEventListener('offline', () => (syncState.value = { ...syncState.value, status: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSoon(100); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60_000);
}

// ---------- Respaldo ----------
export function exportBackup() {
  return { app: 'caudal', version: 1, exportedAt: new Date().toISOString(), records: [...records.values()] };
}
export function importBackup(json) {
  if (!json || json.app !== 'caudal' || !Array.isArray(json.records)) throw new Error('Archivo de respaldo no válido');
  let n = 0;
  for (const r of json.records) {
    const local = records.get(r.id);
    if (!local || r.updated_at > local.updated_at) {
      records.set(r.id, { ...r, updated_at: Math.max(r.updated_at, (local?.updated_at || 0) + 1) });
      dirty.add(r.id); n++;
    }
  }
  version.value++;
  persistSoon(); syncSoon(100);
  return n;
}

// ---------- Preferencias del dispositivo (último uso) ----------
export function devicePref(key, fallback) {
  try { const v = localStorage.getItem(`caudal:${key}`); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function setDevicePref(key, value) {
  try { localStorage.setItem(`caudal:${key}`, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
}
