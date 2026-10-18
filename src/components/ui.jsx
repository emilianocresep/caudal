import { useEffect } from 'preact/hooks';
import { money, money0 } from '../lib/money.js';
import { monthName, shiftMonth, relativeDay, today } from '../lib/dates.js';
import { SERIES, AURAS, ACCOUNT_TYPES } from '../lib/defaults.js';
import { closeSheet, toast } from '../lib/ui.js';
import { IChevL, IChevR, IClose, ISwap } from './icons.jsx';
import { db } from '../lib/store.js';

/** Cifra elegante: enteros grandes, centavos tenues. */
export function Money({ cents, class: cls = 'big', sign = false }) {
  const s = money(Math.abs(cents));
  const [int, dec] = s.split('.');
  const neg = cents < 0;
  return (
    <div class={`${cls} num-prop`}>
      {neg ? '−' : sign && cents > 0 ? '+' : ''}{int}<span class="cents">.{dec}</span>
    </div>
  );
}

export const catColor = (cat) => (cat ? SERIES[(cat.color ?? 0) % SERIES.length] : '#9a9aa8');

export function Orb({ cat, transfer, sm }) {
  if (transfer) return <div class={`orb transfer ${sm ? 'sm' : ''}`}><ISwap /></div>;
  return (
    <div class={`orb ${sm ? 'sm' : ''}`} style={{ '--c': catColor(cat) }}>
      <span>{cat?.icon || '·'}</span>
    </div>
  );
}

export function auraOf(account) {
  const key = account?.aura || ACCOUNT_TYPES[account?.type]?.aura || 'night';
  return AURAS[key] || AURAS.night;
}

export function Aura({ account, big }) {
  const [a, b] = auraOf(account);
  return (
    <>
      <div class="aura" style={{ background: `radial-gradient(circle at 30% 30%, ${a}, ${b} 70%)` }} />
      {!big && <div class="aura two" style={{ background: b }} />}
    </>
  );
}

export function MonthPicker({ value, onChange }) {
  return (
    <div class="monthpick">
      <button aria-label="Mes anterior" onClick={() => onChange(shiftMonth(value, -1))}><IChevL /></button>
      <span>{monthName(value)}</span>
      <button aria-label="Mes siguiente" onClick={() => onChange(shiftMonth(value, 1))}><IChevR /></button>
    </div>
  );
}

export function Seg({ value, options, onChange, small }) {
  return (
    <div class={`seg ${small ? 'small' : ''}`} role="tablist">
      {options.map(([v, label]) => (
        <button role="tab" aria-selected={value === v} class={value === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label, hint }) {
  return (
    <button type="button" class="toggle-row" onClick={() => onChange(!on)} aria-pressed={on}>
      <div class="stack" style={{ gap: '2px' }}>
        <b style={{ fontWeight: 600 }}>{label}</b>
        {hint && <span class="hint">{hint}</span>}
      </div>
      <span class={`switch ${on ? 'on' : ''}`} />
    </button>
  );
}

let openCount = 0;
export function Sheet({ title, children, footer, onClose = closeSheet }) {
  useEffect(() => {
    openCount++;
    document.body.style.overflow = 'hidden';
    return () => {
      openCount--;
      if (!openCount) document.body.style.overflow = '';
    };
  }, []);
  return (
    <div class="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <div class="sheet-bg" onClick={onClose} />
      <div class="sheet">
        <div class="grab" />
        <div class="sheet-head">
          <h3>{title}</h3>
          <button class="iconbtn" aria-label="Cerrar" onClick={onClose}><IClose /></button>
        </div>
        {children}
        {footer && <div class="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" key={t.key} role="status">
      <span>{t.text}</span>
      {t.action && <button onClick={() => { t.action.run(); toast.value = null; }}>{t.action.label}</button>}
    </div>
  );
}

export function Empty({ title, text, children }) {
  return (
    <div class="empty">
      <div class="glyph" />
      <h3>{title}</h3>
      {text && <p style={{ margin: '0 0 16px' }}>{text}</p>}
      {children}
    </div>
  );
}

/** Lista de movimientos agrupada por día. */
export function MovementList({ items, onOpen, accountId, showAccount = true, empty }) {
  const { categoriesById, accountsById } = db.value;
  if (!items.length) return empty || <div class="card empty small">Sin movimientos en este periodo.</div>;
  const days = [];
  let cur = null;
  for (const mv of items) {
    if (!cur || cur.date !== mv.date) { cur = { date: mv.date, items: [], net: 0 }; days.push(cur); }
    cur.items.push(mv);
    if (mv.type === 'ingreso') cur.net += mv.amount;
    else if (mv.type === 'gasto') cur.net -= mv.amount;
  }
  return (
    <div>
      {days.map((d) => (
        <div class="day" key={d.date}>
          <div class="day-h"><span>{relativeDay(d.date)}</span><span class="num">{d.net ? money0(d.net) : ''}</span></div>
          <div class="list">
            {d.items.map((mv) => (
              <MovementRow key={mv.id} mv={mv} cat={categoriesById[mv.categoryId]} accountsById={accountsById} onOpen={onOpen} accountId={accountId} showAccount={showAccount} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MovementRow({ mv, cat, accountsById, onOpen, accountId, showAccount }) {
  const isT = mv.type === 'transferencia';
  const from = accountsById[mv.accountId];
  const to = accountsById[mv.toAccountId];
  const title = isT ? `${from?.name || '—'} → ${to?.name || '—'}` : mv.note || cat?.name || (mv.type === 'ingreso' ? 'Ingreso' : 'Gasto');
  let sub = isT ? (mv.note || 'Transferencia') : mv.note ? cat?.name || 'Sin categoría' : showAccount ? from?.name : '';
  if (!isT && showAccount && mv.note && from) sub = `${cat?.name || 'Sin categoría'} · ${from.name}`;
  let sign = mv.type === 'ingreso' ? 1 : -1;
  if (isT) sign = accountId ? (mv.toAccountId === accountId ? 1 : -1) : 0;
  const future = mv.date > today();
  return (
    <button class={`mv ${future ? 'future' : ''}`} onClick={() => onOpen?.(mv)}>
      <Orb cat={cat} transfer={isT} />
      <div class="info">
        <div class="title">{title}</div>
        <div class="subt">
          {future ? <span class="badge">{mv.of ? `${mv.n}/${mv.of} · ` : ''}Programado</span>
            : mv.src === 'rule' && <span class="badge accent">{mv.of ? `${mv.n}/${mv.of}` : 'Periódico'}</span>}
          <span>{sub}</span>
        </div>
      </div>
      <div class={`amt num ${sign > 0 ? 'pos' : ''}`}>
        {sign > 0 ? '+' : sign < 0 ? '−' : ''}{money(mv.amount)}
      </div>
    </button>
  );
}
