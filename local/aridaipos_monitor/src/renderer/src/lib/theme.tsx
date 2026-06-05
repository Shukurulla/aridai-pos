// ─── Theme tokens — Variant B (status-coded warm), POS 13" 1366×768 ──────────
// Ported from the approved AridaiPOS design (Claude Design handoff).

export const T = {
  bg: '#f4f1ea',
  surface: '#ffffff',
  panel: '#faf7f0',
  panelStrong: '#ece7da',
  border: '#d8d2c2',
  borderSoft: '#e6e1d2',
  borderStrong: '#0a0a0a',
  text: '#0a0a0a',
  textMuted: '#6b6657',
  textDim: '#a39d8c',
  // Brand (logo red)
  brand: '#d72121',
  brandDeep: '#a51616',
  brandSoft: '#fbe5e5',
  cta: '#d72121',
  ctaHover: '#a51616',
  ctaText: '#ffffff',
  ready: '#1f7a3a',
  readyBg: '#dcecdb',
  preparing: '#a86a14',
  preparingBg: '#f3e6c8',
  served: '#22588c',
  servedBg: '#d8e3ef',
  pending: '#6c6759',
  pendingBg: '#e6e2d5',
  paid: '#1f7a3a',
  paidBg: '#d6ecd2',
  cancelled: '#a8302a',
  cancelledBg: '#f1d8d6',
  saboy: '#8a5a14',
  saboyBg: '#f5e6c8',
  hourly: '#6a2f8e',
  hourlyBg: '#e6d5ef',
  font: 'var(--font-manrope), "Manrope", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

export type StatusKey =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'paid'
  | 'cancelled';

export const STATUS: Record<StatusKey, { label: string; color: string; bg: string }> = {
  pending: { label: 'ОЖИДАЕТ', color: T.pending, bg: T.pendingBg },
  preparing: { label: 'ГОТОВИТСЯ', color: T.preparing, bg: T.preparingBg },
  ready: { label: 'ГОТОВ', color: T.ready, bg: T.readyBg },
  served: { label: 'ПОДАНО', color: T.served, bg: T.servedBg },
  paid: { label: 'ОПЛАЧЕНО', color: T.paid, bg: T.paidBg },
  cancelled: { label: 'ОТМЕНЁН', color: T.cancelled, bg: T.cancelledBg },
};

// Valyuta — restoran sozlamasidan (login/start'da setCurrency() bilan o'rnatiladi).
// UZS→сум, KZT→₸, RUB→₽, USD→$. Default ₸ (eski xatti-harakat).
let CURRENCY = '₸';
export function setCurrency(code?: string): void {
  const c = String(code || '').toUpperCase();
  CURRENCY = c === 'UZS' ? 'сум' : c === 'RUB' ? '₽' : c === 'USD' ? '$' : c === 'KZT' ? '₸' : CURRENCY;
}
export const getCurrency = (): string => CURRENCY;

export const fmt = (n: number) => (n || 0).toLocaleString('ru-RU') + ' ' + CURRENCY;
export const fmtN = (n: number) => (n || 0).toLocaleString('ru-RU');

// Payment-type → Russian label (no Click/Kaspi/Uzcard/Humo in UI)
export const payLabel = (t?: string) =>
  t === 'card' ? 'КАРТА' : t === 'click' ? 'ПЕРЕВОД' : t === 'mixed' ? 'СМЕШАННАЯ' : 'НАЛИЧНЫЕ';

// ─── Big touch-friendly icons (inline SVG) ───────────────────────────────────
type IconKind =
  | 'orders' | 'pos' | 'money' | 'advance' | 'reports' | 'settings' | 'receipt'
  | 'plus' | 'minus' | 'chevronUp' | 'chevronDown' | 'chevronLeft' | 'chevronRight'
  | 'check' | 'x' | 'search' | 'logout' | 'merge' | 'bag' | 'user' | 'clock'
  | 'printer' | 'table';

export const NavIcon = ({
  kind,
  color = 'currentColor',
  size = 24,
}: {
  kind: IconKind;
  color?: string;
  size?: number;
}) => {
  const svgs: Record<IconKind, React.ReactNode> = {
    orders: <path d="M3 5h18M3 12h18M3 19h18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />,
    pos: <><rect x="3" y="6" width="18" height="13" rx="1" stroke={color} strokeWidth="2.2" /><path d="M7 3v3M17 3v3M3 11h18" stroke={color} strokeWidth="2.2" strokeLinecap="round" /></>,
    money: <><rect x="3" y="6" width="18" height="13" rx="1" stroke={color} strokeWidth="2.2" /><circle cx="12" cy="12.5" r="2.5" stroke={color} strokeWidth="2.2" /></>,
    advance: <><circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="2.2" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={color} strokeWidth="2.2" strokeLinecap="round" /></>,
    reports: <><path d="M5 21V9l7-5 7 5v12" stroke={color} strokeWidth="2.2" strokeLinejoin="round" /><path d="M9 21v-7h6v7" stroke={color} strokeWidth="2.2" /></>,
    settings: <><circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" /></>,
    receipt: <><path d="M6 3v18l3-2 3 2 3-2 3 2V3l-3 2-3-2-3 2-3-2z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" /><path d="M9 8h6M9 12h6M9 16h4" stroke={color} strokeWidth="2" strokeLinecap="round" /></>,
    plus: <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.6" strokeLinecap="round" />,
    minus: <path d="M5 12h14" stroke={color} strokeWidth="2.6" strokeLinecap="round" />,
    chevronUp: <path d="M6 15l6-6 6 6" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    chevronDown: <path d="M6 9l6 6 6-6" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    chevronLeft: <path d="M15 6l-6 6 6 6" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    chevronRight: <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    check: <path d="M5 12l5 5 9-11" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    x: <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.6" strokeLinecap="round" />,
    search: <><circle cx="11" cy="11" r="6" stroke={color} strokeWidth="2.2" /><path d="M20 20l-4.5-4.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" /></>,
    logout: <><path d="M15 12H4M4 12l5-5M4 12l5 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M14 4h5v16h-5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>,
    merge: <><path d="M6 4v8c0 4 6 4 6 8M18 4v8c0 4-6 4-6 8" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" /></>,
    bag: <><path d="M6 9h12l-1 11H7L6 9z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" fill="none" /><path d="M9 9V6a3 3 0 0 1 6 0v3" stroke={color} strokeWidth="2.2" fill="none" /></>,
    user: <><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2.2" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={color} strokeWidth="2.2" /></>,
    clock: <><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.2" /><path d="M12 7v5l3 2" stroke={color} strokeWidth="2.2" strokeLinecap="round" /></>,
    printer: <><path d="M6 9V3h12v6" stroke={color} strokeWidth="2.2" /><rect x="4" y="9" width="16" height="8" rx="1" stroke={color} strokeWidth="2.2" /><path d="M7 17v4h10v-4" stroke={color} strokeWidth="2.2" /></>,
    table: <><rect x="3" y="4" width="18" height="14" rx="1" stroke={color} strokeWidth="2.2" /><path d="M3 11h18M9 18v3M15 18v3" stroke={color} strokeWidth="2.2" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      {svgs[kind] || null}
    </svg>
  );
};

export type { IconKind };
