// Todo el dinero se guarda en centavos (enteros) para evitar errores de redondeo.

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (cents) => fmt.format((cents || 0) / 100);
export const money0 = (cents) => fmt0.format(Math.round((cents || 0) / 100));
export const moneyCompact = (cents) => `$${compact.format((cents || 0) / 100)}`;

// "1,234.5" | "1234,50" | "$ 99" → centavos
export function toCents(input) {
  if (typeof input === 'number') return Math.round(input * 100);
  let s = String(input || '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // coma como decimal solo si tiene 1-2 dígitos después
    const dec = s.length - lastComma - 1;
    s = dec <= 2 ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const fromCents = (c) => ((c || 0) / 100).toFixed(2).replace(/\.00$/, '');

// Divide un total en N pagos que suman exactamente el total.
export function splitInstallments(totalCents, n) {
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}
