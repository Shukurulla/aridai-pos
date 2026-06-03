'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Order, OrderItem } from '@/types';
import { api } from '@/services/api';
import { T, NavIcon, fmt, payLabel, StatusKey } from '@/lib/theme';
import { StatusPill, Pager, CTA, Btn } from '../shell';
import { ScreenCtx } from './types';
import { computeHourlyForItem, formatDuration, calculateHourlyCharge } from '@/utils/hourly';

// ─── Hourly helpers — YAGONA MANBA endi @/utils/hourly (api.ts ham ishlatadi).
// Lokal ishlatamiz VA eski import yo'llari (OrderDetail) buzilmasin uchun
// shu yerdan re-export qilamiz.
export { computeHourlyForItem, formatDuration, calculateHourlyCharge };

// Order vaqti: HH:MM:SS DD.MM.YYYY
const fmtDT = (s?: string) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${p(d.getDate())}.${p(
    d.getMonth() + 1,
  )}.${d.getFullYear()}`;
};

// Derive display status (StatusKey) from order + items
export const orderStatusKey = (order: Order): StatusKey => {
  if (order.status === 'cancelled') return 'cancelled';
  if (order.paymentStatus === 'paid') return 'paid';
  const activeItems = order.items.filter((i) => i.status !== 'cancelled');
  if (activeItems.length === 0) return 'pending';
  const allServed = activeItems.every((i) => i.status === 'served');
  const allReady = activeItems.every((i) => i.status === 'ready' || i.status === 'served');
  const anyPreparing = activeItems.some((i) => i.status === 'preparing');
  if (allServed) return 'served';
  if (allReady) return 'ready';
  if (anyPreparing) return 'preparing';
  return 'pending';
};

// ─── Order Card (компактная) ──────────────────────────────────────────────────
function OrderCard({
  order,
  onOpen,
  onPay,
  onAdd,
  onPrint,
  mergeMode,
  isSelected,
  selectionIndex,
  onToggleSelect,
  online,
  category,
  branchSvc,
}: {
  order: Order;
  onOpen: () => void;
  onPay: () => void;
  onAdd: () => void;
  onPrint: () => void;
  mergeMode: boolean;
  isSelected: boolean;
  selectionIndex: number;
  onToggleSelect: () => void;
  online: boolean;
  category: string;
  branchSvc: { en: boolean; pct: number; disc: number };
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (order.paymentStatus === 'paid') return;
    const hasHourly =
      order.hasHourlyCharge ||
      order.items.some((i) => i.isHourly && !i.isPaid && i.status !== 'cancelled' && !i.isDeleted);
    if (!hasHourly) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [order]);

  const now = Date.now();
  const isPaid = order.paymentStatus === 'paid';
  const isCancelled = order.status === 'cancelled';
  const sk = isPaid ? 'paid' : isCancelled ? 'cancelled' : orderStatusKey(order);
  const statusColor =
    sk === 'served' ? T.served : sk === 'ready' ? T.ready : sk === 'preparing' ? T.preparing : sk === 'paid' ? T.paid : sk === 'cancelled' ? T.cancelled : T.pending;

  const allItems = order.items.filter((i) => !i.isDeleted);
  const activeItems = allItems.filter((i) => i.status !== 'cancelled');
  const paidItems = activeItems.filter((i) => i.isPaid);
  const unpaidItems = activeItems.filter((i) => !i.isPaid);
  const itemAmount = (i: OrderItem) => (i.isHourly ? computeHourlyForItem(i, now).amount : i.price * i.quantity);
  const unpaidSubtotal = unpaidItems.reduce((s, i) => s + itemAmount(i), 0);
  const activeItemsTotal = activeItems.reduce((s, i) => s + itemAmount(i), 0);
  const hourly = isPaid ? order.hourlyCharge || 0 : calculateHourlyCharge(order).charge;
  // услуга/chegirma — order'da % bo'lsa o'sha, bo'lmasa FILIAL sozlamasi
  // (xizmat yoqilishidan oldin yaratilgan order'larga ham qo'shilsin).
  // To'lov ekrani / chek bilan AYNAN bir xil mantiq — divergensiya yo'q.
  const _base = isPaid ? activeItemsTotal : unpaidSubtotal;
  const _oSvc = Number(order.serviceCharge || 0);
  const _oSvcP = Number(order.serviceChargePercent || 0);
  const _oDisc = Number(order.discount || 0);
  const _oDiscP = Number(order.discountPercent || 0);
  // Услуга = STOL XIZMATI → saboy/takeaway uchun UMUMAN yo'q (backend bilan bir xil).
  const _isDineIn = order.orderType !== 'saboy' && order.orderType !== 'takeaway';
  const _svcPct = !_isDineIn ? 0 : _oSvcP > 0 ? _oSvcP : branchSvc.en ? branchSvc.pct : 0;
  const _discPct = _oDiscP > 0 ? _oDiscP : branchSvc.disc > 0 ? branchSvc.disc : 0;
  const _svcFee = !_isDineIn ? 0 : _oSvc > 0 ? _oSvc : _svcPct > 0 ? Math.round(_base * (_svcPct / 100)) : 0;
  const _discAmt = _oDisc > 0 ? _oDisc : _discPct > 0 ? Math.round(_base * (_discPct / 100)) : 0;
  const grandTotal = isPaid
    ? order.grandTotal && order.grandTotal > 0
      ? order.grandTotal
      : activeItemsTotal + (order.hourlyCharge || 0) + _svcFee - _discAmt
    : unpaidSubtotal + hourly + _svcFee - _discAmt;

  const canMerge = !isPaid && !isCancelled;
  const itemCount = activeItems.reduce((s, i) => s + (i.quantity || 1), 0);

  const handleClick = () => {
    if (mergeMode) {
      if (canMerge) onToggleSelect();
      return;
    }
    if (isPaid || isCancelled) onOpen();
    else onPay();
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: T.surface,
        border: isSelected ? `3px solid ${T.cta}` : mergeMode && canMerge ? `2px dashed ${T.cta}` : `1px solid ${T.border}`,
        borderLeft: isSelected ? `7px solid ${T.cta}` : `7px solid ${statusColor}`,
        display: 'flex',
        flexDirection: 'column',
        cursor: mergeMode ? (canMerge ? 'pointer' : 'not-allowed') : 'pointer',
        opacity: mergeMode && !canMerge ? 0.5 : 1,
        position: 'relative',
      }}
    >
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 34,
            height: 34,
            background: T.cta,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 900,
            borderRadius: 999,
            border: '3px solid #fff',
          }}
        >
          {selectionIndex === 0 ? '★' : selectionIndex + 1}
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {order.orderType === 'saboy' ? 'Собой' : order.tableName}
          </div>
          {category ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: T.cta,
                background: T.cta + '18',
                padding: '3px 8px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {category}
            </span>
          ) : null}
          <StatusPill status={sk} size="sm" />
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {order.isOffline ? 'Офлайн' : `№${order.orderNumber}`} · {order.waiter?.name || '—'} · {itemCount} блюд
        </div>
        {/* Order ID qisqartmasi — debug/transparency uchun. Kart har order
            o'zining ID si bilan ko'rinadi; "fantom" eski orderlar aniq
            farqlanadi (foydalanuvchi talabi). */}
        <div style={{ fontSize: 10, color: T.textMuted, opacity: 0.7, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ID: {order._id ? String(order._id).slice(-8) : '—'}
        </div>
        {fmtDT(order.createdAt) && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
            {fmtDT(order.createdAt)}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {isPaid ? 'Оплачено' : 'К оплате'}
          </span>
          <span style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: isPaid ? T.paid : T.text }}>
            {fmt(grandTotal)}
          </span>
        </div>
      </div>

      {!mergeMode && (
        <div style={{ display: 'flex', borderTop: `1px solid ${T.border}` }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrint();
            }}
            style={{
              flex: 1,
              height: 46,
              background: T.surface,
              color: T.text,
              border: 'none',
              borderRight: `1px solid ${T.border}`,
              fontSize: 14,
              fontWeight: 800,
              fontFamily: T.font,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <NavIcon kind="printer" size={17} /> Чек
          </button>
          {!isPaid && !isCancelled && !online && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              style={{
                flex: 1,
                height: 46,
                background: T.surface,
                color: T.text,
                border: 'none',
                borderRight: `1px solid ${T.border}`,
                fontSize: 14,
                fontWeight: 800,
                fontFamily: T.font,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <NavIcon kind="receipt" size={17} /> Детали
            </button>
          )}
          {!isPaid && !isCancelled ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              style={{
                flex: 1,
                height: 46,
                background: T.surface,
                color: T.text,
                border: 'none',
                fontSize: 14,
                fontWeight: 800,
                fontFamily: T.font,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <NavIcon kind="plus" size={17} /> Блюдо
            </button>
          ) : (
            <div
              style={{
                flex: 1,
                height: 46,
                background: isPaid ? T.paidBg : T.cancelledBg,
                color: isPaid ? T.paid : T.cancelled,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.4,
              }}
            >
              {isPaid ? payLabel(order.paymentType) : 'ОТМЕНЁН'}
            </div>
          )}
        </div>
      )}
      {mergeMode && canMerge && !isSelected && (
        <div
          style={{
            padding: '8px 16px',
            background: T.cta + '15',
            color: T.cta,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            borderTop: `1px solid ${T.border}`,
          }}
        >
          Нажмите для выбора
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Screen ────────────────────────────────────────────────────────
const hasActiveItems = (order: Order) => {
  const items = order.items || [];
  if (items.length === 0) return false;
  return items.some((i) => i.status !== 'cancelled' && !i.isCancelled);
};

export function DashboardScreen({ ctx }: { ctx: ScreenCtx }) {
  const mergeMode = ctx.screen === 'merge';
  const [filter, setFilter] = useState<'active' | 'paid' | 'cancelled' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [merging, setMerging] = useState(false);
  const selected = ctx.mergeSelection;

  // Zoomga MOSLASHUVCHI grid: konteynerni o'lchab, nechta karta sig'sa
  // (ustun × qator) — shuncha PER_PAGE. Zoom uzoqlashsa (CSS px ko'payadi)
  // → ko'proq ustun/qator → ko'proq order bir sahifada, bo'sh joy va
  // ortiqcha sahifalar yo'qoladi. Tartib: aniq `repeat(cols,1fr)`.
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridFit, setGridFit] = useState({ cols: 4, rows: 2 });
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const CARD_W = 300;
    const CARD_H = 210;
    const GAP = 14;
    const PAD = 36;
    const recompute = () => {
      const w = el.clientWidth - PAD;
      const h = el.clientHeight - PAD;
      const cols = Math.max(1, Math.floor((w + GAP) / (CARD_W + GAP)));
      const rows = Math.max(1, Math.floor((h + GAP) / (CARD_H + GAP)));
      setGridFit((g) => (g.cols === cols && g.rows === rows ? g : { cols, rows }));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const orders = ctx.orders;
  const activeOrders = orders.filter(
    (o) => o.paymentStatus !== 'paid' && o.status !== 'cancelled' && hasActiveItems(o),
  );
  const paidOrders = orders
    .filter((o) => o.paymentStatus === 'paid')
    .sort((a, b) => {
      const da = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const db = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return da - db;
    });
  const cancelledOrders = orders.filter(
    (o) => o.status === 'cancelled' || (o.paymentStatus !== 'paid' && !hasActiveItems(o)),
  );

  // Saboy DARHOL to'langan → "Готовится" emas, "Оплачено"/"Все" tabga tushadi.
  // Foydalanuvchi saboy yaratib "orders"ga qaytganda standart "Готовится"
  // tab bo'sh bo'lsa-yu, lekin to'langan/bekor orderlar bo'lsa — ekran
  // "bo'm-bo'sh, saboy chiqmadi" bo'lib ko'rinmasin: bir marta "Все"ga
  // o'tamiz (foydalanuvchi qo'lda tanlagandan keyin ARALASHMAYMIZ).
  const didAutoTab = useRef(false);
  useEffect(() => {
    if (didAutoTab.current) return;
    if (orders.length === 0) return;
    didAutoTab.current = true;
    if (activeOrders.length === 0 && (paidOrders.length > 0 || cancelledOrders.length > 0)) {
      setFilter('all');
    }
  }, [orders.length, activeOrders.length, paidOrders.length, cancelledOrders.length]);

  const base = mergeMode
    ? activeOrders
    : filter === 'active'
      ? activeOrders
      : filter === 'paid'
        ? paidOrders
        : filter === 'cancelled'
          ? cancelledOrders
          : orders;

  const filtered = useMemo(() => {
    if (!search.trim()) return base;
    const q = search.toLowerCase().trim();
    return base.filter(
      (o) =>
        o.tableName?.toLowerCase().includes(q) ||
        o.tableNumber?.toString().includes(q) ||
        o.orderNumber?.toString().includes(q) ||
        o.waiter?.name?.toLowerCase().includes(q) ||
        o.items?.some((i) => i.name?.toLowerCase().includes(q)),
    );
  }, [base, search]);

  const PER_PAGE = Math.max(4, gridFit.cols * gridFit.rows);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const visible = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  const tabs = [
    { id: 'active' as const, label: 'Готовится', count: activeOrders.length },
    { id: 'paid' as const, label: 'Оплачено', count: paidOrders.length },
    { id: 'cancelled' as const, label: 'Отменено', count: cancelledOrders.length },
    { id: 'all' as const, label: 'Все', count: orders.length },
  ];

  const toggleMerge = (id: string) => {
    ctx.setMergeSelection(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  };

  const doMerge = async () => {
    if (selected.length < 2) {
      alert('Выберите минимум 2 заказа');
      return;
    }
    setMerging(true);
    try {
      const res = await api.mergeOrders(selected[0], selected.slice(1));
      if (res.success) {
        alert(res.message);
        ctx.setMergeSelection([]);
        await ctx.reload();
        ctx.go('orders');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Объединение не выполнено');
    } finally {
      setMerging(false);
    }
  };

  const open = (o: Order) => {
    ctx.setCurrentOrderId(o._id);
    ctx.go('orderDetail');
  };
  const pay = (o: Order) => {
    ctx.setCurrentOrderId(o._id);
    ctx.go('payment');
  };
  const add = (o: Order) => {
    ctx.setCurrentOrderId(o._id);
    ctx.go('addItems');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '14px 18px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}
      >
        {!mergeMode && (
          <div style={{ display: 'flex', background: T.surface, border: `1px solid ${T.border}` }}>
            {tabs.map((t, i) => {
              const a = t.id === filter;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setFilter(t.id);
                    setPage(1);
                  }}
                  style={{
                    height: 60,
                    padding: '0 22px',
                    background: a ? T.borderStrong : 'transparent',
                    color: a ? '#fff' : T.text,
                    border: 'none',
                    borderRight: i < tabs.length - 1 ? `1px solid ${T.border}` : 'none',
                    fontFamily: T.font,
                    fontSize: 18,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <span>{t.label}</span>
                  <span
                    style={{
                      background: a ? '#fff' : T.panelStrong,
                      color: a ? T.borderStrong : T.textMuted,
                      padding: '2px 10px',
                      fontSize: 14,
                      fontWeight: 800,
                      minWidth: 30,
                      textAlign: 'center',
                    }}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div
          style={{
            flex: 1,
            height: 60,
            background: T.panel,
            border: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            gap: 12,
            fontSize: 17,
            color: T.text,
          }}
        >
          <NavIcon kind="search" color={T.textDim} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Поиск: стол, официант, блюдо…"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontFamily: T.font,
              fontSize: 17,
              color: T.text,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <NavIcon kind="x" color={T.textMuted} size={20} />
            </button>
          )}
        </div>
        {mergeMode ? (
          <>
            <Btn
              onClick={() => {
                ctx.setMergeSelection([]);
                ctx.go('orders');
              }}
              color={T.cancelled}
              bg={T.cancelledBg}
            >
              <NavIcon kind="x" color={T.cancelled} /> Отмена
            </Btn>
            <CTA onClick={doMerge} fullWidth={false} height={60} fontSize={17} disabled={merging}>
              <NavIcon kind="merge" color="#fff" /> Объединить ({selected.length})
            </CTA>
          </>
        ) : (
          <>
            <Btn
              onClick={() => ctx.activeShift && ctx.go('newOrder')}
              color={'#fff'}
              bg={T.cta}
              disabled={!ctx.activeShift}
            >
              <NavIcon kind="plus" color="#fff" /> Новый заказ
            </Btn>
            <Btn
              onClick={() => ctx.activeShift && ctx.go('saboy')}
              color={T.saboy}
              bg={T.saboyBg}
              disabled={!ctx.activeShift}
            >
              <NavIcon kind="bag" color={T.saboy} /> Собой
            </Btn>
            <Btn onClick={() => ctx.go('merge')} color={T.served} bg={T.servedBg}>
              <NavIcon kind="merge" color={T.served} /> Объединить
            </Btn>
          </>
        )}
      </div>

      {mergeMode && (
        <div
          style={{
            padding: '12px 22px',
            background: T.cta,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Режим объединения</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>
              Выберите минимум 2 заказа. Первый (★) станет основным.
            </div>
          </div>
          {selected.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Выбрано: {selected.length}</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(
                  selected.reduce(
                    (s, id) => s + (orders.find((o) => o._id === id)?.grandTotal || 0),
                    0,
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid + pager */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          ref={gridRef}
          style={{
            flex: 1,
            padding: 18,
            display: 'grid',
            gridTemplateColumns: `repeat(${gridFit.cols}, 1fr)`,
            gridAutoRows: 'min-content',
            alignContent: 'start',
            gap: 14,
            overflow: 'auto',
          }}
        >
          {visible.map((o) => (
            <OrderCard
              key={o._id}
              order={o}
              onOpen={() => open(o)}
              onPay={() => pay(o)}
              onAdd={() => add(o)}
              onPrint={() => ctx.onPrint(o)}
              mergeMode={mergeMode}
              isSelected={selected.includes(o._id)}
              selectionIndex={selected.indexOf(o._id)}
              onToggleSelect={() => toggleMerge(o._id)}
              online={ctx.posOnline}
              category={ctx.tableCategory(o)}
              branchSvc={ctx.branchSvc}
            />
          ))}
          {visible.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: 60,
                textAlign: 'center',
                color: T.textDim,
                fontSize: 18,
                fontWeight: 600,
                border: `1px dashed ${T.border}`,
                background: T.panel,
              }}
            >
              {search ? 'Ничего не найдено' : 'Заказов нет'}
            </div>
          )}
        </div>

        <div
          style={{
            width: 88,
            background: T.surface,
            borderLeft: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 12,
          }}
        >
          <Pager
            page={curPage}
            total={totalPages}
            onPrev={() => setPage(Math.max(1, curPage - 1))}
            onNext={() => setPage(Math.min(totalPages, curPage + 1))}
          />
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              fontWeight: 800,
              color: T.textMuted,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              lineHeight: 1.3,
            }}
          >
            Всего
            <br />
            {filtered.length} зак.
          </div>
        </div>
      </div>
    </div>
  );
}
