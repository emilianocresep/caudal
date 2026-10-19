import { db, movements, putMany, syncState, syncNow, login, setAppKey } from '../lib/store.js';
import { useState } from 'preact/hooks';
import { accountBalance, pendingForAccount, totals, computeBudget } from '../lib/finance.js';
import { today, addDays, monthKey, monthName } from '../lib/dates.js';
import { money, money0 } from '../lib/money.js';
import { openSheet, go } from '../lib/ui.js';
import { SUGGESTED_ACCOUNTS, ACCOUNT_TYPES, SERIES } from '../lib/defaults.js';
import { Money, Aura, MovementList, Empty } from '../components/ui.jsx';
import { IGear, IPlus, IDown, IUp } from '../components/icons.jsx';

function KeyBanner({ message }) {
  const [k, setK] = useState('');
  return (
    <div class="banner" style={{ flexWrap: 'wrap' }}>
      <span>{message}. Escríbela para sincronizar:</span>
      <input class="input" type="password" value={k} onInput={(e) => setK(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && setAppKey(k)} style={{ height: '36px', flex: 1, minWidth: '140px' }} aria-label="Clave de la app" />
      <button onClick={() => setAppKey(k)}>Guardar</button>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export function AccountCard({ a, mv, dbv }) {
  const bal = accountBalance(a, mv);
  const credit = a.type === 'credito';
  const pend = credit ? pendingForAccount(a, dbv) : null;
  return (
    <a class="acct" href={`#/cuenta/${a.id}`}>
      <Aura account={a} />
      <div>
        <div class="t">{ACCOUNT_TYPES[a.type]?.label || 'Cuenta'}</div>
        <div class="n">{a.name}</div>
      </div>
      <div>
        <div class="b num-prop">{credit ? money(Math.max(0, -bal)) : money(bal)}</div>
        <div class="meta">
          {credit ? (
            <>
              <span>Deuda actual</span>
              {a.creditLimit ? <span>Disponible {money0(a.creditLimit + bal - (pend?.total || 0))}</span> : null}
              {pend?.total ? <span>MSI {money0(pend.total)}</span> : null}
            </>
          ) : <span>Saldo</span>}
        </div>
      </div>
    </a>
  );
}

export function Home() {
  const dbv = db.value;
  const mv = movements.value;
  const t = today();
  const accounts = dbv.accounts.filter((a) => !a.archived);
  const net = accounts.reduce((s, a) => s + accountBalance(a, mv, t), 0);
  const mk = monthKey(t);
  const monthMv = mv.filter((m) => m.date.startsWith(mk) && m.date <= t);
  const tot = totals(monthMv);
  const upcoming = mv.filter((m) => m.date > t && m.date <= addDays(t, 14)).reverse().slice(0, 6);
  const recent = mv.filter((m) => m.date <= t).slice(0, 8);
  const budget = dbv.budget ? computeBudget(dbv, mv, mk, t) : null;
  const sync = syncState.value;

  const createSuggested = () => putMany(SUGGESTED_ACCOUNTS.map((s, i) => ['account', { ...s, initial: 0, initialDate: t, order: i }]));

  return (
    <div class="page">
      <div class="topbar">
        <div>
          <div class="sub">{greeting()}</div>
          <h1 style={{ textTransform: 'capitalize' }}>{monthName(mk)}</h1>
        </div>
        <div class="actions">
          <a class="iconbtn" href="#/ajustes" aria-label="Ajustes"><IGear /></a>
        </div>
      </div>

      {sync.status === 'auth' && (
        <div class="banner">Tu sesión expiró; tus cambios se guardan en este dispositivo.<button onClick={login}>Entrar</button></div>
      )}
      {sync.status === 'key' && <KeyBanner message={sync.message} />}
      {sync.status === 'error' && (
        <div class="banner">Sin conexión con el servidor: {sync.message}<button onClick={() => syncNow()}>Reintentar</button></div>
      )}

      <div class="desk-2">
        <div>
          <div class="hero">
            <div class="label">Patrimonio total</div>
            <Money cents={net} />
            <div class="small dim">{accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'} · tarjetas restan su deuda</div>
          </div>
          <div class="kpis">
            <div class="kpi">
              <div class="k"><IDown style={{ width: 14, height: 14, color: SERIES[0] }} /> Ingresos del mes</div>
              <div class="v num-prop">{money(tot.income)}</div>
            </div>
            <div class="kpi">
              <div class="k"><IUp style={{ width: 14, height: 14, color: SERIES[1] }} /> Gastos del mes</div>
              <div class="v num-prop">{money(tot.expense)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-head"><h2>Cuentas</h2><button onClick={() => openSheet('account')}>Agregar</button></div>
            {accounts.length ? (
              <div class="accounts">
                {accounts.map((a) => <AccountCard key={a.id} a={a} mv={mv} dbv={dbv} />)}
                <button class="acct add" onClick={() => openSheet('account')}><IPlus /> Nueva cuenta</button>
              </div>
            ) : (
              <div class="card">
                <Empty title="Empecemos por tus cuentas" text="Crea tu débito, tu tarjeta de crédito y tu cartera de efectivo. Luego ajusta su saldo actual.">
                  <div class="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button class="btn grad" onClick={createSuggested}>Crear las 3 sugeridas</button>
                    <button class="btn" onClick={() => openSheet('account')}>Crear una a mano</button>
                  </div>
                </Empty>
              </div>
            )}
          </div>
        </div>

        <div>
          {budget && budget.income > 0 && (
            <div class="section">
              <div class="section-head"><h2>Presupuesto</h2><a href="#/presupuesto">Ver todo</a></div>
              <a class="card" href="#/presupuesto" style={{ display: 'block' }}>
                {budget.groups.map((g, i) => {
                  const pct = Math.min(100, (g.committed / Math.max(1, g.target)) * 100);
                  const saving = (g.accountIds || []).length > 0 && !(g.categoryIds || []).length;
                  const over = g.remaining < 0 && !saving;
                  return (
                    <div style={{ marginTop: i ? '14px' : 0 }}>
                      <div class="row between small"><b>{g.name}</b><span class={`num ${over ? 'neg' : 'dim'}`}>{over ? `Excedido ${money0(-g.remaining)}` : saving ? (g.remaining > 0 ? `Por apartar ${money0(g.remaining)}` : 'Meta cumplida') : `Quedan ${money0(g.remaining)}`}</span></div>
                      <div class="progress" style={{ marginTop: '7px' }}><i style={{ width: `${pct}%`, background: over ? 'var(--neg)' : SERIES[i % SERIES.length] }} /></div>
                    </div>
                  );
                })}
              </a>
            </div>
          )}

          {upcoming.length > 0 && (
            <div class="section">
              <div class="section-head"><h2>Próximos 14 días</h2></div>
              <MovementList items={upcoming} onOpen={(m) => openSheet('tx', { mv: m })} />
            </div>
          )}

          <div class="section">
            <div class="section-head"><h2>Recientes</h2><a href="#/historial">Historial</a></div>
            <MovementList
              items={recent}
              onOpen={(m) => openSheet('tx', { mv: m })}
              empty={accounts.length ? <div class="card empty small">Toca <b>+</b> para registrar tu primer movimiento.</div> : <div />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
