import { useState } from 'preact/hooks';
import { db, put, remove, movements } from '../lib/store.js';
import { toCents, fromCents } from '../lib/money.js';
import { today } from '../lib/dates.js';
import { AURAS, ACCOUNT_TYPES, SERIES, SERIES_NAMES } from '../lib/defaults.js';
import { closeSheet, showToast, go } from '../lib/ui.js';
import { Sheet, Seg, Switch } from './ui.jsx';
import { ITrash } from './icons.jsx';

export function AccountForm({ account, preset }) {
  const a = account || preset || {};
  const isNew = !account;
  const [name, setName] = useState(a.name || '');
  const [type, setType] = useState(a.type || 'debito');
  const [aura, setAura] = useState(a.aura || ACCOUNT_TYPES[a.type || 'debito'].aura);
  const credit = type === 'credito';
  const [initial, setInitial] = useState(a.initial != null ? fromCents(credit ? -a.initial : a.initial) : '');
  const [initialDate, setInitialDate] = useState(a.initialDate || today());
  const [limit, setLimit] = useState(a.creditLimit ? fromCents(a.creditLimit) : '');
  const [archived, setArchived] = useState(!!a.archived);
  const [err, setErr] = useState('');

  function save() {
    if (!name.trim()) return setErr('Ponle un nombre a la cuenta.');
    const v = toCents(initial);
    const id = put('account', {
      ...(account || {}), name: name.trim(), type, aura,
      initial: credit ? -Math.abs(v) : v, initialDate,
      creditLimit: credit ? toCents(limit) : null, archived,
      order: account?.order ?? db.value.accounts.length,
    });
    closeSheet();
    showToast(isNew ? 'Cuenta creada' : 'Cuenta actualizada');
    return id;
  }
  function del() {
    const used = movements.value.some((m) => m.accountId === account.id || m.toAccountId === account.id);
    if (used) {
      if (!confirm('Esta cuenta tiene movimientos. Se archivará (se oculta pero conservas tu historial). ¿Continuar?')) return;
      put('account', { ...account, archived: true });
    } else {
      if (!confirm('¿Eliminar esta cuenta?')) return;
      remove(account.id);
    }
    closeSheet();
    go('/');
  }

  return (
    <Sheet
      title={isNew ? 'Nueva cuenta' : 'Editar cuenta'}
      footer={<>{!isNew && <button class="btn danger" aria-label="Eliminar" onClick={del}><ITrash /></button>}<button class="btn grad block" onClick={save}>Guardar</button></>}
    >
      <div class="field"><span>Nombre</span>
        <input class="input" value={name} placeholder="Ej. BBVA débito, Nu, Cartera" onInput={(e) => setName(e.currentTarget.value)} maxLength={40} />
      </div>
      <div class="field"><span>Tipo</span>
        <div class="chips">
          {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
            <button type="button" class={`chip ${type === k ? 'on' : ''}`} onClick={() => { setType(k); if (isNew) setAura(v.aura); }}>{v.label}</button>
          ))}
        </div>
      </div>
      <div class="field"><span>Aura</span>
        <div class="palette">
          {Object.entries(AURAS).map(([k, [c1, c2]]) => (
            <button type="button" aria-label={k} class={`aura-pick ${aura === k ? 'on' : ''}`} style={{ background: `radial-gradient(circle at 30% 30%, ${c1}, ${c2})` }} onClick={() => setAura(k)} />
          ))}
        </div>
      </div>
      <div class="grid two" style={{ gap: '10px' }}>
        <div class="field"><span>{credit ? 'Deuda actual' : 'Saldo actual'}</span>
          <input class="input" inputMode="decimal" placeholder="0.00" value={initial} onInput={(e) => setInitial(e.currentTarget.value)} />
        </div>
        <div class="field"><span>Al día</span>
          <input class="input" type="date" value={initialDate} onInput={(e) => setInitialDate(e.currentTarget.value)} />
        </div>
      </div>
      <p class="hint" style={{ marginTop: '8px' }}>
        {credit
          ? 'Lo que debes hoy en la tarjeta (sin contar MSI futuros). Los pagos a la tarjeta regístralos como transferencia desde tu débito.'
          : 'El dinero que tienes a esa fecha. Lo registrado antes de esta fecha queda en el historial sin volver a restarse.'}
      </p>
      {credit && (
        <div class="field"><span>Límite de crédito</span>
          <input class="input" inputMode="decimal" placeholder="Opcional" value={limit} onInput={(e) => setLimit(e.currentTarget.value)} />
        </div>
      )}
      {!isNew && <Switch on={archived} onChange={setArchived} label="Archivada" hint="Se oculta de las listas pero su historial se conserva." />}
      {err && <div class="note-box warn">{err}</div>}
    </Sheet>
  );
}

const EMOJIS = ['🍽️', '🛒', '☕', '🍔', '🚌', '⛽', '🚗', '🏠', '💡', '📱', '💊', '🏋️', '🎓', '📚', '🎮', '🎬', '🎵', '📺', '👕', '✂️', '🎁', '✈️', '🐾', '💼', '✨', '↩︎', '💰', '🏦', '📈', '🧾', '🍺', '💻'];

export function CategoryForm({ category, kind: kind0, onCreated }) {
  const c = category || {};
  const isNew = !category;
  const [name, setName] = useState(c.name || '');
  const [icon, setIcon] = useState(c.icon || '✨');
  const [color, setColor] = useState(c.color ?? (db.value.categories.length % SERIES.length));
  const [kind, setKind] = useState(c.kind || kind0 || 'gasto');
  const [err, setErr] = useState('');

  function save() {
    if (!name.trim()) return setErr('Escribe un nombre.');
    const id = put('category', { ...(category || {}), name: name.trim(), icon: icon || '•', color, kind, order: category?.order ?? db.value.categories.length });
    if (isNew && kind === 'gasto') {
      // Añadirla al grupo "Placer" o al último grupo del presupuesto para que no quede suelta
      const b = db.value.budget;
      if (b?.groups?.length && !b.groups.some((g) => (g.categoryIds || []).includes(id))) {
        const groups = b.groups.map((g, i) => (i === b.groups.length - 1 ? { ...g, categoryIds: [...(g.categoryIds || []), id] } : g));
        put('budget', { ...b, groups });
      }
    }
    onCreated?.(id);
    closeSheet();
  }
  function del() {
    const used = movements.value.some((m) => m.categoryId === category.id);
    if (!confirm(used ? 'Hay movimientos con esta categoría; quedarán como "Sin categoría". ¿Eliminar?' : '¿Eliminar esta categoría?')) return;
    remove(category.id);
    closeSheet();
  }

  return (
    <Sheet
      title={isNew ? 'Nueva categoría' : 'Editar categoría'}
      footer={<>{!isNew && <button class="btn danger" aria-label="Eliminar" onClick={del}><ITrash /></button>}<button class="btn grad block" onClick={save}>Guardar</button></>}
    >
      <div class="field"><span>Tipo</span>
        <Seg value={kind} onChange={setKind} options={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} />
      </div>
      <div class="field"><span>Nombre</span>
        <input class="input" value={name} placeholder="Ej. Café, Gimnasio, Gastos escolares" onInput={(e) => setName(e.currentTarget.value)} maxLength={32} />
      </div>
      <div class="field"><span>Ícono</span>
        <div class="chips">
          {EMOJIS.map((e) => (
            <button type="button" class={`chip ${icon === e ? 'on' : ''}`} style={{ width: '42px', padding: 0, justifyContent: 'center' }} onClick={() => setIcon(e)}><span class="e">{e}</span></button>
          ))}
          <input class="input" style={{ width: '90px', height: '36px' }} value={EMOJIS.includes(icon) ? '' : icon} placeholder="Otro" maxLength={4} onInput={(e) => setIcon(e.currentTarget.value)} aria-label="Otro emoji" />
        </div>
      </div>
      <div class="field"><span>Color</span>
        <div class="palette">
          {SERIES.map((hex, i) => (
            <button type="button" aria-label={SERIES_NAMES[i]} class={`swatch ${color === i ? 'on' : ''}`} style={{ background: hex }} onClick={() => setColor(i)} />
          ))}
        </div>
      </div>
      {err && <div class="note-box warn">{err}</div>}
    </Sheet>
  );
}
