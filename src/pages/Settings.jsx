import { useState } from 'preact/hooks';
import { db, syncState, syncNow, login, pendingCount, exportBackup, importBackup } from '../lib/store.js';
import { openSheet, showToast } from '../lib/ui.js';
import { ACCOUNT_TYPES } from '../lib/defaults.js';
import { Orb, auraOf } from '../components/ui.jsx';
import { IChevL, IChevR, IPlus, ICloud, IDown, IUp } from '../components/icons.jsx';

const STATUS = {
  idle: 'Esperando…', syncing: 'Sincronizando…', ok: 'Sincronizado', offline: 'Sin conexión — guardando en este dispositivo',
  auth: 'Sesión expirada — vuelve a entrar', error: 'No se pudo conectar con el servidor',
};

export function Settings() {
  const dbv = db.value;
  const s = syncState.value;
  const [tab, setTab] = useState('gasto');

  function download() {
    const blob = new Blob([JSON.stringify(exportBackup())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `caudal-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function upload(e) {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    f.text().then((t) => {
      try { const n = importBackup(JSON.parse(t)); showToast(`${n} registros importados`); }
      catch (err) { showToast(err.message || 'No se pudo importar'); }
    });
    e.currentTarget.value = '';
  }

  return (
    <div class="page">
      <div class="topbar"><a class="back" href="#/"><IChevL /> Inicio</a></div>
      <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 4px' }}>Ajustes</h1>

      <div class="desk-grid" style={{ marginTop: '10px' }}>
        <div>
          <div class="section">
            <div class="section-head"><h2>Cuentas</h2><button onClick={() => openSheet('account')}>Agregar</button></div>
            <div class="list">
              {dbv.accounts.map((a) => {
                const [c1, c2] = auraOf(a);
                return (
                  <button class="mv" onClick={() => openSheet('account', { account: a })}>
                    <div class="orb" style={{ background: `radial-gradient(circle at 30% 30%, ${c1}, ${c2})`, boxShadow: 'none' }} />
                    <div class="info"><div class="title">{a.name}</div><div class="subt">{ACCOUNT_TYPES[a.type]?.label}{a.archived ? ' · archivada' : ''}</div></div>
                    <span class="muted" style={{ width: 18, height: 18 }}><IChevR /></span>
                  </button>
                );
              })}
              {!dbv.accounts.length && <div class="empty small">Aún no tienes cuentas.</div>}
            </div>
          </div>

          <div class="section">
            <div class="section-head"><h2>Sincronización</h2></div>
            <div class="card">
              <div class="row"><span class={`syncdot ${s.status}`} /><b>{STATUS[s.status]}</b></div>
              <div class="small dim" style={{ marginTop: '6px' }}>
                {s.at ? `Última vez: ${new Date(s.at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún no se sincroniza.'}
                {pendingCount.value > 0 && ` · ${pendingCount.value} cambios por subir`}
              </div>
              {s.message && (s.status === 'error' || s.status === 'auth') && <div class="hint" style={{ marginTop: '6px' }}>{s.message}</div>}
              <div class="row" style={{ marginTop: '14px', gap: '8px' }}>
                <button class="btn sm" onClick={() => (s.status === 'auth' ? login() : syncNow())}><ICloud /> {s.status === 'auth' ? 'Entrar de nuevo' : 'Sincronizar ahora'}</button>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-head"><h2>Respaldo</h2></div>
            <div class="card">
              <p class="small dim" style={{ marginTop: 0 }}>Tus datos viven en tu base de datos de Cloudflare y en cada dispositivo. Descarga un respaldo de vez en cuando por si acaso.</p>
              <div class="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                <button class="btn sm" onClick={download}><IDown /> Descargar respaldo</button>
                <label class="btn sm"><IUp /> Importar<input type="file" accept="application/json" onChange={upload} style={{ display: 'none' }} /></label>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-head"><h2>Categorías</h2><button onClick={() => openSheet('category', { kind: tab })}>Agregar</button></div>
          <div class="seg small" style={{ marginBottom: '10px' }}>
            <button class={tab === 'gasto' ? 'on' : ''} onClick={() => setTab('gasto')}>Gastos</button>
            <button class={tab === 'ingreso' ? 'on' : ''} onClick={() => setTab('ingreso')}>Ingresos</button>
          </div>
          <div class="list">
            {dbv.categories.filter((c) => c.kind === tab).map((c) => (
              <button class="mv" onClick={() => openSheet('category', { category: c })}>
                <Orb cat={c} />
                <div class="info"><div class="title">{c.name}</div></div>
                <span class="muted" style={{ width: 18, height: 18 }}><IChevR /></span>
              </button>
            ))}
          </div>
          <button class="btn block" style={{ marginTop: '10px' }} onClick={() => openSheet('category', { kind: tab })}><IPlus /> Nueva categoría</button>
        </div>
      </div>

      <p class="center tiny muted" style={{ marginTop: '40px' }}>Caudal · v1.0 · hecho para ti</p>
    </div>
  );
}
