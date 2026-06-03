'use client';

import { useState } from 'react';
import { api } from '@/services/api';
import { T, NavIcon, fmt, fmtN } from '@/lib/theme';
import { CTA, Btn, Row } from '../shell';
import { ScreenCtx } from './types';

export function ShiftCloseScreen({ ctx }: { ctx: ScreenCtx }) {
  const { summary, activeShift } = ctx;
  const openingCash = activeShift?.openingCash || 0;
  const expectedCash = openingCash + summary.cashRevenue - summary.cashExpenses;
  const [counted, setCounted] = useState(expectedCash);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const diff = counted - expectedCash;

  const close = async () => {
    if (!activeShift?._id) {
      // Aktiv смена yo'q — yangi смена ochish ekraniga o'tamiz (qayta ochish)
      ctx.onShiftChanged(null);
      ctx.go('shiftOpen');
      return;
    }
    if (!confirm('Закрыть смену? Это действие необратимо.')) return;
    setBusy(true);
    try {
      await api.closeShift(activeShift._id, counted, notes || undefined);
      ctx.onShiftChanged(null);
      ctx.go('shiftOpen');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Смена allaqachon yopilgan (boshqa terminal / scheduler / takroriy bosish)
      // → bu xato emas: holatni tozalab, "ochish" ekraniga o'tamiz.
      if (/не найдена|not found|NOT_FOUND/i.test(msg)) {
        ctx.onShiftChanged(null);
        ctx.go('shiftOpen');
      } else {
        alert(msg || 'Не удалось закрыть смену');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          background: T.cancelled,
          color: '#fff',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.4 }}>
          ЗАКРЫТИЕ СМЕНЫ {activeShift ? `№${activeShift.shiftNumber}` : ''}
        </span>
        <Btn onClick={() => ctx.go('orders')} bg="rgba(255,255,255,0.18)" color="#fff" height={48}>
          ← Назад
        </Btn>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          padding: 22,
          overflow: 'hidden',
        }}
      >
        {/* Stats */}
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: T.textMuted,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Итоги смены
          </div>
          <Row label="Заказов" value={`${summary.totalOrders} (оплачено ${summary.paidOrders})`} />
          <Row label="Выручка" value={fmt(summary.totalRevenue)} numeric />
          <Row label="Наличные" value={fmt(summary.cashRevenue)} numeric color={T.ready} />
          <Row label="Карта" value={fmt(summary.cardRevenue)} numeric color={T.served} />
          <Row label="Перевод" value={fmt(summary.clickRevenue)} numeric color={T.cta} />
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 4 }}>
            <Row label="Расходы (нал.)" value={fmt(summary.cashExpenses)} numeric color={T.cancelled} />
            <Row label="Расходы (перевод)" value={fmt(summary.clickExpenses)} numeric color={T.cancelled} />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ background: T.panel, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="Касса на открытие" value={fmt(openingCash)} numeric />
            <Row label="+ Наличные за смену" value={fmt(summary.cashRevenue)} numeric color={T.ready} />
            <Row label="− Расходы наличными" value={fmt(summary.cashExpenses)} numeric color={T.cancelled} />
            <div
              style={{
                borderTop: `2px solid ${T.borderStrong}`,
                marginTop: 8,
                paddingTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Должно быть в кассе
              </span>
              <span style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(expectedCash)}
              </span>
            </div>
          </div>
        </div>

        {/* Cash count */}
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: T.textMuted,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Пересчитайте наличные в кассе
          </div>
          <div
            style={{
              background: T.panel,
              border: `2px solid ${T.borderStrong}`,
              padding: '18px 24px',
              fontSize: 44,
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
            }}
          >
            {fmt(counted)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[500, 1000, 2000, 5000, 10000, 20000, -1000, -10000].map((d) => (
              <button
                key={d}
                onClick={() => setCounted((c) => Math.max(0, c + d))}
                style={{
                  height: 50,
                  background: d < 0 ? T.cancelledBg : T.panel,
                  color: d < 0 ? T.cancelled : T.text,
                  border: `1px solid ${T.border}`,
                  fontFamily: T.font,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {d > 0 ? '+' : ''}
                {fmtN(d)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCounted(expectedCash)}
            style={{
              height: 38,
              background: T.panel,
              border: `1px solid ${T.border}`,
              fontFamily: T.font,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Сбросить к ожидаемому
          </button>

          <div
            style={{
              background: diff === 0 ? T.readyBg : diff > 0 ? T.preparingBg : T.cancelledBg,
              color: diff === 0 ? T.ready : diff > 0 ? T.preparing : T.cancelled,
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {diff === 0 ? '✓ Совпадает' : diff > 0 ? 'Излишек' : 'Недостача'}
            </span>
            <span style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
              {diff > 0 ? '+' : ''}
              {fmt(diff)}
            </span>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Заметки по закрытию смены (по желанию)"
            style={{
              minHeight: 56,
              padding: 12,
              background: T.panel,
              border: `2px solid ${T.border}`,
              fontFamily: T.font,
              fontSize: 15,
              resize: 'none',
            }}
          />

          <div style={{ flex: 1 }} />
          <CTA height={64} fontSize={20} onClick={close} color={T.cancelled} disabled={busy}>
            <NavIcon kind="check" color="#fff" /> {busy ? 'ЗАКРЫТИЕ…' : 'ЗАКРЫТЬ СМЕНУ'}
          </CTA>
        </div>
      </div>
    </div>
  );
}
