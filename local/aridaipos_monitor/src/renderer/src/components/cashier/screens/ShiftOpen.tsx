'use client';

import { useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { T, NavIcon, fmt, fmtN } from '@/lib/theme';
import { CTA, Btn } from '../shell';
import { ScreenCtx } from './types';

export function ShiftOpenScreen({ ctx }: { ctx: ScreenCtx }) {
  const { logout } = useAuth();
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // Qozog'iston tenge real kupyuralari (fantastik summa emas)
  const denominations = [500, 1000, 2000, 5000, 10000, 20000];

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const open = async () => {
    setBusy(true);
    try {
      const shift = await api.openShift(amount, notes || undefined);
      ctx.onShiftChanged(shift);
      // Yangi смена id'sini uzatamiz — loadData getActiveShift'ni
      // (stale bo'lishi mumkin) chaqirmasdan to'g'ri смена orderlarini oladi.
      await ctx.reload(shift?._id);
      ctx.go('orders');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось открыть смену');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
      }}
    >
      <div
        style={{
          width: 780,
          background: T.surface,
          border: `1px solid ${T.border}`,
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: T.preparing,
            fontWeight: 800,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          ● Новая смена · {today} · {ctx.user?.name || 'Кассир'}
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1 }}>Откройте смену</div>
        <div style={{ fontSize: 16, color: T.textMuted, lineHeight: 1.5 }}>
          Введите сумму наличных в кассе на начало смены. Это сумма, с которой вы начинаете рабочий день — она
          будет проверена при закрытии смены.
        </div>

        <label
          style={{
            fontSize: 14,
            color: T.textMuted,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 8,
          }}
        >
          Сумма в кассе
        </label>
        <div
          style={{
            background: T.panel,
            border: `2px solid ${T.borderStrong}`,
            padding: '20px 24px',
            fontSize: 48,
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'right',
          }}
        >
          {fmt(amount)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {denominations.map((d) => (
            <button
              key={d}
              onClick={() => setAmount((a) => a + d)}
              style={{
                height: 56,
                background: T.panel,
                border: `2px solid ${T.border}`,
                fontFamily: T.font,
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              +{fmtN(d)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAmount(0)}
          style={{
            height: 44,
            background: T.cancelledBg,
            color: T.cancelled,
            border: 'none',
            fontFamily: T.font,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 0.4,
            cursor: 'pointer',
          }}
        >
          Сбросить
        </button>

        <label
          style={{
            fontSize: 14,
            color: T.textMuted,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 8,
          }}
        >
          Заметки (по желанию)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Например: сдача от прошлой смены 50 000 ₸"
          style={{
            minHeight: 70,
            padding: 14,
            background: T.panel,
            border: `2px solid ${T.border}`,
            fontFamily: T.font,
            fontSize: 15,
            resize: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Btn onClick={logout} fullWidth height={64}>
            <NavIcon kind="logout" /> Выйти
          </Btn>
          <CTA height={64} fontSize={20} onClick={open} disabled={busy}>
            <NavIcon kind="check" color="#fff" /> {busy ? 'ОТКРЫТИЕ…' : 'ОТКРЫТЬ СМЕНУ'}
          </CTA>
        </div>
      </div>
    </div>
  );
}
