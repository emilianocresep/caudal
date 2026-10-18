import { useState } from 'preact/hooks';
import { db, movements } from '../lib/store.js';
import { filterMovements, totals, monthRange } from '../lib/finance.js';
import { today, monthKey, addMonths } from '../lib/dates.js';
import { money } from '../lib/money.js';
import { openSheet } from '../lib/ui.js';
import { MovementList, MonthPicker, Seg, catColor } from '../components/ui.jsx';
import { ISearch } from '../components/icons.jsx';

export function History() {
  const dbv = db.value;
  const [period, setPeriod] = useState('mes');
  const [mk, setMk] = useState(monthKey(today()));
  const [from, setFrom] = useState(addMonths(today(), -3));
  const [to, setTo] = useState(today());
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState('');
  const [cats, setCats] = useState(new Set());
  const [q, setQ] = useState('');
  const [future, setFuture] = useState(true);
  const [limit, setLimit] = useState(150);

  const range = period === 'mes' ? monthRange(mk) : period === 'rango' ? { from, to } : { from: null, to: null };
  let toDate = range.to;
  if (!future) toDate = !toDate || toDate > today() ? today() : toDate;
  if (period === 'todo' && future) toDate = addMonths(today(), 1);
  const items = filterMovements(movements.value, { from: range.from, to: toDate, accountId: accountId || null, type: type || null, categoryIds: cats, q });
  const t = totals(items.filter((m) => m.date <= today()));

  const toggleCat = (id) => { const s = new Set(cats); s.has(id) ? s.delete(id) : s.add(id); setCats(s); };
  const visibleCats = dbv.categories.filter((c) => !type || type === 'transferencia' || c.kind === type);

  return (
    <div class="page">
      <div class="topbar"><h1>Historial</h1></div>

      <div class="card" style={{ padding: '14px' }}>
        <div class="row" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <Seg small value={period} onChange={setPeriod} options={[['mes', 'Mes'], ['rango', 'Rango'], ['todo', 'Todo']]} />
          {period === 'mes' && <MonthPicker value={mk} onChange={setMk} />}
          {period === 'rango' && (
            <div class="row" style={{ gap: '6px' }}>
              <input class="input" type="date" value={from} onInput={(e) => setFrom(e.currentTarget.value)} style={{ height: '40px', width: '150px' }} aria-label="Desde" />
              <span class="dim">—</span>
              <input class="input" type="date" value={to} onInput={(e) => setTo(e.currentTarget.value)} style={{ height: '40px', width: '150px' }} aria-label="Hasta" />
            </div>
          )}
        </div>
        <div class="row" style={{ marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
          <select class="input" value={accountId} onChange={(e) => setAccountId(e.currentTarget.value)} style={{ height: '40px', width: 'auto', minWidth: '160px', flex: 1 }} aria-label="Cuenta">
            <option value="">Todas las cuentas</option>
            {dbv.accounts.map((a) => <option value={a.id}>{a.name}{a.archived ? ' (archivada)' : ''}</option>)}
          </select>
          <Seg small value={type} onChange={(v) => { setType(v); setCats(new Set()); }} options={[['', 'Todo'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['transferencia', 'Transf.']]} />
        </div>
        {type !== 'transferencia' && (
          <div class="chips scroll" style={{ marginTop: '12px', marginLeft: '-14px', marginRight: '-14px', padding: '0 14px' }}>
            {visibleCats.map((c) => (
              <button class={`chip ${cats.has(c.id) ? 'on' : ''}`} style={{ '--c': catColor(c) }} onClick={() => toggleCat(c.id)}><span class="e">{c.icon}</span>{c.name}</button>
            ))}
            <button class={`chip ${cats.has('_none') ? 'on' : ''}`} onClick={() => toggleCat('_none')}>Sin categoría</button>
          </div>
        )}
        <div class="row" style={{ marginTop: '12px', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '13px', top: '12px', width: '18px', height: '18px', color: 'var(--muted)' }}><ISearch /></span>
            <input class="input" placeholder="Buscar en notas" value={q} onInput={(e) => setQ(e.currentTarget.value)} style={{ paddingLeft: '40px', height: '42px' }} />
          </div>
          <button class={`chip ${future ? 'on' : ''}`} onClick={() => setFuture(!future)}>Programados</button>
        </div>
      </div>

      <div class="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div class="kpi"><div class="k">Ingresos</div><div class="v num-prop" style={{ fontSize: '16px' }}>{money(t.income)}</div></div>
        <div class="kpi"><div class="k">Gastos</div><div class="v num-prop" style={{ fontSize: '16px' }}>{money(t.expense)}</div></div>
        <div class="kpi"><div class="k">Balance</div><div class={`v num-prop ${t.net < 0 ? 'neg' : ''}`} style={{ fontSize: '16px' }}>{money(t.net)}</div></div>
      </div>
      <div class="small muted" style={{ margin: '10px 6px 0' }}>{items.length} movimientos{items.some((m) => m.date > today()) ? ' · los programados no suman en los totales' : ''}</div>

      <MovementList items={items.slice(0, limit)} accountId={accountId || null} onOpen={(m) => openSheet('tx', { mv: m })} />
      {items.length > limit && (
        <div class="center" style={{ marginTop: '16px' }}><button class="btn" onClick={() => setLimit(limit + 200)}>Mostrar más</button></div>
      )}
    </div>
  );
}
