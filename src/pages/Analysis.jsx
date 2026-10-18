// Análisis: se carga solo cuando lo abres (Chart.js no pesa en el inicio).
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  Chart, BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement,
  CategoryScale, LinearScale, Tooltip, Filler,
} from 'chart.js';
import { db, movements } from '../lib/store.js';
import { monthlySeries, balanceSeries, byCategory, filterMovements, monthRange, totals } from '../lib/finance.js';
import { today, monthKey, shiftMonth, monthsBetween, monthShort, monthName } from '../lib/dates.js';
import { money, money0, moneyCompact } from '../lib/money.js';
import { SERIES, OTHER } from '../lib/defaults.js';
import { Seg, MonthPicker, catColor } from '../components/ui.jsx';
import { ITable } from '../components/icons.jsx';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Filler);

const INK = { text: '#f3f2ef', text2: '#a9a8b4', muted: '#6f6e7b', grid: 'rgba(255,255,255,0.06)', base: 'rgba(255,255,255,0.16)', surface: '#121217' };
Chart.defaults.font.family = "'Manrope Variable', system-ui, sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = INK.muted;
Chart.defaults.animation.duration = 650;
Chart.defaults.plugins.tooltip = {
  ...Chart.defaults.plugins.tooltip,
  backgroundColor: 'rgba(24,24,31,0.96)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1,
  titleColor: INK.text, bodyColor: INK.text2, padding: 11, cornerRadius: 12, boxPadding: 5, usePointStyle: true,
  titleFont: { weight: '600' },
};

const moneyAxis = { grid: { color: INK.grid, drawTicks: false }, border: { display: false }, ticks: { padding: 8, callback: (v) => moneyCompact(v), maxTicksLimit: 5 } };
const catAxis = { grid: { display: false }, border: { color: INK.base }, ticks: { padding: 6, maxRotation: 0, autoSkipPadding: 12 } };

function useChart(config, deps) {
  const ref = useRef();
  const chart = useRef();
  useEffect(() => {
    if (!ref.current) return;
    if (chart.current) chart.current.destroy();
    chart.current = new Chart(ref.current, config());
    return () => chart.current?.destroy();
  }, deps);
  return ref;
}

function DataTable({ labels, sets }) {
  return (
    <div class="tbl-wrap">
      <table class="tbl num">
        <thead><tr><th></th>{sets.map((s) => <th>{s.label}</th>)}</tr></thead>
        <tbody>{labels.map((l, i) => <tr><td>{l}</td>{sets.map((s) => <td>{s.data[i] == null ? '—' : money(s.data[i])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Card({ title, sub, children, table, class: cls = '' }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div class={`card chart-card ${cls}`}>
      <div class="row between" style={{ alignItems: 'flex-start' }}>
        <div><h3>{title}</h3>{sub && <div class="sub">{sub}</div>}</div>
        {table && <button class="linkbtn row" style={{ gap: '5px' }} onClick={() => setShowTable(!showTable)}><span style={{ width: 15, height: 15, display: 'inline-block' }}><ITable /></span>{showTable ? 'Gráfica' : 'Tabla'}</button>}
      </div>
      {showTable && table ? table : children}
    </div>
  );
}

function IncomeExpense({ months, mv, accountId }) {
  const labels = months.map(monthShort);
  const inc = monthlySeries(mv, months, { type: 'ingreso', accountId });
  const exp = monthlySeries(mv, months, { type: 'gasto', accountId });
  const ref = useChart(() => ({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ingresos', data: inc, backgroundColor: SERIES[0], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 16, borderWidth: 0 },
        { label: 'Gastos', data: exp, backgroundColor: SERIES[1], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 16, borderWidth: 0 },
      ],
    },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      datasets: { bar: { categoryPercentage: 0.62, barPercentage: 0.86 } },
      scales: { x: catAxis, y: { ...moneyAxis, beginAtZero: true } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${money(c.raw)}` } } },
    },
  }), [months.join(), mv, accountId]);
  return (
    <Card title="Ingresos y gastos" sub="Por mes · las transferencias no cuentan" table={<DataTable labels={labels} sets={[{ label: 'Ingresos', data: inc }, { label: 'Gastos', data: exp }]} />}>
      <div class="legend"><span><i style={{ background: SERIES[0] }} />Ingresos</span><span><i style={{ background: SERIES[1] }} />Gastos</span></div>
      <div class="chart-box"><canvas ref={ref} role="img" aria-label="Gráfica de barras de ingresos y gastos por mes" /></div>
    </Card>
  );
}

function Distribution({ mk, mv, accountId }) {
  const { categoriesById } = db.value;
  const { from, to } = monthRange(mk);
  const items = filterMovements(mv, { from, to: to > today() ? today() : to, accountId });
  const rows = byCategory(items, 'gasto');
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, r) => s + r.amount, 0);
  const segs = top.map((r) => {
    const c = categoriesById[r.categoryId];
    return { label: c ? `${c.icon} ${c.name}` : 'Sin categoría', amount: r.amount, color: c ? catColor(c) : OTHER };
  });
  // Cada segmento con un color distinto (el color sigue a la categoría salvo choque)
  const usedC = [];
  for (const s of segs) {
    if (usedC.includes(s.color)) s.color = SERIES.find((c) => !usedC.includes(c) && !segs.some((x) => x !== s && x.color === c)) || OTHER;
    usedC.push(s.color);
  }
  if (rest > 0) segs.push({ label: `Otras (${rows.length - 5})`, amount: rest, color: OTHER });

  const ref = useChart(() => ({
    type: 'doughnut',
    data: { labels: segs.map((s) => s.label), datasets: [{ data: segs.map((s) => s.amount), backgroundColor: segs.map((s) => s.color), borderColor: INK.surface, borderWidth: 2, borderRadius: 4, hoverOffset: 4 }] },
    options: { cutout: '74%', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${money(c.raw)} · ${Math.round((c.raw / total) * 100)}%` } } } },
  }), [mk, mv, accountId]);

  return (
    <Card title="¿A dónde se fue tu dinero?" sub={`Gastos de ${monthName(mk)}`} table={<DataTable labels={segs.map((s) => s.label)} sets={[{ label: 'Monto', data: segs.map((s) => s.amount) }]} />}>
      {total === 0 ? <div class="empty small">Sin gastos en este mes.</div> : (
        <div class="donut-wrap">
          <div class="donut-box">
            <canvas ref={ref} role="img" aria-label="Gráfica de dona de gastos por categoría" />
            <div class="donut-center"><div><b class="num-prop">{money0(total)}</b><small>gastado</small></div></div>
          </div>
          <div class="dlist">
            {segs.map((s) => (
              <div class="r"><i style={{ background: s.color }} /><span>{s.label}</span><span class="num"><b>{money0(s.amount)}</b><span class="p">{Math.round((s.amount / total) * 100)}%</span></span></div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function CategoryTrend({ months, mv, accountId }) {
  const { categories, categoriesById } = db.value;
  const expenseCats = categories.filter((c) => c.kind === 'gasto');
  const ranked = byCategory(filterMovements(mv, { from: `${months[0]}-01`, to: today(), accountId }), 'gasto');
  const [sel, setSel] = useState(() => ranked.slice(0, 3).map((r) => r.categoryId).filter((id) => categoriesById[id]));
  const labels = months.map(monthShort);
  const used = [];
  const sets = sel.map((id) => {
    const c = categoriesById[id];
    let color = catColor(c);
    if (used.includes(color)) color = SERIES.find((s) => !used.includes(s));
    used.push(color);
    return { id, label: c?.name || '—', color, data: monthlySeries(mv, months, { type: 'gasto', categoryId: id, accountId }) };
  });
  const ref = useChart(() => ({
    type: 'line',
    data: { labels, datasets: sets.map((s) => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color, borderWidth: 2, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: INK.surface })) },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: { x: catAxis, y: { ...moneyAxis, beginAtZero: true } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${money(c.raw)}` } } },
    },
  }), [months.join(), mv, accountId, sel.join()]);
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length >= 4 ? [...sel.slice(1), id] : [...sel, id]);

  return (
    <Card title="Gasto por categoría en el tiempo" sub="Elige hasta 4 categorías" table={<DataTable labels={labels} sets={sets} />}>
      <div class="chips scroll" style={{ marginTop: '12px', marginLeft: '-16px', marginRight: '-16px', padding: '0 16px' }}>
        {expenseCats.map((c) => (
          <button class={`chip ${sel.includes(c.id) ? 'on' : ''}`} style={{ '--c': sets.find((s) => s.id === c.id)?.color || catColor(c), height: '32px', fontSize: '12.5px' }} onClick={() => toggle(c.id)}><span class="e">{c.icon}</span>{c.name}</button>
        ))}
      </div>
      {sets.length > 0 && <div class="legend">{sets.map((s) => <span><i style={{ background: s.color }} />{s.label}</span>)}</div>}
      <div class="chart-box"><canvas ref={ref} role="img" aria-label="Gráfica de líneas de gasto por categoría" /></div>
    </Card>
  );
}

function NetWorth({ months, mv, accountId }) {
  const { accounts } = db.value;
  const accs = accountId ? accounts.filter((a) => a.id === accountId) : accounts;
  const labels = months.map(monthShort);
  const data = balanceSeries(accs, mv, months);
  const ref = useChart(() => ({
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Saldo', data, borderColor: SERIES[6], borderWidth: 2, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5,
        pointHoverBorderColor: INK.surface, pointHoverBorderWidth: 2, pointHoverBackgroundColor: SERIES[6], fill: 'origin',
        backgroundColor: (ctx) => {
          const { chart } = ctx; const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'transparent';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(144,133,233,0.28)'); g.addColorStop(1, 'rgba(144,133,233,0)');
          return g;
        },
      }],
    },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: { x: catAxis, y: moneyAxis },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${money(c.raw)}` } } },
    },
  }), [months.join(), mv, accountId]);
  return (
    <Card title={accountId ? 'Saldo de la cuenta' : 'Patrimonio en el tiempo'} sub="Saldo al cierre de cada mes" table={<DataTable labels={labels} sets={[{ label: 'Saldo', data }]} />}>
      <div class="chart-box"><canvas ref={ref} role="img" aria-label="Gráfica de línea del saldo al cierre de cada mes" /></div>
    </Card>
  );
}

function TopCategories({ months, mv, accountId }) {
  const { categoriesById } = db.value;
  const items = filterMovements(mv, { from: `${months[0]}-01`, to: today(), accountId });
  const rows = byCategory(items, 'gasto').slice(0, 8);
  const max = rows[0]?.amount || 1;
  const n = months.length;
  return (
    <Card title="Categorías con más gasto" sub={`Total del periodo · promedio mensual`}>
      <div style={{ marginTop: '14px' }} class="stack">
        {rows.length === 0 && <div class="empty small">Sin gastos en el periodo.</div>}
        {rows.map((r) => {
          const c = categoriesById[r.categoryId];
          return (
            <div style={{ marginBottom: '8px' }}>
              <div class="row between small"><span>{c ? `${c.icon} ${c.name}` : 'Sin categoría'}</span><span class="num"><b>{money0(r.amount)}</b><span class="muted"> · {money0(r.amount / n)}/mes</span></span></div>
              <div class="progress" style={{ marginTop: '6px', height: '6px' }}><i style={{ width: `${(r.amount / max) * 100}%`, background: SERIES[0] }} /></div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Analysis() {
  const dbv = db.value;
  const mv = movements.value;
  const [range, setRange] = useState('12');
  const [accountId, setAccountId] = useState('');
  const [mk, setMk] = useState(monthKey(today()));
  const cur = monthKey(today());
  const months = range === 'anio' ? monthsBetween(`${cur.slice(0, 4)}-01`, cur) : monthsBetween(shiftMonth(cur, -(Number(range) - 1)), cur);
  const acc = accountId || null;

  const inc = monthlySeries(mv, months, { type: 'ingreso', accountId: acc });
  const exp = monthlySeries(mv, months, { type: 'gasto', accountId: acc });
  const sumI = inc.reduce((a, b) => a + b, 0), sumE = exp.reduce((a, b) => a + b, 0);
  const t = totals(filterMovements(mv, { ...monthRange(cur), to: today(), accountId: acc }));
  const rate = sumI > 0 ? Math.round(((sumI - sumE) / sumI) * 100) : null;

  return (
    <div class="page">
      <div class="topbar"><h1>Análisis</h1></div>
      <div class="row" style={{ flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <Seg small value={range} onChange={setRange} options={[['6', '6 meses'], ['12', '12 meses'], ['24', '24 meses'], ['anio', 'Este año']]} />
        <select class="input" value={accountId} onChange={(e) => setAccountId(e.currentTarget.value)} style={{ height: '40px', width: 'auto', minWidth: '170px' }} aria-label="Cuenta">
          <option value="">Todas las cuentas</option>
          {dbv.accounts.map((a) => <option value={a.id}>{a.name}</option>)}
        </select>
        <MonthPicker value={mk} onChange={setMk} />
      </div>

      <div class="kpis four">
        <div class="kpi"><div class="k">Gasto promedio / mes</div><div class="v num-prop">{money0(sumE / months.length)}</div></div>
        <div class="kpi"><div class="k">Ingreso promedio / mes</div><div class="v num-prop">{money0(sumI / months.length)}</div></div>
        <div class="kpi"><div class="k">Tasa de ahorro</div><div class="v num-prop">{rate == null ? '—' : `${rate}%`}</div></div>
        <div class="kpi"><div class="k">Gastado este mes</div><div class="v num-prop">{money0(t.expense)}</div></div>
      </div>

      <div class="desk-grid" style={{ marginTop: '20px' }}>
        <div class="span2"><IncomeExpense months={months} mv={mv} accountId={acc} /></div>
        <Distribution mk={mk} mv={mv} accountId={acc} />
        <TopCategories months={months} mv={mv} accountId={acc} />
        <div class="span2"><CategoryTrend months={months} mv={mv} accountId={acc} /></div>
        <div class="span2"><NetWorth months={months} mv={mv} accountId={acc} /></div>
      </div>
    </div>
  );
}
