// Paleta categórica para gráficas (validada para fondo oscuro, orden fijo).
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const SERIES_NAMES = ['Azul', 'Naranja', 'Aqua', 'Ámbar', 'Magenta', 'Verde', 'Violeta', 'Coral'];
export const OTHER = '#5d5c66';

// "Auras" de las cuentas: degradados suaves, estilo ambiental.
export const AURAS = {
  aurora: ['#6d5dfc', '#2fc6c8'],
  tide: ['#2f6bff', '#00c2a8'],
  ember: ['#ff7a59', '#c2185b'],
  dusk: ['#8e5cf7', '#f06292'],
  gold: ['#f7b733', '#f0643c'],
  moss: ['#3fb984', '#1f6f8b'],
  night: ['#3a3f8f', '#9b5de5'],
  rose: ['#f78ca0', '#fe9a8b'],
};

export const ACCOUNT_TYPES = {
  debito: { label: 'Débito', aura: 'tide' },
  credito: { label: 'Crédito', aura: 'ember' },
  efectivo: { label: 'Efectivo', aura: 'moss' },
  ahorro: { label: 'Ahorro', aura: 'aurora' },
  inversion: { label: 'Inversión', aura: 'gold' },
  otro: { label: 'Otra', aura: 'night' },
};

export const DEFAULT_CATEGORIES = [
  { id: 'cat-comida', name: 'Comida', icon: '🍽️', color: 1, kind: 'gasto' },
  { id: 'cat-super', name: 'Súper', icon: '🛒', color: 2, kind: 'gasto' },
  { id: 'cat-transporte', name: 'Transporte', icon: '🚌', color: 0, kind: 'gasto' },
  { id: 'cat-hogar', name: 'Hogar', icon: '🏠', color: 3, kind: 'gasto' },
  { id: 'cat-servicios', name: 'Servicios', icon: '💡', color: 3, kind: 'gasto' },
  { id: 'cat-salud', name: 'Salud', icon: '💊', color: 7, kind: 'gasto' },
  { id: 'cat-escuela', name: 'Escuela', icon: '🎓', color: 6, kind: 'gasto' },
  { id: 'cat-videojuegos', name: 'Videojuegos', icon: '🎮', color: 4, kind: 'gasto' },
  { id: 'cat-entretenimiento', name: 'Salidas', icon: '🎬', color: 4, kind: 'gasto' },
  { id: 'cat-suscripciones', name: 'Suscripciones', icon: '📺', color: 6, kind: 'gasto' },
  { id: 'cat-ropa', name: 'Ropa', icon: '👕', color: 0, kind: 'gasto' },
  { id: 'cat-regalos', name: 'Regalos', icon: '🎁', color: 7, kind: 'gasto' },
  { id: 'cat-otros', name: 'Otros', icon: '•', color: 5, kind: 'gasto' },
  { id: 'cat-sueldo', name: 'Sueldo', icon: '💼', color: 2, kind: 'ingreso' },
  { id: 'cat-extra', name: 'Ingreso extra', icon: '✨', color: 0, kind: 'ingreso' },
  { id: 'cat-reembolso', name: 'Reembolso', icon: '↩︎', color: 6, kind: 'ingreso' },
];

export const DEFAULT_BUDGET = {
  id: 'budget',
  groups: [
    { id: 'grp-ahorro', name: 'Ahorro', pct: 60, priority: 'alta', categoryIds: [], accountIds: [] },
    {
      id: 'grp-necesarios', name: 'Necesarios', pct: 20, priority: 'media',
      categoryIds: ['cat-comida', 'cat-super', 'cat-transporte', 'cat-hogar', 'cat-servicios', 'cat-salud', 'cat-escuela'],
      accountIds: [],
    },
    {
      id: 'grp-placer', name: 'Placer', pct: 20, priority: 'baja',
      categoryIds: ['cat-videojuegos', 'cat-entretenimiento', 'cat-suscripciones', 'cat-ropa', 'cat-regalos', 'cat-otros'],
      accountIds: [],
    },
  ],
};

export const SUGGESTED_ACCOUNTS = [
  { name: 'Débito', type: 'debito', aura: 'tide' },
  { name: 'Tarjeta de crédito', type: 'credito', aura: 'ember' },
  { name: 'Cartera', type: 'efectivo', aura: 'moss' },
];
