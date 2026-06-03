'use client';

import { useState, useEffect } from 'react';
import { T, NavIcon, STATUS, StatusKey, fmt, IconKind } from '@/lib/theme';
import { DailySummary, Shift, User, Restaurant, Branch } from '@/types';
// Logo'ni MODUL sifatida import qilamiz — "/aridai-logo.png" public'da yo'q
// edi (renderer root src/renderer, public yo'q) → logo ko'rinmasdi.
import logoUrl from '@/assets/aridai-logo.png';

export type Screen =
  | 'login'
  | 'shiftOpen'
  | 'orders'
  | 'orderDetail'
  | 'payment'
  | 'addItems'
  | 'newOrder'
  | 'saboy'
  | 'menu'
  | 'merge'
  | 'reports'
  | 'expenses'
  | 'advances'
  | 'settings'
  | 'shiftClose';

// ─── Large pagination button (▲/▼/◀/▶) — finger tap on POS ───────────────────
export const PageBtn = ({
  dir,
  onClick,
  disabled,
  size = 56,
}: {
  dir: 'up' | 'down' | 'left' | 'right';
  onClick: () => void;
  disabled?: boolean;
  size?: number;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: size,
      height: size,
      background: disabled ? T.panelStrong : T.surface,
      border: `2px solid ${disabled ? T.border : T.borderStrong}`,
      color: disabled ? T.textDim : T.text,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: T.font,
      padding: 0,
    }}
  >
    <NavIcon kind={`chevron${dir.charAt(0).toUpperCase() + dir.slice(1)}` as IconKind} />
  </button>
);

export const Pager = ({
  page,
  total,
  onPrev,
  onNext,
  vertical = true,
}: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  vertical?: boolean;
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      alignItems: 'center',
      gap: 8,
    }}
  >
    <PageBtn dir={vertical ? 'up' : 'left'} onClick={onPrev} disabled={page <= 1} />
    <div
      style={{
        fontSize: 14,
        fontWeight: 800,
        color: T.textMuted,
        textAlign: 'center',
        minWidth: 56,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: 0.4,
      }}
    >
      {page} / {total}
    </div>
    <PageBtn dir={vertical ? 'down' : 'right'} onClick={onNext} disabled={page >= total} />
  </div>
);

const HeaderStat = ({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
    <span
      style={{
        fontSize: 12,
        color: T.textMuted,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: strong ? 20 : 17,
        fontWeight: strong ? 900 : 800,
        color: T.text,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {value}
    </span>
  </div>
);

// ─── Top Header (always visible) ─────────────────────────────────────────────
export const Header = ({
  summary,
  activeShift,
  user,
  restaurant,
  branch,
  isConnected,
  numpadOpen,
  onToggleNumpad,
}: {
  summary: DailySummary;
  activeShift: Shift | null;
  user: User | null;
  restaurant: Restaurant | null;
  branch: Branch | null;
  isConnected: boolean;
  numpadOpen?: boolean;
  onToggleNumpad?: () => void;
}) => {
  const [now, setNow] = useState(() =>
    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  );
  useEffect(() => {
    const i = setInterval(
      () => setNow(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })),
      15000,
    );
    return () => clearInterval(i);
  }, []);

  return (
    <div
      style={{
        height: 72,
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'stretch',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderRight: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            background: '#000',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Aridai" style={{ width: 40, height: 40, display: 'block' }} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.05 }}>AridaiPOS</div>
          <div style={{ fontSize: 14, color: T.textMuted, marginTop: 2 }}>
            {restaurant?.name || 'Ресторан'}
            {branch?.name ? ` · ${branch.name}` : ''}
          </div>
        </div>
      </div>

      {/* Summary — har biri ustun: yorliq tepada, raqam ostida (o'ralmaydi) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 26 }}>
        <HeaderStat label="Выручка" value={fmt(summary.totalRevenue)} strong />
        <span style={{ width: 1, height: 36, background: T.border }} />
        <HeaderStat label="Наличные" value={fmt(summary.cashRevenue)} />
        <HeaderStat label="Карта" value={fmt(summary.cardRevenue)} />
        <HeaderStat label="Перевод" value={fmt(summary.clickRevenue)} />
      </div>

      <div
        style={{
          padding: '0 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderLeft: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            background: activeShift ? T.readyBg : T.cancelledBg,
            color: activeShift ? T.ready : T.cancelled,
            padding: '9px 16px',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 0.3,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              background: isConnected ? (activeShift ? T.ready : T.cancelled) : T.textDim,
              borderRadius: 999,
            }}
          />
          {activeShift ? `Смена №${activeShift.shiftNumber}` : 'Смена закрыта'}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: T.text,
            fontVariantNumeric: 'tabular-nums',
            padding: '0 4px',
          }}
        >
          {now}
        </div>
      </div>

      <div
        style={{
          padding: '0 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderLeft: `1px solid ${T.border}`,
          minWidth: 280,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{user?.name || 'Кассир'}</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Кассир</div>
        </div>
        {onToggleNumpad && (
          <button
            onClick={onToggleNumpad}
            title="Экранная клавиатура"
            style={{
              width: 52,
              height: 48,
              background: numpadOpen ? T.cta : T.surface,
              color: numpadOpen ? '#fff' : T.text,
              border: `2px solid ${numpadOpen ? T.cta : T.borderStrong}`,
              fontSize: 20,
              fontWeight: 800,
              fontFamily: T.font,
              cursor: 'pointer',
            }}
          >
            ⠿
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Side Nav rail (always visible) ──────────────────────────────────────────
export const SideNav = ({ current, go }: { current: Screen; go: (s: Screen) => void }) => {
  const items: { id: Screen; icon: IconKind; label: string }[] = [
    { id: 'orders', icon: 'orders', label: 'Заказы' },
    { id: 'menu', icon: 'pos', label: 'Меню' },
    { id: 'saboy', icon: 'bag', label: 'Собой' },
    { id: 'merge', icon: 'merge', label: 'Объедин.' },
    { id: 'expenses', icon: 'money', label: 'Расходы' },
    { id: 'advances', icon: 'advance', label: 'Авансы' },
    { id: 'reports', icon: 'reports', label: 'Отчёты' },
    { id: 'settings', icon: 'settings', label: 'Настройки' },
  ];
  return (
    <div
      style={{
        width: 116,
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {items.map((it) => {
        const active =
          it.id === current ||
          (current === 'addItems' && it.id === 'orders') ||
          (current === 'payment' && it.id === 'orders') ||
          (current === 'orderDetail' && it.id === 'orders');
        return (
          <button
            key={it.id}
            onClick={() => go(it.id)}
            style={{
              height: 84,
              background: active ? T.cta : 'transparent',
              color: active ? '#fff' : T.text,
              border: 'none',
              borderBottom: `1px solid ${T.borderSoft}`,
              fontFamily: T.font,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <NavIcon kind={it.icon} color={active ? '#fff' : T.text} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{it.label}</span>
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button
        onClick={() => go('shiftClose')}
        style={{
          height: 84,
          background: T.cancelled,
          color: '#fff',
          border: 'none',
          fontFamily: T.font,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <NavIcon kind="logout" color="#fff" />
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>
          Закрыть
          <br />
          смену
        </span>
      </button>
    </div>
  );
};

// ─── Status pill ─────────────────────────────────────────────────────────────
export const StatusPill = ({
  status,
  size = 'md',
}: {
  status: StatusKey;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const s = STATUS[status] || STATUS.pending;
  const padding = size === 'lg' ? '8px 14px' : size === 'sm' ? '4px 10px' : '6px 12px';
  const fs = size === 'lg' ? 15 : size === 'sm' ? 12 : 13;
  return (
    <span
      style={{
        padding,
        background: s.bg,
        color: s.color,
        fontSize: fs,
        fontWeight: 800,
        letterSpacing: 0.5,
        display: 'inline-block',
      }}
    >
      {s.label}
    </span>
  );
};

// ─── Buttons ─────────────────────────────────────────────────────────────────
export const CTA = ({
  children,
  onClick,
  height = 72,
  fontSize = 21,
  fullWidth = true,
  color = T.cta,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  height?: number;
  fontSize?: number;
  fullWidth?: boolean;
  color?: string;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: fullWidth ? '100%' : 'auto',
      height,
      background: disabled ? T.textDim : color,
      color: T.ctaText,
      border: 'none',
      fontFamily: T.font,
      fontSize,
      fontWeight: 900,
      letterSpacing: 0.5,
      cursor: disabled ? 'not-allowed' : 'pointer',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    }}
  >
    {children}
  </button>
);

export const Btn = ({
  children,
  onClick,
  color = T.text,
  bg = T.surface,
  height = 60,
  fontSize = 17,
  fullWidth = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  color?: string;
  bg?: string;
  height?: number;
  fontSize?: number;
  fullWidth?: boolean;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      height,
      width: fullWidth ? '100%' : 'auto',
      background: bg,
      color,
      border: `2px solid ${T.borderStrong}`,
      fontFamily: T.font,
      fontSize,
      fontWeight: 800,
      padding: '0 22px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}
  >
    {children}
  </button>
);

// ─── Shared sub-components ───────────────────────────────────────────────────
export const SubHeader = ({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children?: React.ReactNode;
}) => (
  <div
    style={{
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      padding: '14px 22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Btn onClick={onBack} height={48}>
        <NavIcon kind="chevronLeft" /> Назад
      </Btn>
      <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: 0.3 }}>{title}</span>
    </div>
    {children}
  </div>
);

export const SectionTitle = ({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      fontSize: 14,
      color: T.textMuted,
      fontWeight: 800,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 4,
      ...style,
    }}
  >
    {children}
  </div>
);

export const BigStat = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div
      style={{
        fontSize: 13,
        color: T.textMuted,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 36,
        fontWeight: 900,
        fontVariantNumeric: 'tabular-nums',
        color: accent || T.text,
      }}
    >
      {value}
    </div>
  </div>
);

export const MiniStat = ({
  label,
  value,
  color,
  large = false,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
  large?: boolean;
}) => (
  <div style={{ background: T.panel, padding: large ? '14px 16px' : '12px 14px', borderTop: `4px solid ${color}` }}>
    <div
      style={{
        fontSize: 12,
        color: T.textMuted,
        fontWeight: 800,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: large ? 24 : 20,
        fontWeight: 900,
        fontVariantNumeric: 'tabular-nums',
        color,
        marginTop: 3,
      }}
    >
      {value}
    </div>
  </div>
);

export const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label
      style={{
        fontSize: 12,
        color: T.textMuted,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </label>
    {children}
  </div>
);

export const Row = ({
  label,
  value,
  color = T.text,
  numeric = false,
  strike = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  color?: string;
  numeric?: boolean;
  strike?: boolean;
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '6px 0',
      fontSize: 15,
    }}
  >
    <span style={{ color: T.textMuted }}>{label}</span>
    <span
      style={{
        color,
        fontWeight: 800,
        fontVariantNumeric: numeric ? 'tabular-nums' : 'normal',
        textDecoration: strike ? 'line-through' : 'none',
      }}
    >
      {value}
    </span>
  </div>
);

export const ToggleRow = ({
  label,
  storageKey,
  defaultOn = false,
}: {
  label: string;
  storageKey?: string;
  defaultOn?: boolean;
}) => {
  const [on, setOn] = useState(defaultOn);
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const v = localStorage.getItem(storageKey);
      if (v !== null) setOn(v === '1');
    }
  }, [storageKey]);
  const toggle = () => {
    const next = !on;
    setOn(next);
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, next ? '1' : '0');
    }
  };
  return (
    <button
      onClick={toggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        border: 'none',
        borderBottom: `1px solid ${T.borderSoft}`,
        background: 'transparent',
        fontFamily: T.font,
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 700, color: T.text, textAlign: 'left' }}>{label}</span>
      <div
        style={{
          width: 56,
          height: 32,
          background: on ? T.ready : T.panelStrong,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 27 : 3,
            width: 26,
            height: 26,
            background: '#fff',
          }}
        />
      </div>
    </button>
  );
};
