import { useState } from 'preact/hooks';
import { db, movements, put, uid } from '../lib/store.js';
import { computeBudget } from '../lib/finance.js';
import { today, monthKey, monthName } from '../lib/dates.js';
import { money, money0 } from '../lib/money.js';
import { openSheet } from '../lib/ui.js';
import { SERIES, DEFAULT_BUDGET } from '../lib/defaults.js';
import { MonthPicker, Seg, catColor } from '../components/ui.jsx';
import { IEdit, IPlus, ITrash, ICheck } from '../components/icons.jsx';

const PRESETS = [
  { name: '60 / 20 / 20', pcts: [60, 20, 20] },
  { name: '50 / 30 / 20', pcts: [20, 50, 30] },
  { name: '70 / 20 / 10', pcts: [20, 70, 10] },
];
const PRIO_LABEL = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

function Editor({ budget, onDone }) {
  const { categories, accounts } = db.value;
  const [groups, setGroups] = useState(budget.groups.map((g) => ({ ...g, categoryIds: [...(g.categoryIds || [])], accountIds: [...(g.accountIds || [])] })));
  const total = groups.reduce((s, g) => s + (Number(g.pct) || 0), 0);
  const upd = (i, patch) => setGroups(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const toggleCat = (i, cid) => setGroups(groups.map((g, j) => {
    const has = g.categoryIds.includes(cid);
    if (j === i) return { ...g, categoryIds: has ? g.categoryIds.filter((x) => x !== cid) : [...g.categoryIds, cid] };
    return { ...g, categoryIds: g.categoryIds.filter((x) => x !== cid) }; // una categoría pertenece a un solo grupo
  }));
  const toggleAcc = (i, aid) => upd(i, { accountIds: groups[i].accountIds.includes(aid) ? groups[i].accountIds.filter((x) => x !== aid) : [...groups[i].accountIds, aid] });
  const applyPreset = (p) => {
    // Los presets asumen el orden Ahorro / Necesarios / Placer
    const byName = (n) => groups.findIndex((g) => g.name.toLowerCase().startsWith(n));
    const idx = [byName('ahorro'), byName('necesar'), byName('placer')];
    if (idx.some((x) => x < 0)) return setGroups(groups.map((g, i) => ({ ...g, pct: p.pcts[i] ?? 0 })));
    setGroups(groups.map((g, i) => ({ ...g, pct: idx.includes(i) ? p.pcts[idx.indexOf(i)] : 0 })));
  };
  function save() {
    put('budget', { ...budget, groups: groups.map((g) => ({ ...g, pct: Number(g.pct) || 0 })) });
    onDone();
  }
  const expenseCats = categories.filter((c) => c.kind === 'gasto');

  return (
    <div>
      <div class="card">
        <div class="row between"><b>Repartos rápidos</b><span class={`small num ${total === 100 ? 'pos' : 'warn'}`}>Total {total}%</span></div>
        <div class="chips" style={{ marginTop: '10px' }}>
          {PRESETS.map((p) => <button class="chip" onClick={() => applyPreset(p)}>{p.name}</button>)}
        </div>
        <p class="hint" style={{ marginBottom: 0 }}>Ahorro / Necesarios / Placer. Ajusta cada porcentaje abajo; deben sumar 100%.</p>
      </div>

      {groups.map((g, i) => (
        <div class="card" style={{ marginTop: '12px' }}>
          <div class="row" style={{ gap: '10px' }}>
            <input class="input" value={g.name} onInput={(e) => upd(i, { name: e.currentTarget.value })} style={{ flex: 1, fontWeight: 600 }} aria-label="Nombre del grupo" />
            <div class="row" style={{ gap: '4px' }}>
              <input class="input num" inputMode="numeric" value={g.pct} onInput={(e) => upd(i, { pct: e.currentTarget.value.replace(/[^\d]/g, '').slice(0, 3) })} style={{ width: '64px', textAlign: 'right' }} aria-label="Porcentaje" />
              <span class="dim">%</span>
            </div>
            <button class="iconbtn" aria-label="Eliminar grupo" onClick={() => setGroups(groups.filter((_, j) => j !== i))}><ITrash /></button>
          </div>
          <input type="range" min="0" max="100" value={g.pct} onInput={(e) => upd(i, { pct: e.currentTarget.value })} style={{ width: '100%', marginTop: '12px', accentColor: SERIES[i % SERIES.length] }} aria-label={`Porcentaje de ${g.name}`} />
          <div class="field"><span>Prioridad</span>
            <Seg small value={g.priority} onChange={(v) => upd(i, { priority: v })} options={[['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']]} />
          </div>
          <div class="field"><span>Categorías de gasto en este grupo</span>
            <div class="chips">
              {expenseCats.map((c) => (
                <button class={`chip ${g.categoryIds.includes(c.id) ? 'on' : ''}`} style={{ '--c': catColor(c), height: '32px', fontSize: '12.5px' }} onClick={() => toggleCat(i, c.id)}><span class="e">{c.icon}</span>{c.name}</button>
              ))}
            </div>
          </div>
          <div class="field"><span>Cuentas destino (lo que transfieras ahí cuenta para este grupo)</span>
            <div class="chips">
              {accounts.filter((a) => !a.archived).map((a) => (
                <button class={`chip ${g.accountIds.includes(a.id) ? 'on' : ''}`} style={{ height: '32px', fontSize: '12.5px' }} onClick={() => toggleAcc(i, a.id)}>{a.name}</button>
              ))}
            </div>
            <span class="hint">Ideal para Ahorro: elige tu cuenta de ahorro y registra transferencias hacia ella.</span>
          </div>
        </div>
      ))}

      <div class="row" style={{ marginTop: '14px', gap: '10px' }}>
        <button class="btn" onClick={() => setGroups([...groups, { id: uid(), name: 'Nuevo grupo', pct: 0, priority: 'media', categoryIds: [], accountIds: [] }])}><IPlus /> Grupo</button>
        <div class="spacer" />
        <button class="btn ghost" onClick={onDone}>Cancelar</button>
        <button class="btn grad" onClick={save}><ICheck /> Guardar</button>
      </div>
      {total !== 100 && <div class="note-box warn">Tus porcentajes suman {total}%. Lo recomendable es que sumen 100%.</div>}
    </div>
  );
}

export function Budget() {
  const dbv = db.value;
  const [mk, setMk] = useState(monthKey(today()));
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(null);
  const budget = dbv.budget || DEFAULT_BUDGET;
  const b = computeBudget({ ...dbv, budget }, movements.value, mk);

  if (editing) {
    return (
      <div class="page">
        <div class="topbar"><h1>Editar presupuesto</h1></div>
        <Editor budget={budget} onDone={() => setEditing(false)} />
      </div>
    );
  }

  const scheduledIncome = b.income - b.incomeReceived;
  return (
    <div class="page">
      <div class="topbar">
        <h1>Presupuesto</h1>
        <div class="actions"><button class="iconbtn" aria-label="Editar presupuesto" onClick={() => setEditing(true)}><IEdit /></button></div>
      </div>
      <MonthPicker value={mk} onChange={setMk} />

      <div class="desk-2" style={{ marginTop: '6px' }}>
        <div>
          <div class="hero">
            <div class="label">Ingresos de {monthName(mk)}</div>
            <div class="big num-prop">{money0(b.income)}</div>
            <div class="small dim">{money0(b.incomeReceived)} recibidos{scheduledIncome > 0 ? ` · ${money0(scheduledIncome)} por llegar` : ''}</div>
          </div>

          {b.income === 0 ? (
            <div class="card">
              <b>Registra tus ingresos del mes</b>
              <p class="dim small">El presupuesto se calcula con lo que ganas. Agrega tu sueldo como movimiento periódico (semanal, quincenal o mensual) y aquí verás cuánto destinar a cada cosa.</p>
              <button class="btn grad" onClick={() => openSheet('tx', { defaults: { type: 'ingreso', periodic: true } })}><IPlus /> Agregar ingreso periódico</button>
            </div>
          ) : (
            <div class="card">
              <div class="row between small"><b>Cómo repartir tu dinero</b><span class={b.pctTotal === 100 ? 'dim' : 'warn'}>{b.pctTotal}% asignado</span></div>
              <div class="alloc">{b.groups.map((g, i) => <i style={{ width: `${g.pct}%`, background: SERIES[i % SERIES.length] }} title={g.name} />)}</div>
              <div class="stack" style={{ gap: '8px', marginTop: '12px' }}>
                {b.groups.map((g, i) => (
                  <div class="row between small">
                    <span class="row" style={{ gap: '8px' }}><span class="dot" style={{ background: SERIES[i % SERIES.length] }} />{g.name} <span class="muted">{g.pct}%</span></span>
                    <b class="num">{money(g.target)}</b>
                  </div>
                ))}
              </div>
              {b.unassigned > 0 && <div class="note-box warn">Tienes {money0(b.unassigned)} en gastos con categorías sin grupo. Asígnalas tocando el lápiz.</div>}
            </div>
          )}
        </div>

        <div class="section" style={{ marginTop: '22px' }}>
          {b.groups.map((g, i) => {
            const color = SERIES[i % SERIES.length];
            const over = g.remaining < 0;
            const wSpent = g.target ? Math.min(100, (g.spent / g.target) * 100) : g.spent ? 100 : 0;
            const wAll = g.target ? Math.min(100, (g.committed / g.target) * 100) : g.committed ? 100 : 0;
            const isSaving = (g.accountIds || []).length > 0 && !(g.categoryIds || []).length;
            return (
              <div class="card group" style={{ marginBottom: '12px' }}>
                <div class="glow" style={{ background: color }} />
                <button class="row between" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(open === g.id ? null : g.id)}>
                  <div>
                    <div class="row" style={{ gap: '8px' }}><b style={{ fontSize: '16px' }}>{g.name}</b><span class={`prio ${g.priority}`}>{PRIO_LABEL[g.priority]}</span></div>
                    <div class="small dim" style={{ marginTop: '3px' }}>{g.pct}% · meta {money0(g.target)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div class={`mid num-prop ${over && !isSaving ? 'neg' : ''}`} style={{ fontSize: '20px', whiteSpace: 'nowrap' }}>{over ? (isSaving ? '✓' : '−') : ''}{money0(Math.abs(g.remaining))}</div>
                    <div class="tiny muted">{over ? (isSaving ? 'por encima de la meta' : 'excedido') : isSaving ? 'faltan por apartar' : 'disponible'}</div>
                  </div>
                </button>
                <div class="progress" style={{ marginTop: '14px' }}>
                  <i class="sched" style={{ width: `${wAll}%`, background: over && !isSaving ? 'var(--neg)' : color }} />
                  <i style={{ width: `${wSpent}%`, background: over && !isSaving ? 'var(--neg)' : color }} />
                </div>
                <div class="row between tiny muted" style={{ marginTop: '8px' }}>
                  <span>{isSaving ? 'Apartado' : 'Gastado'} {money0(g.spent)}{g.scheduled ? ` · programado ${money0(g.scheduled)}` : ''}</span>
                  {g.daily != null && g.remaining > 0 && !isSaving && <span>≈ {money0(g.daily)} por día</span>}
                </div>
                {open === g.id && (
                  <div style={{ marginTop: '14px' }}>
                    {g.perCat.length === 0 && <div class="small muted">Sin movimientos en este grupo este mes.</div>}
                    {g.perCat.map((pc) => {
                      const cat = dbv.categoriesById[pc.key];
                      const acc = pc.key?.startsWith?.('acc:') ? dbv.accountsById[pc.key.slice(4)] : null;
                      return (
                        <div class="row between small" style={{ padding: '6px 0', borderTop: '1px solid var(--hair)' }}>
                          <span>{acc ? `→ ${acc.name}` : cat ? `${cat.icon} ${cat.name}` : 'Sin categoría'}</span>
                          <span class="num">{money(pc.amount)}{g.target ? <span class="muted"> · {Math.round((pc.amount / g.target) * 100)}%</span> : null}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {b.groups.length === 0 && <div class="card empty small">Sin grupos. Toca el lápiz para crear tu presupuesto.</div>}
        </div>
      </div>
    </div>
  );
}
