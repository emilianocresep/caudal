// Motor financiero: funciones puras (sin interfaz) — fáciles de probar.
import { addDays, addMonths, parse, today, monthKey, monthStart, monthEnd, monthsBetween, daysLeftInMonth } from './dates.js';
import { splitInstallments } from './money.js';

export const FREQS = {
  semanal: { label: 'Cada semana', short: 'semanal' },
  quincenal: { label: 'Cada 2 semanas', short: 'quincenal' },
  mensual: { label: 'Cada mes', short: 'mensual' },
  anual: { label: 'Cada año', short: 'anual' },
};

const MAX_OCC = 5000;

function stepDate(rule, k) {
  const anchor = parse(rule.start).d;
  switch (rule.freq) {
    case 'semanal': return addDays(rule.start, 7 * k);
    case 'quincenal': return addDays(rule.start, 14 * k);
    case 'anual': return addMonths(rule.start, 12 * k, anchor);
    default: return addMonths(rule.start, k, anchor);
  }
}

/** Fecha límite exclusiva por duración en meses (o null). */
function durationEnd(rule) {
  if (rule.durationType === 'meses' && rule.months > 0) return addMonths(rule.start, rule.months, parse(rule.start).d);
  return null;
}

/** Número total de pagos si la regla es finita, si no null. */
export function ruleCount(rule) {
  if (rule.durationType === 'pagos' && rule.count > 0) return rule.count;
  const endEx = durationEnd(rule);
  if (!endEx) return null;
  let k = 0;
  while (k < MAX_OCC && stepDate(rule, k) < endEx) k++;
  return k;
}

/** Montos por pago (centavos). Si se capturó el total (MSI), se reparte exacto. */
function amountsFor(rule) {
  const n = ruleCount(rule);
  if (rule.totalMode && n) return splitInstallments(rule.total || 0, n);
  return null;
}

/**
 * Ocurrencias de una regla periódica entre [from, to] (inclusive).
 * Devuelve [{date, n, of, amount}]; n empieza en 1.
 */
export function ruleOccurrences(rule, from, to) {
  if (!rule || !rule.start || rule.start > to) return [];
  const count = ruleCount(rule);
  const endEx = durationEnd(rule);
  const stop = rule.end || null; // fin manual (inclusive)
  const skips = new Set(rule.skips || []);
  const split = amountsFor(rule);
  const out = [];
  for (let k = 0; k < MAX_OCC; k++) {
    if (count != null && k >= count) break;
    const date = stepDate(rule, k);
    if (date > to) break;
    if (endEx && date >= endEx) break;
    if (stop && date > stop) break;
    if (date >= from && !skips.has(date)) {
      out.push({ date, n: k + 1, of: count, amount: split ? split[k] : rule.amount || 0 });
    }
  }
  return out;
}

/** Fecha del último pago de una regla finita. */
export function ruleLastDate(rule) {
  const count = ruleCount(rule);
  if (count == null) return rule.end || null;
  const last = stepDate(rule, count - 1);
  return rule.end && rule.end < last ? rule.end : last;
}

/**
 * Expande movimientos únicos + recurrentes hasta `horizon`.
 * Cada movimiento: {id, src, ruleId?, date, type, amount, accountId, toAccountId, categoryId, note, n, of}
 */
export function expandMovements(db, horizon) {
  const out = [];
  for (const t of db.txs) {
    if (t.date <= horizon) out.push({ ...t, src: 'tx' });
  }
  for (const r of db.rules) {
    for (const o of ruleOccurrences(r, '0000-01-01', horizon)) {
      out.push({
        id: `${r.id}@${o.date}`, src: 'rule', ruleId: r.id, date: o.date,
        type: r.type, amount: o.amount, accountId: r.accountId, toAccountId: r.toAccountId,
        categoryId: r.categoryId, note: r.note, n: o.n, of: o.of,
      });
    }
  }
  out.sort((a, b) => (a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : a.date < b.date ? 1 : -1));
  return out;
}

/** Efecto (centavos) de un movimiento sobre una cuenta. */
export function effectOn(mv, accountId) {
  if (mv.type === 'gasto') return mv.accountId === accountId ? -mv.amount : 0;
  if (mv.type === 'ingreso') return mv.accountId === accountId ? mv.amount : 0;
  if (mv.type === 'transferencia') {
    let e = 0;
    if (mv.accountId === accountId) e -= mv.amount;
    if (mv.toAccountId === accountId) e += mv.amount;
    return e;
  }
  return 0;
}

const touches = (mv, id) => mv.accountId === id || (mv.type === 'transferencia' && mv.toAccountId === id);

/**
 * Saldo de una cuenta a una fecha. El saldo inicial es el saldo al inicio de `initialDate`;
 * los movimientos anteriores a esa fecha ya están "incluidos" y no se vuelven a contar.
 */
export function accountBalance(account, movements, asOf = today()) {
  let bal = account.initial || 0;
  const start = account.initialDate || '0000-01-01';
  for (const mv of movements) {
    if (mv.date < start || mv.date > asOf) continue;
    bal += effectOn(mv, account.id);
  }
  return bal;
}

/** ¿Este movimiento quedó antes del saldo inicial de su cuenta? (no afecta el saldo) */
export function beforeInitial(mv, accountsById) {
  const a = accountsById[mv.accountId];
  return !!(a && a.initialDate && mv.date < a.initialDate);
}

/** Pagos futuros pendientes en una cuenta (MSI, suscripciones con fin…). */
export function pendingForAccount(account, db, ref = today()) {
  let total = 0;
  const items = [];
  for (const r of db.rules) {
    if (r.accountId !== account.id || r.type !== 'gasto') continue;
    const count = ruleCount(r);
    if (count == null) continue;
    const last = ruleLastDate(r);
    if (!last || last <= ref) continue;
    const future = ruleOccurrences(r, addDays(ref, 1), last);
    const sum = future.reduce((s, o) => s + o.amount, 0);
    if (sum > 0) {
      total += sum;
      items.push({ rule: r, remaining: future.length, sum, next: future[0]?.date });
    }
  }
  return { total, items };
}

/** Saldo al final de cada mes (para gráficas). */
export function balanceSeries(accounts, movements, months) {
  return months.map((k) => {
    const end = monthEnd(k);
    const ref = end > today() ? today() : end;
    if (!accounts.some((a) => !a.initialDate || a.initialDate <= end)) return null;
    return accounts.reduce((s, a) => s + (a.initialDate && a.initialDate > end ? 0 : accountBalance(a, movements, ref)), 0);
  });
}

/** Filtra movimientos. f: {from,to,accountId,categoryIds:Set,type,q} */
export function filterMovements(movements, f = {}) {
  const q = (f.q || '').trim().toLowerCase();
  return movements.filter((mv) => {
    if (f.from && mv.date < f.from) return false;
    if (f.to && mv.date > f.to) return false;
    if (f.accountId && !touches(mv, f.accountId)) return false;
    if (f.type && mv.type !== f.type) return false;
    if (f.categoryIds && f.categoryIds.size && !f.categoryIds.has(mv.categoryId || '_none')) return false;
    if (q && !(mv.note || '').toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Totales de un conjunto de movimientos (las transferencias no son ingreso ni gasto). */
export function totals(movements, accountId) {
  let income = 0, expense = 0, tin = 0, tout = 0;
  for (const mv of movements) {
    if (mv.type === 'ingreso') income += mv.amount;
    else if (mv.type === 'gasto') expense += mv.amount;
    else if (accountId) {
      if (mv.toAccountId === accountId) tin += mv.amount;
      if (mv.accountId === accountId) tout += mv.amount;
    }
  }
  return { income, expense, net: income - expense, tin, tout };
}

export function byCategory(movements, type = 'gasto') {
  const m = new Map();
  for (const mv of movements) {
    if (mv.type !== type) continue;
    const k = mv.categoryId || '_none';
    m.set(k, (m.get(k) || 0) + mv.amount);
  }
  return [...m.entries()].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount);
}

/** Serie mensual de ingresos/gastos (opcionalmente por categoría). */
export function monthlySeries(movements, months, { type = 'gasto', categoryId, accountId } = {}) {
  const idx = new Map(months.map((k, i) => [k, i]));
  const arr = months.map(() => 0);
  for (const mv of movements) {
    if (mv.type !== type) continue;
    if (categoryId && (mv.categoryId || '_none') !== categoryId) continue;
    if (accountId && mv.accountId !== accountId) continue;
    const i = idx.get(monthKey(mv.date));
    if (i != null) arr[i] += mv.amount;
  }
  return arr;
}

export function monthRange(key) {
  return { from: monthStart(key), to: monthEnd(key) };
}

/**
 * Presupuesto del mes según prioridades.
 * budget = {groups:[{id,name,pct,priority,categoryIds:[],accountIds:[]}]}
 */
export function computeBudget(db, movements, key, ref = today()) {
  const { from, to } = monthRange(key);
  const inMonth = movements.filter((m) => m.date >= from && m.date <= to);
  const incomeAll = inMonth.filter((m) => m.type === 'ingreso');
  const income = incomeAll.reduce((s, m) => s + m.amount, 0);
  const incomeReceived = incomeAll.filter((m) => m.date <= ref).reduce((s, m) => s + m.amount, 0);
  const groups = (db.budget?.groups || []).slice().sort((a, b) => PRIO[a.priority] - PRIO[b.priority]);
  const assigned = new Map();
  groups.forEach((g) => (g.categoryIds || []).forEach((c) => assigned.set(c, g.id)));

  const isCurrent = key === monthKey(ref);
  const daysLeft = isCurrent ? daysLeftInMonth(ref) : key > monthKey(ref) ? null : 0;

  const result = groups.map((g) => {
    const target = Math.round((income * (g.pct || 0)) / 100);
    const cats = new Set(g.categoryIds || []);
    const accs = new Set(g.accountIds || []);
    let spent = 0, scheduled = 0;
    const perCat = new Map();
    for (const m of inMonth) {
      let amt = 0;
      if (m.type === 'gasto' && cats.has(m.categoryId)) amt = m.amount;
      else if (m.type === 'transferencia' && accs.has(m.toAccountId) && !accs.has(m.accountId)) amt = m.amount;
      if (!amt) continue;
      if (m.date <= ref) spent += amt; else scheduled += amt;
      const k = m.type === 'transferencia' ? `acc:${m.toAccountId}` : m.categoryId;
      perCat.set(k, (perCat.get(k) || 0) + amt);
    }
    const committed = spent + scheduled;
    const remaining = target - committed;
    return {
      ...g, target, spent, scheduled, committed, remaining,
      daily: daysLeft ? Math.max(0, Math.floor(remaining / daysLeft)) : null,
      ratio: target > 0 ? committed / target : committed > 0 ? Infinity : 0,
      perCat: [...perCat.entries()].map(([k, v]) => ({ key: k, amount: v })).sort((a, b) => b.amount - a.amount),
    };
  });

  const unassigned = inMonth
    .filter((m) => m.type === 'gasto' && !assigned.has(m.categoryId))
    .reduce((s, m) => s + m.amount, 0);
  const pctTotal = groups.reduce((s, g) => s + (Number(g.pct) || 0), 0);
  return { income, incomeReceived, groups: result, unassigned, pctTotal, daysLeft };
}

export const PRIO = { alta: 0, media: 1, baja: 2 };
