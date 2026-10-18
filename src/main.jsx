import { render } from 'preact';
import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import './styles.css';
import { init, ready, syncState, login } from './lib/store.js';
import { route, sheets, openSheet, closeSheet } from './lib/ui.js';
import { Toast } from './components/ui.jsx';
import { TxForm } from './components/TxForm.jsx';
import { AccountForm, CategoryForm } from './components/Forms.jsx';
import { IHome, IList, IChart, ITarget, IPlus, IGear } from './components/icons.jsx';
import { Home } from './pages/Home.jsx';
import { Account } from './pages/Account.jsx';
import { History } from './pages/History.jsx';
import { Budget } from './pages/Budget.jsx';
import { Settings } from './pages/Settings.jsx';

const Analysis = lazy(() => import('./pages/Analysis.jsx'));

const NAV = [
  ['inicio', '#/', 'Inicio', IHome],
  ['historial', '#/historial', 'Historial', IList],
  ['analisis', '#/analisis', 'Análisis', IChart],
  ['presupuesto', '#/presupuesto', 'Presupuesto', ITarget],
];

function Page() {
  const r = route.value;
  switch (r.name) {
    case 'cuenta': return <Account id={r.id} key={r.id} />;
    case 'historial': return <History />;
    case 'analisis': return <Suspense fallback={<div class="page empty small">Cargando gráficas…</div>}><Analysis /></Suspense>;
    case 'presupuesto': return <Budget />;
    case 'ajustes': return <Settings />;
    default: return <Home />;
  }
}

function Sheets() {
  return sheets.value.map((s) => {
    const p = { ...s.props, key: s.key };
    if (s.type === 'tx') return <TxForm {...p} />;
    if (s.type === 'account') return <AccountForm {...p} />;
    if (s.type === 'category') return <CategoryForm {...p} />;
    return null;
  });
}

function App() {
  const r = route.value;
  const active = r.name === 'cuenta' || r.name === 'ajustes' ? 'inicio' : r.name;
  const st = syncState.value.status;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && sheets.value.length) closeSheet();
      // Atajo de escritorio: "n" = nuevo movimiento
      if (e.key === 'n' && !sheets.value.length && !/input|textarea|select/i.test(document.activeElement?.tagName)) {
        e.preventDefault(); openSheet('tx');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="app">
      <div class="ambient" aria-hidden="true"><i /><i /><i /></div>

      <aside class="side">
        <div class="brand"><i />Caudal</div>
        {NAV.map(([k, href, label, Icon]) => <a href={href} class={active === k ? 'on' : ''}><Icon />{label}</a>)}
        <a href="#/ajustes" class={r.name === 'ajustes' ? 'on' : ''}><IGear />Ajustes</a>
        <button class="btn grad" onClick={() => openSheet('tx')}><IPlus /> Nuevo movimiento</button>
        <div class="foot" title={syncState.value.message || ''}><span class={`syncdot ${st}`} />{st === 'ok' ? 'Sincronizado' : st === 'offline' ? 'Sin conexión' : st === 'syncing' ? 'Sincronizando…' : st === 'auth' ? <button class="linkbtn" onClick={login}>Iniciar sesión</button> : st === 'error' ? 'Sin servidor' : ''}</div>
      </aside>

      <main class={`main ${r.name === 'ajustes' ? 'narrow' : ''}`}>
        {ready.value ? <Page /> : null}
      </main>

      <nav class="nav" aria-label="Navegación">
        {NAV.slice(0, 2).map(([k, href, label, Icon]) => <a href={href} class={active === k ? 'on' : ''}><Icon />{label}</a>)}
        <button class="fab" aria-label="Nuevo movimiento" onClick={() => openSheet('tx')}><IPlus /></button>
        {NAV.slice(2).map(([k, href, label, Icon]) => <a href={href} class={active === k ? 'on' : ''}><Icon />{label}</a>)}
      </nav>

      <Sheets />
      <Toast />
    </div>
  );
}

render(<App />, document.getElementById('app'));
init();

// Acceso directo desde el ícono de la app instalada: /?nuevo=1
if (new URLSearchParams(location.search).has('nuevo')) {
  const wait = setInterval(() => { if (ready.value) { clearInterval(wait); openSheet('tx'); } }, 50);
}
