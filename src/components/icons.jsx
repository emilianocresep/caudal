// Íconos de línea propios (trazo 1.6, esquinas suaves).
const S = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const IHome = (p) => <S {...p}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></S>;
export const IList = (p) => <S {...p}><path d="M8 6.5h12M8 12h12M8 17.5h12" /><circle cx="4.2" cy="6.5" r=".9" /><circle cx="4.2" cy="12" r=".9" /><circle cx="4.2" cy="17.5" r=".9" /></S>;
export const IChart = (p) => <S {...p}><path d="M4 19.5h16" /><path d="M7 16v-4M11.5 16V7M16 16v-6.5" /><path d="M19.5 16V4.5" opacity=".45" /></S>;
export const ITarget = (p) => <S {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r=".8" fill="currentColor" /></S>;
export const IWallet = (p) => <S {...p}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="4" y="7.5" width="16" height="11.5" rx="2.5" /><path d="M16 13.2h.01" stroke-width="2.4" /></S>;
export const IGear = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.4-2-3.4-2.2.9a7.5 7.5 0 0 0-2.6-1.5L14.2 3h-4l-.3 2.1a7.5 7.5 0 0 0-2.6 1.5l-2.2-.9-2 3.4 1.9 1.4a7.6 7.6 0 0 0 0 3L3.1 15l2 3.4 2.2-.9a7.5 7.5 0 0 0 2.6 1.5l.3 2h4l.3-2a7.5 7.5 0 0 0 2.6-1.5l2.2.9 2-3.4z" /></S>;
export const IPlus = (p) => <S stroke-width="2" {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IChevL = (p) => <S {...p}><path d="m14.5 6-6 6 6 6" /></S>;
export const IChevR = (p) => <S {...p}><path d="m9.5 6 6 6-6 6" /></S>;
export const IClose = (p) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const ISwap = (p) => <S {...p}><path d="M7 7.5h12l-3.5-3.5M17 16.5H5l3.5 3.5" /></S>;
export const IRepeat = (p) => <S {...p}><path d="M17 3.5 20 6.5l-3 3" /><path d="M4 11.5v-1a4 4 0 0 1 4-4h12" /><path d="m7 20.5-3-3 3-3" /><path d="M20 12.5v1a4 4 0 0 1-4 4H4" /></S>;
export const ISearch = (p) => <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></S>;
export const IFilter = (p) => <S {...p}><path d="M4 6h16M7 12h10M10 18h4" /></S>;
export const IEdit = (p) => <S {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></S>;
export const ITrash = (p) => <S {...p}><path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4.5h6V7" /></S>;
export const ICloud = (p) => <S {...p}><path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 10a4.3 4.3 0 0 1-.5 8.5z" /></S>;
export const IDown = (p) => <S {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></S>;
export const IUp = (p) => <S {...p}><path d="M12 20V9M7 13.5l5-5 5 5M5 4h14" /></S>;
export const ICard = (p) => <S {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h3" /></S>;
export const ITable = (p) => <S {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16M10 10v9" /></S>;
export const ISparkle = (p) => <S {...p}><path d="M12 3.5c.6 4.4 2.1 6 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.5 5.9-2.1 6.5-6.5z" /><path d="M18.5 15.5c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5z" /></S>;
export const ICheck = (p) => <S stroke-width="2" {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></S>;
export const ICalendar = (p) => <S {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></S>;
