import { useState, useMemo, useRef, useEffect } from 'preact/hooks';
import { db, put, remove, devicePref, setDevicePref } from '../lib/store.js';
import { toCents, fromCents, money } from '../lib/money.js';
import { today, addDays, prettyDate } from '../lib/dates.js';
import { ruleOccurrences, ruleCount, ruleLastDate, FREQS } from '../lib/finance.js';
import { closeSheet, openSheet, showToast } from '../lib/ui.js';
import { Sheet, Seg, Switch, catColor } from './ui.jsx';
import { IPlus, ITrash } from './icons.jsx';

const TYPES = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferencia']];
const DURATIONS = [['indefinido', 'Sin fin'], ['meses', 'Por meses'], ['pagos', 'N.º de pagos']];
const MONTHS = [3, 6, 12, 24];

/**
 * props.mv: movimiento existente (de tx o de regla) para editar.
 * props.defaults: {type, accountId, periodic}
 */
export function TxForm({ mv, defaults = {} }) {
  const { accounts, categories, rulesById, txs } = db.value;
  const activeAccounts = accounts.filter((a) => !a.archived);
  const editingRule = mv?.src === 'rule' ? rulesById[mv.ruleId] : null;
  const editingTx = mv?.src === 'tx' ? txs.find((t) => t.id === mv.id) : null;
  const base = editingRule || editingTx || {};

  const [type, setType] = useState(base.type || defaults.type || 'gasto');
  const [amount, setAmount] = useState(
    base.id ? fromCents(editingRule?.totalMode ? editingRule.total : base.amount) : ''
  );
  const lastAcc = devicePref(`lastAccount:${type}`, null);
  const [accountId, setAccountId] = useState(
    base.accountId || defaults.accountId || (activeAccounts.find((a) => a.id === lastAcc) ? lastAcc : activeAccounts[0]?.id)
  );
  const [toAccountId, setToAccountId] = useState(base.toAccountId || activeAccounts.find((a) => a.id !== accountId)?.id);
  const [categoryId, setCategoryId] = useState(base.categoryId || null);
  const [date, setDate] = useState(editingRule ? editingRule.start : base.date || today());
  const [note, setNote] = useState(base.note || '');
  const [periodic, setPeriodic] = useState(!!editingRule || !!defaults.periodic);
  const [freq, setFreq] = useState(editingRule?.freq || 'mensual');
  const [durationType, setDurationType] = useState(editingRule?.durationType || 'indefinido');
  const [months, setMonths] = useState(editingRule?.months || 12);
  const [count, setCount] = useState(editingRule?.count || 4);
  const [totalMode, setTotalMode] = useState(editingRule?.totalMode || false);
  const [error, setError] = useState('');
  const amountRef = useRef();

  useEffect(() => { if (!mv) setTimeout(() => amountRef.current?.focus(), 250); }, []);

  const cats = categories.filter((c) => c.kind === (type === 'ingreso' ? 'ingreso' : 'gasto'));
  const cents = toCents(amount);

  // Vista previa de la regla periódica
  const draftRule = periodic && type !== undefined ? {
    id: 'draft', type, freq, start: date, durationType, months: Number(months), count: Number(count),
    totalMode: durationType !== 'indefinido' && totalMode, total: cents, amount: cents, skips: editingRule?.skips, end: editingRule?.end,
  } : null;
  const preview = useMemo(() => {
    if (!draftRule || !cents || !date) return null;
    const n = ruleCount(draftRule);
    const occ = ruleOccurrences(draftRule, '0000-01-01', addDays(today(), 3650));
    const t = today();
    const past = occ.filter((o) => o.date <= t);
    const next = occ.find((o) => o.date > t);
    return { n, per: occ[0]?.amount || 0, past: past.length, paid: past.reduce((s, o) => s + o.amount, 0), next, last: n ? ruleLastDate(draftRule) : null, total: n ? occ.reduce((s, o) => s + o.amount, 0) : null };
  }, [periodic, cents, date, freq, durationType, months, count, totalMode, type]);

  const accName = (id) => accounts.find((a) => a.id === id)?.name;
  const initialOf = accounts.find((a) => a.id === accountId)?.initialDate;

  function save() {
    setError('');
    if (!cents || cents <= 0) return setError('Escribe un monto mayor a cero.');
    if (!accountId) return setError('Elige una cuenta.');
    if (type === 'transferencia' && (!toAccountId || toAccountId === accountId)) return setError('Elige una cuenta destino diferente.');
    if (!date) return setError('Elige una fecha.');
    if (periodic && durationType === 'pagos' && !(Number(count) > 0)) return setError('Indica cuántos pagos.');

    const common = {
      type, accountId, note: note.trim(),
      toAccountId: type === 'transferencia' ? toAccountId : null,
      categoryId: type === 'transferencia' ? null : categoryId,
    };
    if (periodic) {
      const rule = {
        ...(editingRule || {}), ...common, freq, start: date, durationType,
        months: durationType === 'meses' ? Number(months) : null,
        count: durationType === 'pagos' ? Number(count) : null,
        totalMode: durationType !== 'indefinido' && totalMode,
        total: durationType !== 'indefinido' && totalMode ? cents : null,
        amount: durationType !== 'indefinido' && totalMode ? null : cents,
      };
      put('rule', rule);
      if (editingTx) remove(editingTx.id);
    } else {
      put('tx', { ...(editingTx || {}), ...common, amount: cents, date });
      if (editingRule) remove(editingRule.id);
    }
    setDevicePref(`lastAccount:${type}`, accountId);
    closeSheet();
    showToast(mv ? 'Cambios guardados' : periodic ? 'Movimiento periódico creado' : 'Movimiento guardado');
  }

  function del() {
    if (editingTx) {
      const snapshot = { ...editingTx };
      remove(editingTx.id);
      closeSheet();
      showToast('Movimiento eliminado', { label: 'Deshacer', run: () => put('tx', snapshot) });
    } else if (editingRule) {
      if (!confirm('¿Eliminar este movimiento periódico y TODOS sus pagos (pasados y futuros)?')) return;
      const snapshot = { ...editingRule };
      remove(editingRule.id);
      closeSheet();
      showToast('Periódico eliminado', { label: 'Deshacer', run: () => put('rule', snapshot) });
    }
  }
  function skipOne() {
    put('rule', { ...editingRule, skips: [...new Set([...(editingRule.skips || []), mv.date])] });
    closeSheet();
    showToast(`Se omitió el pago del ${prettyDate(mv.date)}`);
  }
  function endHere() {
    put('rule', { ...editingRule, end: mv.date });
    closeSheet();
    showToast(`Terminará el ${prettyDate(mv.date, true)}`);
  }

  if (!activeAccounts.length) {
    return (
      <Sheet title="Nuevo movimiento">
        <div class="empty">
          <div class="glyph" />
          <h3>Primero crea una cuenta</h3>
          <p>Por ejemplo tu débito, tu tarjeta de crédito o tu cartera.</p>
          <button class="btn grad" onClick={() => { closeSheet(); openSheet('account'); }}>Crear cuenta</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={mv ? (editingRule ? 'Editar periódico' : 'Editar movimiento') : 'Nuevo movimiento'}
      footer={
        <>
          {mv && <button class="btn danger" aria-label="Eliminar" onClick={del}><ITrash /></button>}
          <button class="btn grad block" onClick={save}>{mv ? 'Guardar cambios' : 'Guardar'}</button>
        </>
      }
    >
      <div style={{ marginTop: '10px' }}>
        <Seg value={type} options={TYPES} onChange={(t) => { setType(t); setCategoryId(null); }} />
      </div>

      <label class="amount-input">
        <span class="cur">$</span>
        <input
          ref={amountRef} inputMode="decimal" placeholder="0" value={amount} aria-label="Monto"
          onInput={(e) => setAmount(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>
      {periodic && durationType !== 'indefinido' && totalMode && preview?.n > 0 && (
        <div class="center small dim">{preview.n} pagos de {money(preview.per)}</div>
      )}

      {type !== 'transferencia' && (
        <div class="field">
          <span>Categoría</span>
          <div class="chips">
            {cats.map((c) => (
              <button type="button" class={`chip ${categoryId === c.id ? 'on' : ''}`} style={{ '--c': catColor(c) }} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
                <span class="e">{c.icon}</span>{c.name}
              </button>
            ))}
            <button type="button" class="chip" onClick={() => openSheet('category', { kind: type === 'ingreso' ? 'ingreso' : 'gasto', onCreated: setCategoryId })}>
              <IPlus /> Nueva
            </button>
          </div>
        </div>
      )}

      <div class="field">
        <span>{type === 'transferencia' ? 'Desde' : 'Cuenta'}</span>
        <div class="chips">
          {activeAccounts.map((a) => (
            <button type="button" class={`chip ${accountId === a.id ? 'on' : ''}`} onClick={() => setAccountId(a.id)}>{a.name}</button>
          ))}
        </div>
      </div>
      {type === 'transferencia' && (
        <div class="field">
          <span>Hacia</span>
          <div class="chips">
            {activeAccounts.filter((a) => a.id !== accountId).map((a) => (
              <button type="button" class={`chip ${toAccountId === a.id ? 'on' : ''}`} onClick={() => setToAccountId(a.id)}>{a.name}</button>
            ))}
          </div>
          <span class="hint">Úsalo para pagar tu tarjeta, retirar efectivo o mover a tu ahorro. No cuenta como gasto ni ingreso.</span>
        </div>
      )}

      <div class="field">
        <span>{periodic ? 'Fecha del primer pago' : 'Fecha'}</span>
        <div class="row">
          {!periodic && (
            <div class="chips" style={{ flexWrap: 'nowrap' }}>
              <button type="button" class={`chip ${date === today() ? 'on' : ''}`} onClick={() => setDate(today())}>Hoy</button>
              <button type="button" class={`chip ${date === addDays(today(), -1) ? 'on' : ''}`} onClick={() => setDate(addDays(today(), -1))}>Ayer</button>
            </div>
          )}
          <input class="input" type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} style={{ flex: 1, minWidth: 0 }} />
        </div>
      </div>

      <div class="field">
        <span>Nota</span>
        <input class="input" placeholder="Ej. Tacos con amigos, Netflix, Quincena…" value={note} onInput={(e) => setNote(e.currentTarget.value)} maxLength={120} />
      </div>

      <Switch on={periodic} onChange={setPeriodic} label="Movimiento periódico" hint="Sueldo, suscripciones, compras a meses sin intereses…" />

      {periodic && (
        <div class="card" style={{ marginTop: '10px', borderRadius: '18px' }}>
          <div class="field" style={{ marginTop: 0 }}>
            <span>Frecuencia</span>
            <Seg small value={freq} onChange={setFreq} options={Object.entries(FREQS).map(([k, v]) => [k, v.short[0].toUpperCase() + v.short.slice(1)])} />
          </div>
          <div class="field">
            <span>Duración</span>
            <Seg small value={durationType} onChange={setDurationType} options={DURATIONS} />
          </div>
          {durationType === 'meses' && (
            <div class="field">
              <span>Plazo</span>
              <div class="chips">
                {MONTHS.map((m) => (
                  <button type="button" class={`chip ${Number(months) === m ? 'on' : ''}`} onClick={() => setMonths(m)}>{m} meses</button>
                ))}
                <input class="input" style={{ width: '96px', height: '36px' }} inputMode="numeric" value={MONTHS.includes(Number(months)) ? '' : months} placeholder="Otro" onInput={(e) => setMonths(e.currentTarget.value.replace(/\D/g, '') || 12)} aria-label="Otro plazo en meses" />
              </div>
            </div>
          )}
          {durationType === 'pagos' && (
            <div class="field">
              <span>Número de pagos</span>
              <input class="input" inputMode="numeric" value={count} onInput={(e) => setCount(e.currentTarget.value.replace(/\D/g, ''))} />
            </div>
          )}
          {durationType !== 'indefinido' && type !== 'ingreso' && (
            <Switch on={totalMode} onChange={setTotalMode} label="El monto es el total de la compra" hint="Para MSI: escribe el precio total y se divide entre los pagos." />
          )}

          {preview && (
            <div class="note-box">
              {preview.n ? (
                <>
                  <b>{preview.n} pagos</b> de {money(preview.per)}{preview.total != null && <> · total {money(preview.total)}</>}
                  {preview.last && <> · último el {prettyDate(preview.last, true)}</>}
                </>
              ) : (
                <>{money(preview.per)} {FREQS[freq].label.toLowerCase()}, sin fecha de fin.</>
              )}
              {preview.past > 0 && (
                <div style={{ marginTop: '6px' }}>
                  Ya transcurrieron <b>{preview.past}</b> {preview.past === 1 ? 'pago' : 'pagos'} ({money(preview.paid)}).
                  {initialOf && date < initialOf && <> Los anteriores al {prettyDate(initialOf, true)} se guardan en tu historial pero no alteran el saldo de {accName(accountId)}, porque ya estaban incluidos en su saldo inicial.</>}
                </div>
              )}
              {preview.next && <div style={{ marginTop: '6px' }}>Próximo: {prettyDate(preview.next.date, true)}.</div>}
            </div>
          )}
        </div>
      )}

      {editingRule && (
        <div class="card" style={{ marginTop: '16px', borderRadius: '18px' }}>
          <div class="small dim">Abriste el pago del <b style={{ color: 'var(--text)' }}>{prettyDate(mv.date, true)}</b>{mv.of ? ` (${mv.n} de ${mv.of})` : ''}. Los cambios de arriba aplican a todos los pagos.</div>
          <div class="row" style={{ marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <button class="btn sm" onClick={skipOne}>Omitir solo este pago</button>
            <button class="btn sm" onClick={endHere}>Terminar en este pago</button>
          </div>
        </div>
      )}

      {error && <div class="note-box warn">{error}</div>}
    </Sheet>
  );
}
