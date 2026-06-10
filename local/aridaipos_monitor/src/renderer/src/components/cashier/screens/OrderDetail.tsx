'use client';

import { useState, useEffect } from 'react';
import { OrderItem } from '@/types';
import { api } from '@/services/api';
import { T, NavIcon, fmt, payLabel, StatusKey } from '@/lib/theme';
import { StatusPill, Pager, CTA, Btn, Row } from '../shell';
import { ScreenCtx } from './types';
import { computeHourlyForItem, formatDuration, calculateHourlyCharge } from './Dashboard';

type ModalState =
  | { kind: 'qty'; it: OrderItem; value: number }
  | { kind: 'cancelItem'; it: OrderItem }
  | { kind: 'cancelOrder' }
  | { kind: 'refund' }
  | null;

export function OrderDetailScreen({ ctx }: { ctx: ScreenCtx }) {
  const order = ctx.currentOrder;
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);
  // #2: shu order uchun chegирма
  const [discOpen, setDiscOpen] = useState(false);
  const [discBusy, setDiscBusy] = useState(false);

  useEffect(() => {
    if (!order) ctx.go('orders');
  }, [order, ctx]);
  if (!order) return null;

  const now = Date.now();
  const isPaid = order.paymentStatus === 'paid';
  const isRefunded = order.paymentStatus === 'refunded';
  const items = order.items.filter((i) => !i.isDeleted);
  const activeItems = items.filter((i) => i.status !== 'cancelled');
  const paidItems = activeItems.filter((i) => i.isPaid);
  const unpaidItems = activeItems.filter((i) => !i.isPaid);
  const cancelledItems = items.filter((i) => i.status === 'cancelled');

  const amt = (i: OrderItem) => (i.isHourly ? computeHourlyForItem(i, now).amount : i.price * i.quantity);
  const unpaidSubtotal = unpaidItems.reduce((s, i) => s + amt(i), 0);
  const paidSubtotal = paidItems.reduce((s, i) => s + amt(i), 0);
  const activeTotal = activeItems.reduce((s, i) => s + amt(i), 0);
  const { hours, charge } = calculateHourlyCharge(order);
  const hourly = isPaid ? order.hourlyCharge || 0 : charge;
  const remaining = unpaidSubtotal + hourly;

  const rows = [...unpaidItems, ...paidItems, ...cancelledItems];
  const PER = 6;
  const totalPages = Math.max(1, Math.ceil(rows.length / PER));
  const curPage = Math.min(page, totalPages);
  const visible = rows.slice((curPage - 1) * PER, curPage * PER);

  // Встроенные модалки (нативные confirm/prompt не работают во встроенном
  // POS-webview — поэтому свой оверлей).
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const askQty = (it: OrderItem) => {
    setModalErr(null);
    setModal({ kind: 'qty', it, value: it.quantity });
  };
  const askCancelItem = (it: OrderItem) => {
    setModalErr(null);
    setModal({ kind: 'cancelItem', it });
  };
  const askCancelOrder = () => {
    setModalErr(null);
    setModal({ kind: 'cancelOrder' });
  };
  const askRefund = () => {
    setModalErr(null);
    setModal({ kind: 'refund' });
  };

  const runModal = async () => {
    if (!modal || busy) return;
    setBusy(true);
    setModalErr(null);
    try {
      if (modal.kind === 'qty') {
        const q = Math.max(1, Math.floor(modal.value || 1));
        if (q !== modal.it.quantity) await ctx.onChangeItemQty(order._id, modal.it._id, q);
      } else if (modal.kind === 'cancelItem') {
        await ctx.onCancelItem(order._id, modal.it._id);
      } else if (modal.kind === 'cancelOrder') {
        await ctx.onCancelOrder(order._id);
        setModal(null);
        ctx.go('orders'); // bekor qilingach ro'yxatga qaytamiz
        return;
      } else if (modal.kind === 'refund') {
        await ctx.onRefund(order._id);
        setModal(null);
        ctx.go('orders'); // qaytarilgach ro'yxatga qaytamiz
        return;
      }
      setModal(null);
    } catch (e) {
      setModalErr(e instanceof Error ? e.message : 'Не удалось выполнить');
    } finally {
      setBusy(false);
    }
  };

  const sk: StatusKey = isPaid ? 'paid' : order.status === 'cancelled' ? 'cancelled' : 'preparing';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
      <div
        style={{
          background: T.surface,
          borderBottom: `2px solid ${T.borderStrong}`,
          padding: '14px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              lineHeight: 1,
              display: 'flex',
              gap: 14,
              alignItems: 'baseline',
            }}
          >
            <span>{order.orderType === 'saboy' ? 'Собой' : order.tableName}</span>
            {ctx.tableCategory(order) ? (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: T.cta,
                  background: T.cta + '18',
                  padding: '4px 12px',
                  borderRadius: 8,
                }}
              >
                {ctx.tableCategory(order)}
              </span>
            ) : null}
            <span style={{ fontSize: 18, color: T.textMuted, fontWeight: 600 }}>{order.isOffline ? 'Офлайн' : `№${order.orderNumber}`}</span>
            {order.orderType === 'saboy' && (
              <span
                style={{
                  fontSize: 13,
                  padding: '4px 10px',
                  background: T.saboyBg,
                  color: T.saboy,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                }}
              >
                СОБОЙ
              </span>
            )}
            {order.hasHourlyCharge && (
              <span
                style={{
                  fontSize: 13,
                  padding: '4px 10px',
                  background: T.hourlyBg,
                  color: T.hourly,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                }}
              >
                ПОЧАСОВО
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, color: T.textMuted, marginTop: 6 }}>
            Официант · <strong style={{ color: T.text }}>{order.waiter.name}</strong> &nbsp;·&nbsp; Открыт в{' '}
            {new Date(order.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isPaid && order.orderType !== 'saboy' && (
            <button
              onClick={() => setDiscOpen(true)}
              style={{
                height: 52,
                padding: '0 18px',
                background: (order.discountPercent || 0) > 0 ? T.served : T.surface,
                color: (order.discountPercent || 0) > 0 ? '#fff' : T.text,
                border: `2px solid ${(order.discountPercent || 0) > 0 ? T.served : T.borderStrong}`,
                fontFamily: T.font,
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Скидка{(order.discountPercent || 0) > 0 ? ` ${order.discountPercent}%` : ''}
            </button>
          )}
          {!isPaid && order.status !== 'cancelled' && (
            <button
              onClick={askCancelOrder}
              title="Отменить заказ"
              style={{
                height: 52,
                padding: '0 18px',
                background: T.surface,
                color: T.cancelled,
                border: `2px solid ${T.cancelled}`,
                fontFamily: T.font,
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <NavIcon kind="x" color={T.cancelled} size={18} /> Отменить
            </button>
          )}
          <StatusPill status={sk} size="lg" />
          <Btn onClick={() => ctx.go('orders')} height={52}>
            <NavIcon kind="chevronLeft" /> К заказам
          </Btn>
        </div>
      </div>

      {discOpen && (
        <div
          onClick={() => !discBusy && setDiscOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              padding: 24,
              width: 460,
              maxWidth: '90%',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: T.text, marginBottom: 4 }}>
              Скидка на заказ
            </div>
            <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 18 }}>
              {order.tableName} · применяется только к этому заказу
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[0, 5, 10, 15, 20, 25, 30, 50].map((p) => {
                const active = (order.discountPercent || 0) === p;
                return (
                  <button
                    key={p}
                    disabled={discBusy}
                    onClick={async () => {
                      setDiscBusy(true);
                      try {
                        await api.setOrderDiscount(order._id, p);
                        await ctx.reload();
                        setDiscOpen(false);
                      } catch {
                        alert('Не удалось применить скидку');
                      } finally {
                        setDiscBusy(false);
                      }
                    }}
                    style={{
                      height: 64,
                      background: active ? T.served : T.panel,
                      color: active ? '#fff' : T.text,
                      border: `2px solid ${active ? T.served : T.border}`,
                      fontFamily: T.font,
                      fontSize: 20,
                      fontWeight: 900,
                      cursor: discBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {p === 0 ? 'Нет' : `${p}%`}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => !discBusy && setDiscOpen(false)}
              style={{
                marginTop: 18,
                width: '100%',
                height: 52,
                background: T.panel,
                color: T.text,
                border: `1px solid ${T.border}`,
                fontFamily: T.font,
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>
        {/* LEFT — items */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div
              style={{
                flex: 1,
                padding: 18,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {visible.map((it) => {
                const itemPaid = it.isPaid;
                const itemCancelled = it.status === 'cancelled';
                const h = it.isHourly ? computeHourlyForItem(it, now) : null;
                const stColor =
                  itemCancelled
                    ? T.cancelled
                    : itemPaid
                      ? T.paid
                      : it.status === 'served'
                        ? T.served
                        : it.status === 'ready'
                          ? T.ready
                          : it.status === 'preparing'
                            ? T.preparing
                            : T.pending;
                return (
                  <div
                    key={it._id}
                    style={{
                      background: itemPaid ? T.paidBg : itemCancelled ? T.cancelledBg : T.surface,
                      border: `1px solid ${T.border}`,
                      borderLeft: `5px solid ${stColor}`,
                      padding: '14px 18px',
                      display: 'grid',
                      gridTemplateColumns: '76px 1fr 104px 132px 44px',
                      alignItems: 'center',
                      gap: 14,
                      opacity: itemCancelled ? 0.7 : 1,
                      textDecoration: itemPaid || itemCancelled ? 'line-through' : 'none',
                    }}
                  >
                    {!isPaid && !itemPaid && !itemCancelled && !h ? (
                      <button
                        onClick={() => askQty(it)}
                        title="Изменить количество"
                        style={{
                          background: T.panel,
                          border: `2px solid ${T.borderStrong}`,
                          padding: '6px 0',
                          fontSize: 16,
                          fontWeight: 800,
                          fontFamily: T.font,
                          fontVariantNumeric: 'tabular-nums',
                          textAlign: 'center',
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                      >
                        {it.quantity}× ✎
                      </button>
                    ) : (
                      <div
                        style={{
                          background: T.panel,
                          padding: '6px 0',
                          fontSize: 16,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          textAlign: 'center',
                        }}
                      >
                        {h ? formatDuration(h.totalMinutes) : `${it.quantity}×`}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 700 }}>{it.name}</div>
                      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>
                        {h ? (
                          <span style={{ color: T.hourly, fontWeight: 700 }}>
                            ● ПОЧАСОВО ({fmt(it.hourlyPrice || 0)}/ч)
                          </span>
                        ) : (
                          `${fmt(it.price)} × ${it.quantity}`
                        )}
                      </div>
                    </div>
                    <StatusPill
                      status={
                        itemPaid ? 'paid' : itemCancelled ? 'cancelled' : (it.status as StatusKey)
                      }
                      size="sm"
                    />
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'right',
                      }}
                    >
                      {fmt(amt(it))}
                    </div>
                    {!isPaid && !itemPaid && !itemCancelled ? (
                      <button
                        onClick={() => askCancelItem(it)}
                        title="Отменить блюдо"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: T.cancelledBg,
                          border: `1px solid ${T.cancelled}`,
                          color: T.cancelled,
                          fontSize: 18,
                          fontWeight: 900,
                          lineHeight: 1,
                          cursor: 'pointer',
                          fontFamily: T.font,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textDecoration: 'none',
                        }}
                      >
                        ✕
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div
                style={{
                  width: 76,
                  background: T.surface,
                  borderLeft: `1px solid ${T.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: 10,
                }}
              >
                <Pager
                  page={curPage}
                  total={totalPages}
                  onPrev={() => setPage(Math.max(1, curPage - 1))}
                  onNext={() => setPage(Math.min(totalPages, curPage + 1))}
                />
              </div>
            )}
          </div>

          <div
            style={{
              background: T.surface,
              borderTop: `2px solid ${T.borderStrong}`,
              padding: 14,
              display: 'grid',
              gridTemplateColumns: isPaid || isRefunded ? '1fr 2fr' : '1fr 1fr 2fr',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <Btn onClick={() => ctx.onPrint(order)} height={68} fontSize={18}>
              <NavIcon kind="printer" /> Печать чека
            </Btn>
            {!isPaid && !isRefunded && (
              <Btn onClick={() => ctx.go('addItems')} height={68} fontSize={18}>
                <NavIcon kind="plus" /> Добавить
              </Btn>
            )}
            {!isPaid && !isRefunded ? (
              <CTA height={68} fontSize={22} onClick={() => ctx.go('payment')}>
                <NavIcon kind="check" color="#fff" /> ПРИНЯТЬ ОПЛАТУ
              </CTA>
            ) : isRefunded ? (
              <div
                style={{
                  height: 68,
                  background: T.cancelledBg,
                  color: T.cancelled,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                }}
              >
                ВОЗВРАТ ОФОРМЛЕН ↩
              </div>
            ) : (
              <button
                onClick={askRefund}
                style={{
                  height: 68,
                  background: T.cancelledBg,
                  color: T.cancelled,
                  border: 'none',
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                  cursor: 'pointer',
                  fontFamily: T.font,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <NavIcon kind="x" color={T.cancelled} /> ВОЗВРАТ
              </button>
            )}
          </div>
        </div>

        {/* RIGHT — summary */}
        <div
          style={{
            background: T.panel,
            borderLeft: `1px solid ${T.border}`,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: T.textMuted,
              fontWeight: 800,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Сводка
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 14 }}>
            <Row label="Всего блюд" value={items.length} />
            <Row label="Активные" value={activeItems.length} />
            <Row label="Оплачено" value={paidItems.length} color={T.paid} />
            <Row label="Отменено" value={cancelledItems.length} color={T.cancelled} />
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 14 }}>
            {paidItems.length > 0 && (
              <Row label="Уже оплачено" value={fmt(paidSubtotal)} strike color={T.paid} numeric />
            )}
            <Row label="Подытог · к оплате" value={fmt(unpaidSubtotal)} numeric />
            {order.hasHourlyCharge && hourly > 0 && (
              <Row label={`Время (${isPaid ? order.hourlyChargeHours || 1 : hours} ч)`} value={fmt(hourly)} numeric color={T.hourly} />
            )}
            <div
              style={{
                borderTop: `2px solid ${T.borderStrong}`,
                marginTop: 8,
                paddingTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                {isPaid ? 'Итого оплачено' : 'К оплате'}
              </span>
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  color: T.cta,
                }}
              >
                {fmt(isPaid ? activeTotal + (order.hourlyCharge || 0) : remaining)}
              </span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {isPaid && (
            <div style={{ background: T.paidBg, padding: 14, textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 13,
                  color: T.paid,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Оплачено
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.paid, marginTop: 4 }}>
                {payLabel(order.paymentType)}
                {order.paidAt
                  ? ' · ' +
                    new Date(order.paidAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div
          onClick={() => !busy && setModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.surface,
              width: 520,
              maxWidth: '90%',
              border: `1px solid ${T.border}`,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {modal.kind === 'qty' && (
              <>
                <div style={{ fontSize: 22, fontWeight: 900 }}>Количество</div>
                <div style={{ fontSize: 16, color: T.textMuted }}>{modal.it.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                  <button
                    onClick={() => setModal({ ...modal, value: Math.max(1, modal.value - 1) })}
                    style={stepBtn}
                  >
                    −
                  </button>
                  <div
                    style={{
                      minWidth: 110,
                      textAlign: 'center',
                      fontSize: 44,
                      fontWeight: 900,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {modal.value}
                  </div>
                  <button onClick={() => setModal({ ...modal, value: modal.value + 1 })} style={stepBtn}>
                    +
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <button key={n} onClick={() => setModal({ ...modal, value: n })} style={quickBtn}>
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center' }}>
                  Было {modal.it.quantity} → станет {modal.value}.
                </div>
              </>
            )}

            {modal.kind === 'cancelItem' && (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.cancelled }}>Отменить блюдо?</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
                  {modal.it.name} · {modal.it.quantity}×
                </div>
                <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5 }}>
                  Позиция будет убрана из заказа и не войдёт в счёт. Последнее блюдо удалить
                  нельзя — в этом случае отмените весь заказ.
                </div>
              </>
            )}

            {modal.kind === 'cancelOrder' && (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.cancelled }}>Отменить заказ?</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
                  {order.orderType === 'saboy' ? 'Собой' : order.tableName}
                  {order.isOffline ? ' · Офлайн' : ` · №${order.orderNumber}`}
                </div>
                <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5 }}>
                  Весь заказ будет отменён, стол освободится. Отменённый заказ нельзя вернуть
                  из кассы.
                </div>
              </>
            )}

            {modal.kind === 'refund' && (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.cancelled }}>Оформить возврат?</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
                  {order.orderType === 'saboy' ? 'Собой' : order.tableName}
                  {order.isOffline ? ' · Офлайн' : ` · №${order.orderNumber}`}
                </div>
                <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5 }}>
                  Оплаченный заказ будет возвращён клиенту. Сумма НЕ войдёт в выручку смены
                  (наличные возвращаются из кассы).
                </div>
              </>
            )}

            {modalErr && (
              <div style={{ background: T.cancelledBg, color: T.cancelled, padding: '10px 14px', fontWeight: 700, fontSize: 14 }}>
                {modalErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => !busy && setModal(null)} style={{ ...modalBtn, flex: 1, background: T.surface, color: T.text, border: `2px solid ${T.borderStrong}` }}>
                Закрыть
              </button>
              <button
                onClick={runModal}
                disabled={busy}
                style={{
                  ...modalBtn,
                  flex: 2,
                  background: modal.kind === 'qty' ? T.cta : T.cancelled,
                  color: '#fff',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy
                  ? '…'
                  : modal.kind === 'qty'
                    ? 'Сохранить'
                    : modal.kind === 'cancelItem'
                      ? 'Отменить блюдо'
                      : modal.kind === 'refund'
                        ? 'Оформить возврат'
                        : 'Отменить заказ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 72,
  height: 72,
  fontSize: 34,
  fontWeight: 900,
  background: T.panel,
  border: `2px solid ${T.borderStrong}`,
  color: T.text,
  cursor: 'pointer',
  fontFamily: T.font,
};
const quickBtn: React.CSSProperties = {
  minWidth: 48,
  height: 44,
  fontSize: 16,
  fontWeight: 800,
  background: T.panel,
  border: `2px solid ${T.border}`,
  color: T.text,
  cursor: 'pointer',
  fontFamily: T.font,
};
const modalBtn: React.CSSProperties = {
  height: 60,
  fontSize: 18,
  fontWeight: 800,
  border: 'none',
  cursor: 'pointer',
  fontFamily: T.font,
};
