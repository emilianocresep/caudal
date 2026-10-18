import { useState } from 'preact/hooks';
import { db, movements } from '../lib/store.js';
import { accountBalance, pendingForAccount, filterMovements, totals, monthRange } from '../lib/finance.js';
import { today, monthKey, monthEnd, prettyDate } from '../lib/dates.js';
import { money, money0 } from '../lib/money.js';
import { openSheet } from '../lib/ui.js';
import { ACCOUNT_TYPES } from '../lib/defaults.js';
import { Money, Aura, MovementList, MonthPicker, Orb } from '../components/ui.jsx';
import { IChevL, IEdit, IPlus } from '../components/icons.jsx';

export function Account({ id }) {
  const dbv = db.value;
  const a = dbv.accountsById[id];
  const [mk, setMk] = useState(monthKey(today()));
  if (!a) return <div class="page"><a class="back" href="#/"><IChevL /> Inicio</a><div class="card empty">Esta cuenta no existe.</div></div>;

  const mv = movements.value;
  const bal = accountBalance(a, mv);
  const credit = a.type === 'credito';
  const pend = pendingForAccount(a, dbv);
  const { from, to } = monthRange(mk);
  const items = filterMovements(mv, { from, to, accountId: a.id });
  const past = items.filter((m) => m.date <= today());
  const t = totals(past, a.id);
  const endBal = accountBalance(a, mv, monthEnd(mk) < today() ? monthEnd(mk) : today());

  return (
    <div class="page">
      <div class="topbar">
        <a class="back" href="#/"><IChevL /> Inicio</a>
        <div class="actions">
          <button class="iconbtn" aria-label="Editar cuenta" onClick={() => openSheet('account', { account: a })}><IEdit /></button>
        </div>
      </div>

      <div class="desk-2">
        <div>
          <div class="acct-hero">
            <Aura account={a} big />
            <div class="tiny dim" style={{ textTransform: 'uppercase' }}>{ACCOUNT_TYPES[a.type]?.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '2px' }}>{a.name}</div>
            <div style={{ marginTop: '26px' }} class="dim small">{credit ? 'Deuda actual' : 'Saldo disponible'}</div>
            <Money cents={credit ? Math.max(0, -bal) : bal} />
            {credit && (
              <div class="row small dim" style={{ flexWrap: 'wrap', gap: '14px', marginTop: '6px' }}>
                {a.creditLimit ? <span>Límite {money0(a.creditLimit)}</span> : null}
                {a.creditLimit ? <span>Disponible {money0(a.creditLimit + bal - pend.total)}</span> : null}
                <span>MSI por pagar {money0(pend.total)}</span>
              </div>
            )}
            <div class="row" style={{ marginTop: '20px', gap: '8px', flexWrap: 'wrap' }}>
              <button class="btn sm primary" onClick={() => openSheet('tx', { defaults: { accountId: a.id, type: 'gasto' } })}><IPlus /> Gasto</button>
              <button class="btn sm" onClick={() => openSheet('tx', { defaults: { accountId: a.id, type: 'ingreso' } })}>Ingreso</button>
              <button class="btn sm" onClick={() => openSheet('tx', { defaults: { accountId: a.id, type: 'transferencia' } })}>{credit ? 'Pagar' : 'Transferir'}</button>
            </div>
          </div>

          {pend.items.length > 0 && (
            <div class="section">
              <div class="section-head"><h2>Pagos pendientes</h2><span class="small dim num">{money(pend.total)}</span></div>
              <div class="list">
                {pend.items.map((p) => {
                  const cat = dbv.categoriesById[p.rule.categoryId];
                  return (
                    <button class="mv" onClick={() => openSheet('tx', { mv: { src: 'rule', ruleId: p.rule.id, date: p.next, n: null, of: null } })}>
                      <Orb cat={cat} />
                      <div class="info">
                        <div class="title">{p.rule.note || cat?.name || 'Pago periódico'}</div>
                        <div class="subt">Faltan {p.remaining} · próximo {prettyDate(p.next)}</div>
                      </div>
                      <div class="amt num">{money(p.sum)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <div class="section" style={{ marginTop: '22px' }}>
            <div class="row between" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <MonthPicker value={mk} onChange={setMk} />
              <span class="small dim">Saldo al cierre: <b class="num" style={{ color: 'var(--text)' }}>{money(credit ? -endBal : endBal)}</b></span>
            </div>
            <div class="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div class="kpi"><div class="k">Ingresos</div><div class="v num-prop" style={{ fontSize: '16px' }}>{money0(t.income)}</div></div>
              <div class="kpi"><div class="k">Gastos</div><div class="v num-prop" style={{ fontSize: '16px' }}>{money0(t.expense)}</div></div>
              <div class="kpi"><div class="k">Transf. netas</div><div class="v num-prop" style={{ fontSize: '16px' }}>{money0(t.tin - t.tout)}</div></div>
            </div>
            <MovementList items={items} accountId={a.id} showAccount={false} onOpen={(m) => openSheet('tx', { mv: m })} />
          </div>
        </div>
      </div>
    </div>
  );
}
