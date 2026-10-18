import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleOccurrences, ruleCount, expandMovements, accountBalance, pendingForAccount, computeBudget, totals } from '../src/lib/finance.js';
import { addMonths } from '../src/lib/dates.js';
import { toCents, splitInstallments } from '../src/lib/money.js';

test('fechas: fin de mes se ajusta', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-01-31', 2, 31), '2026-03-31');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
});

test('dinero: parseo y reparto exacto', () => {
  assert.equal(toCents('1,234.50'), 123450);
  assert.equal(toCents('99,5'), 9950);
  assert.equal(toCents('$ 1 000'), 100000);
  const p = splitInstallments(100000, 3);
  assert.deepEqual(p, [33334, 33333, 33333]);
  assert.equal(p.reduce((a, b) => a + b, 0), 100000);
});

test('MSI 12 meses iniciado en el pasado', () => {
  const r = { id: 'r1', type: 'gasto', freq: 'mensual', start: '2026-03-31', durationType: 'meses', months: 12, totalMode: true, total: 1200000, accountId: 'tc' };
  assert.equal(ruleCount(r), 12);
  const all = ruleOccurrences(r, '0000-01-01', '2030-01-01');
  assert.equal(all.length, 12);
  assert.equal(all[0].date, '2026-03-31');
  assert.equal(all[1].date, '2026-04-30');
  assert.equal(all[11].date, '2027-02-28');
  assert.equal(all.reduce((s, o) => s + o.amount, 0), 1200000);
  const pend = pendingForAccount({ id: 'tc' }, { rules: [r] }, '2026-10-18');
  assert.equal(pend.items[0].remaining, 5); // oct 31, nov, dic, ene, feb
  assert.equal(pend.total, 500000);
});

test('ingreso semanal indefinido y con omisión', () => {
  const r = { id: 'p', type: 'ingreso', freq: 'semanal', start: '2026-10-02', durationType: 'indefinido', amount: 300000, skips: ['2026-10-16'] };
  const occ = ruleOccurrences(r, '2026-10-01', '2026-10-31');
  assert.deepEqual(occ.map((o) => o.date), ['2026-10-02', '2026-10-09', '2026-10-23', '2026-10-30']);
  assert.equal(ruleCount(r), null);
});

test('saldo respeta saldo inicial y transferencias', () => {
  const db = {
    txs: [
      { id: 't0', type: 'gasto', amount: 5000, accountId: 'deb', date: '2026-09-30' }, // antes del inicial: no cuenta
      { id: 't1', type: 'gasto', amount: 10000, accountId: 'deb', date: '2026-10-05' },
      { id: 't2', type: 'transferencia', amount: 20000, accountId: 'deb', toAccountId: 'cash', date: '2026-10-06' },
      { id: 't3', type: 'ingreso', amount: 100000, accountId: 'deb', date: '2026-10-30' }, // futuro
    ],
    rules: [],
  };
  const mv = expandMovements(db, '2026-12-31');
  const deb = { id: 'deb', initial: 50000, initialDate: '2026-10-01' };
  const cash = { id: 'cash', initial: 0, initialDate: '2026-10-01' };
  assert.equal(accountBalance(deb, mv, '2026-10-18'), 50000 - 10000 - 20000);
  assert.equal(accountBalance(cash, mv, '2026-10-18'), 20000);
  const t = totals(mv.filter((m) => m.date <= '2026-10-18'));
  assert.equal(t.expense, 15000);
  assert.equal(t.income, 0);
});

test('presupuesto 60/20/20 con ingresos periódicos', () => {
  const db = {
    txs: [
      { id: 'a', type: 'gasto', amount: 150000, accountId: 'deb', categoryId: 'comida', date: '2026-10-10' },
      { id: 'b', type: 'transferencia', amount: 400000, accountId: 'deb', toAccountId: 'ahorro', date: '2026-10-11' },
    ],
    rules: [
      { id: 'sueldo', type: 'ingreso', freq: 'quincenal', start: '2026-10-01', durationType: 'indefinido', amount: 500000, accountId: 'deb' },
      { id: 'game', type: 'gasto', freq: 'mensual', start: '2026-01-25', durationType: 'indefinido', amount: 20000, accountId: 'deb', categoryId: 'juegos' },
    ],
    budget: {
      groups: [
        { id: 'g1', name: 'Ahorro', pct: 60, priority: 'alta', categoryIds: [], accountIds: ['ahorro'] },
        { id: 'g2', name: 'Necesarios', pct: 20, priority: 'media', categoryIds: ['comida'] },
        { id: 'g3', name: 'Placer', pct: 20, priority: 'baja', categoryIds: ['juegos'] },
      ],
    },
  };
  const mv = expandMovements(db, '2026-12-31');
  const b = computeBudget(db, mv, '2026-10', '2026-10-18');
  assert.equal(b.income, 1500000); // 1, 15 y 29 de octubre
  assert.equal(b.incomeReceived, 1000000);
  const [ahorro, nec, placer] = b.groups;
  assert.equal(ahorro.target, 900000);
  assert.equal(ahorro.spent, 400000);
  assert.equal(nec.target, 300000);
  assert.equal(nec.remaining, 150000);
  assert.equal(placer.scheduled, 20000); // suscripción del 25 aún no llega
  assert.equal(b.pctTotal, 100);
});
