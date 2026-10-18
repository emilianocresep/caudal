// Fechas como texto 'YYYY-MM-DD' (sin zonas horarias = sin sorpresas).

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m: 1-12
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
};
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function today() {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export function addDays(s, days) {
  const { y, m, d } = parse(s);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Suma meses respetando el día original (31 → 28/29/30 cuando haga falta).
export function addMonths(s, months, anchorDay) {
  const { y, m, d } = parse(s);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return toISO(ny, nm, day);
}

export const monthKey = (s) => s.slice(0, 7); // 'YYYY-MM'
export const monthStart = (key) => `${key}-01`;
export function monthEnd(key) {
  const [y, m] = key.split('-').map(Number);
  return toISO(y, m, daysInMonth(y, m));
}
export function shiftMonth(key, n) {
  return addMonths(`${key}-01`, n).slice(0, 7);
}
export function monthsBetween(fromKey, toKey) {
  const out = [];
  let k = fromKey;
  while (k <= toKey && out.length < 600) { out.push(k); k = shiftMonth(k, 1); }
  return out;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const monthName = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
};
export const monthShort = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MESES_C[m - 1]} ${String(y).slice(2)}`;
};
export function weekday(s) {
  const { y, m, d } = parse(s);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
export function prettyDate(s, withYear = false) {
  const { y, m, d } = parse(s);
  return `${d} ${MESES_C[m - 1]}${withYear ? ` ${y}` : ''}`;
}
export function relativeDay(s, ref = today()) {
  if (s === ref) return 'Hoy';
  if (s === addDays(ref, -1)) return 'Ayer';
  if (s === addDays(ref, 1)) return 'Mañana';
  const sameYear = s.slice(0, 4) === ref.slice(0, 4);
  const w = weekday(s);
  return `${w[0].toUpperCase()}${w.slice(1)} ${prettyDate(s, !sameYear)}`;
}
export function daysLeftInMonth(ref = today()) {
  const { y, m, d } = parse(ref);
  return daysInMonth(y, m) - d + 1;
}
