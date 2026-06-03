'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/services/api';
import { PaymentType, SaboyItem, Waiter } from '@/types';
import { T, NavIcon, fmt } from '@/lib/theme';
import { Pager, CTA } from '../shell';
import { ScreenCtx } from './types';

interface MenuItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  isHourly?: boolean; // soatlik taom (PlayStation/kabina) — narx soatiga
}
interface Category {
  _id: string;
  title: string;
}
interface CartItem {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

function MenuScreen({
  title,
  contextLabel,
  confirmLabel,
  kind,
  onBack,
  onConfirm,
  hideHourly = false,
}: {
  title: string;
  contextLabel?: string;
  confirmLabel: string;
  kind: 'add' | 'saboy';
  onBack: () => void;
  onConfirm: (items: CartItem[], paymentType: PaymentType) => Promise<void>;
  hideHourly?: boolean; // soatlik taomlarni yashirish (saboy/takeaway uchun)
}) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuPage, setMenuPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');

  useEffect(() => {
    let alive = true;
    const reload = async () => {
      try {
        const [items, cats] = await Promise.all([api.getMenuItems(), api.getCategories()]);
        if (!alive) return;
        setMenuItems(items);
        setCategories(cats);
      } catch {
        /* tarmoq xatosi — eski menyu qoladi (alert chiqarmaymiz, re-fetch ham bo'lishi mumkin) */
      } finally {
        if (alive) setLoading(false);
      }
    };
    reload();
    // Global'da menyu/kategoriya o'zgarsa (sync → socket "menu:updated" → CashierApp window
    // event) — menyuни REAL-TIME qayta yuklaymiz (dasturni qayta ishga tushirmasdan).
    const h = () => reload();
    window.addEventListener('aridai:menu-updated', h);
    return () => {
      alive = false;
      window.removeEventListener('aridai:menu-updated', h);
    };
  }, []);

  // Soatlik taomlar (PlayStation/kabina) — saboy/takeaway (на вынос) uchun YASHIRILADI:
  // ular o'tirib (dine-in) uchun. hideHourly bo'lsa menyudan ham, kategoriyadan ham chiqadi.
  const pool = useMemo(
    () => (hideHourly ? menuItems.filter((m) => !m.isHourly) : menuItems),
    [menuItems, hideHourly],
  );
  const visibleCategories = useMemo(
    () => (hideHourly ? categories.filter((c) => pool.some((m) => m.category === c._id)) : categories),
    [categories, pool, hideHourly],
  );
  const filtered = useMemo(
    () => (activeCat === 'all' ? pool : pool.filter((m) => m.category === activeCat)),
    [pool, activeCat],
  );
  // Zoomga MOSLASHUVCHI: grid konteyneriga nechta karta sig'sa
  // (ustun × qator) — shuncha PER_PAGE. Zoom uzoqlashsa ko'proq taom
  // bir sahifada; bo'sh joy/ortiqcha sahifa yo'qoladi (scroll'siz).
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridFit, setGridFit] = useState({ cols: 3, rows: 4 });
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const CARD_W = 190;
    const CARD_H = 120;
    const GAP = 10;
    const PAD = 28;
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
  const PER_PAGE = Math.max(6, gridFit.cols * gridFit.rows);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(menuPage, totalPages);
  const visible = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  const addToCart = (m: MenuItem) =>
    setCart((c) => {
      const ex = c.find((x) => x._id === m._id);
      if (ex) return c.map((x) => (x._id === m._id ? { ...x, quantity: x.quantity + 1 } : x));
      return [...c, { _id: m._id, name: m.name, price: m.price, quantity: 1, category: m.category }];
    });
  const setQty = (id: string, delta: number) =>
    setCart((c) =>
      c
        .map((x) => (x._id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x))
        .filter((x) => x.quantity > 0),
    );

  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.price, 0);

  const confirm = async () => {
    if (cart.length === 0 || busy) return;
    setBusy(true);
    try {
      await onConfirm(cart, paymentType);
    } finally {
      setBusy(false);
    }
  };

  // #13: «Назад» с выбранными блюдами — НЕ теряем выбор, а создаём/добавляем
  // (onConfirm у родителя сам делает навигацию). Пустая корзина → просто назад.
  const handleBack = async () => {
    if (busy) return;
    if (cart.length > 0) await confirm();
    else onBack();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
      <div
        style={{
          background: T.cta,
          color: '#fff',
          padding: '12px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.4 }}>{title.toUpperCase()}</span>
          {contextLabel && (
            <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', fontSize: 17, fontWeight: 800 }}>
              {contextLabel}
            </span>
          )}
        </div>
        <button
          onClick={handleBack}
          style={{
            padding: '10px 22px',
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.5)',
            fontFamily: T.font,
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <NavIcon kind="chevronLeft" color="#fff" /> Назад
        </button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '190px 1fr 420px', overflow: 'hidden' }}>
        {/* Categories rail */}
        <div
          style={{
            background: T.surface,
            borderRight: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {[{ _id: 'all', title: 'Все' }, ...visibleCategories].map((c) => {
            const a = c._id === activeCat;
            return (
              <button
                key={c._id}
                onClick={() => {
                  setActiveCat(c._id);
                  setMenuPage(1);
                }}
                style={{
                  padding: '16px 18px',
                  background: a ? T.panel : 'transparent',
                  borderLeft: a ? `5px solid ${T.cta}` : '5px solid transparent',
                  border: 'none',
                  borderBottom: `1px solid ${T.borderSoft}`,
                  fontFamily: T.font,
                  fontSize: 16,
                  fontWeight: a ? 900 : 700,
                  color: a ? T.cta : T.text,
                  cursor: 'pointer',
                  textAlign: 'left',
                  flexShrink: 0,
                }}
              >
                {c.title}
              </button>
            );
          })}
        </div>

        {/* Menu grid + pager */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: T.panel,
          }}
        >
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div
              ref={gridRef}
              style={{
                flex: 1,
                padding: 14,
                overflow: 'hidden',
                display: 'grid',
                gridTemplateColumns: `repeat(${gridFit.cols}, 1fr)`,
                gridAutoRows: '120px',
                gap: 10,
                alignContent: 'start',
              }}
            >
              {loading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: T.textMuted }}>
                  Загрузка меню…
                </div>
              ) : (
                visible.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => addToCart(m)}
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontFamily: T.font,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {m.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 19,
                          fontWeight: 900,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {fmt(m.price)}{m.isHourly ? '/ч' : ''}
                      </span>
                      <span
                        style={{
                          background: T.cta,
                          color: '#fff',
                          width: 38,
                          height: 38,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <NavIcon kind="plus" color="#fff" />
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
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
                onPrev={() => setMenuPage(Math.max(1, curPage - 1))}
                onNext={() => setMenuPage(Math.min(totalPages, curPage + 1))}
              />
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.textMuted,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  lineHeight: 1.3,
                }}
              >
                {filtered.length} блюд
              </div>
            </div>
          </div>
        </div>

        {/* Cart */}
        <div
          style={{
            background: T.surface,
            borderLeft: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              background: T.cta,
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 17,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              flexShrink: 0,
            }}
          >
            <span>Будет добавлено</span>
            <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 12px' }}>{cart.length}</span>
          </div>
          <div style={{ flex: 1, padding: 12, overflow: 'hidden' }}>
            {cart.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 16, fontWeight: 600 }}>
                Нажмите на блюдо в меню,
                <br />
                чтобы добавить в корзину
              </div>
            ) : (
              cart.slice(0, 6).map((c) => (
                <div
                  key={c._id}
                  style={{
                    background: T.panel,
                    border: `1px solid ${T.border}`,
                    padding: '12px 14px',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: T.textMuted,
                        fontVariantNumeric: 'tabular-nums',
                        marginTop: 3,
                      }}
                    >
                      {fmt(c.price)} × {c.quantity} = <strong>{fmt(c.price * c.quantity)}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setQty(c._id, -1)}
                    style={{
                      width: 44,
                      height: 44,
                      border: `2px solid ${T.borderStrong}`,
                      background: T.surface,
                      fontFamily: T.font,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <NavIcon kind="minus" />
                  </button>
                  <span
                    style={{
                      minWidth: 36,
                      textAlign: 'center',
                      fontSize: 22,
                      fontWeight: 900,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {c.quantity}
                  </span>
                  <button
                    onClick={() => setQty(c._id, +1)}
                    style={{
                      width: 44,
                      height: 44,
                      border: 'none',
                      background: T.cta,
                      color: '#fff',
                      fontFamily: T.font,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <NavIcon kind="plus" color="#fff" />
                  </button>
                </div>
              ))
            )}
            {cart.length > 6 && (
              <div style={{ textAlign: 'center', fontSize: 13, color: T.textMuted, fontWeight: 700 }}>
                + ещё {cart.length - 6} позиц.
              </div>
            )}
          </div>
          <div style={{ padding: 14, borderTop: `2px solid ${T.borderStrong}`, background: T.panel, flexShrink: 0 }}>
            {/* Saboy — to'lov tanlash YO'Q: order OCHIQ yaratiladi, to'lov keyin (oshpaz tayyorlagach) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  color: T.textMuted,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Итого
              </span>
              <span style={{ fontSize: 30, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(cartTotal)}
              </span>
            </div>
            <CTA height={68} fontSize={20} onClick={confirm} disabled={cart.length === 0 || busy}>
              <NavIcon kind="check" color="#fff" /> {busy ? 'СОХРАНЕНИЕ…' : confirmLabel.toUpperCase()}
            </CTA>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AddItemsScreen({ ctx }: { ctx: ScreenCtx }) {
  const order = ctx.currentOrder;
  useEffect(() => {
    if (!order) ctx.go('orders');
  }, [order, ctx]);
  if (!order) return null;
  return (
    <MenuScreen
      title="Добавление блюд"
      contextLabel={`${order.orderType === 'saboy' ? 'Собой' : order.tableName} · ${order.isOffline ? 'Офлайн' : `№${order.orderNumber}`}`}
      confirmLabel="Добавить → на кухню"
      kind="add"
      hideHourly={order.orderType === 'saboy' || order.orderType === 'takeaway'}
      onBack={() => ctx.go('orders')}
      onConfirm={async (cart) => {
        try {
          const updated = await api.addItemsToOrder(
            order._id,
            cart.map((c) => ({ foodId: c._id, name: c.name, price: c.price, quantity: c.quantity })),
          );
          ctx.onAddItemsSuccess(updated);
          ctx.go('orders');
        } catch (e) {
          alert(e instanceof Error ? e.message : 'Не удалось добавить блюда');
        }
      }}
    />
  );
}

export function SaboyScreen({ ctx }: { ctx: ScreenCtx }) {
  return (
    <MenuScreen
      title="Новый собой (на вынос)"
      contextLabel="Без стола"
      confirmLabel="Создать собой"
      kind="saboy"
      hideHourly={true}
      onBack={() => ctx.go('orders')}
      onConfirm={async (cart, paymentType) => {
        try {
          const items: SaboyItem[] = cart.map((c) => ({
            _id: c._id,
            name: c.name,
            price: c.price,
            quantity: c.quantity,
            category: c.category,
          }));
          const res = await api.createSaboyOrder(items, paymentType);
          // Optimistic update: backend qaytargan to'liq order'ni darhol
          // Dashboard state'iga qo'shamiz. Reload race'ini chetlab o'tadi.
          if (res.order) ctx.onOrderCreated(res.order);
          alert(`Собой #${res.saboyNumber} создан — ${fmt(res.grandTotal)}`);
          await ctx.reload();
          ctx.go('orders');
        } catch (e) {
          alert(e instanceof Error ? e.message : 'Ошибка создания собой');
        }
      }}
    />
  );
}

// #3b/#5: cashier ONLINE «+ Новый заказ» (dine-in): стол → официант → меню.
type NOTable = { _id: string; title: string; number: number; occupied: boolean; categoryTitle: string };

// Stol raqamini nomdan ajratish (backend'da alohida number YO'Q — hammasi 0).
// "Стол 10" → 10. Shu bilan 1,2,3…10,11,12 to'g'ri tartiblanadi
// (avval matn bo'yicha 1,11,12 bo'lib ketardi).
function noTableNum(t: NOTable): number {
  if (t.number && t.number > 0) return t.number;
  const m = String(t.title || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 1e9;
}

export function NewOrderScreen({ ctx }: { ctx: ScreenCtx }) {
  const [step, setStep] = useState<'table' | 'waiter' | 'menu'>('table');
  const [tables, setTables] = useState<NOTable[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [table, setTable] = useState<NOTable | null>(null);
  const [waiter, setWaiter] = useState<Waiter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTables().catch(() => []), api.getWaiters().catch(() => [])])
      .then(([t, w]) => {
        setTables(t as NOTable[]);
        setWaiters(w as Waiter[]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Stol bandligini AKTIV ORDERLAR'dan aniqlaymiz (manba haqiqat) — online'da
  // VPS /api/tables status/activeOrderId bermasligi mumkin, shuning uchun
  // t.occupied'ga TAYANMAYMIZ. Joriy (to'lanmagan, bekor qilinmagan, blyudoli)
  // dine-in order bo'lsa — stol BAND. Online ham, offline ham bir xil ishlaydi.
  const occ = useMemo(() => {
    const ids = new Set<string>();
    const nums = new Set<number>();
    for (const o of ctx.orders) {
      if (o.orderType === 'saboy') continue;
      if (o.status !== 'active') continue;
      if (!o.items?.some((it) => !it.isCancelled && it.status !== 'cancelled' && !it.isDeleted))
        continue;
      if (o.tableId) ids.add(String(o.tableId));
      if (o.tableNumber) nums.add(Number(o.tableNumber));
    }
    return { ids, nums };
  }, [ctx.orders]);

  if (step === 'menu' && table) {
    return (
      <MenuScreen
        title="Новый заказ"
        contextLabel={`${table.title}${waiter ? ' · ' + waiter.name : ''}`}
        confirmLabel="Создать заказ → кухня"
        kind="add"
        onBack={() => ctx.go('orders')}
        onConfirm={async (cart) => {
          const res = await api.createOrder(
            table._id,
            waiter?._id,
            cart.map((c) => ({ foodId: c._id, name: c.name, price: c.price, quantity: c.quantity })),
            { tableName: table.title, tableNumber: table.number, waiterName: waiter?.name },
          );
          if (res.success) {
            // TEZKOR: optimistik order'ni darhol qo'shib, ekranni DARHOL
            // ochamiz. reload (getActiveShift+getOrders proksi ~sekin) FONDA
            // ishlaydi — avval `await ctx.reload()` butun oqimni ~3s ushlardi.
            if (res.order) ctx.onOrderCreated(res.order);
            ctx.go('orders');
            ctx.reload();
          } else {
            alert('Не удалось создать заказ');
          }
        }}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
      <div
        style={{
          background: T.cta,
          color: '#fff',
          padding: '12px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.4 }}>
          {step === 'table' ? 'НОВЫЙ ЗАКАЗ · ВЫБЕРИТЕ СТОЛ' : `${table?.title} · ВЫБЕРИТЕ ОФИЦИАНТА`}
        </span>
        <button
          onClick={() => (step === 'waiter' ? setStep('table') : ctx.go('orders'))}
          style={{
            padding: '10px 22px',
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.5)',
            fontFamily: T.font,
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          ← Назад
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
        {loading ? (
          <div style={{ color: T.textMuted, padding: 40, textAlign: 'center', fontSize: 16 }}>Загрузка…</div>
        ) : step === 'table' ? (
          tables.length === 0 ? (
            <div style={{ color: T.textMuted, padding: 40, textAlign: 'center', fontSize: 16 }}>
              Столы не найдены
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Array.from(
                tables
                  .reduce((m, t) => {
                    const k = t.categoryTitle || 'Зал';
                    if (!m.has(k)) m.set(k, [] as NOTable[]);
                    m.get(k)!.push(t);
                    return m;
                  }, new Map<string, NOTable[]>())
                  .entries(),
              ).map(([cat, list]) => (
                <div key={cat}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: T.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 10,
                    }}
                  >
                    {cat}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                    {[...list].sort((a, b) => noTableNum(a) - noTableNum(b)).map((t) => {
                      const busy =
                        t.occupied ||
                        occ.ids.has(String(t._id)) ||
                        (!!t.number && occ.nums.has(Number(t.number)));
                      return (
                        <button
                          key={t._id}
                          disabled={busy}
                          onClick={() => {
                            if (busy) return;
                            setTable(t);
                            setStep('waiter');
                          }}
                          style={{
                            background: busy ? T.cancelledBg : T.surface,
                            border: `2px solid ${busy ? T.cancelled : T.borderStrong}`,
                            padding: '18px 16px',
                            cursor: busy ? 'not-allowed' : 'pointer',
                            fontFamily: T.font,
                            textAlign: 'left',
                            opacity: busy ? 0.9 : 1,
                          }}
                        >
                          <div style={{ fontSize: 19, fontWeight: 800, color: busy ? T.cancelled : T.text }}>
                            {t.title}
                          </div>
                          {t.categoryTitle && (
                            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, color: T.textMuted }}>
                              {t.categoryTitle}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              marginTop: 4,
                              color: busy ? T.cancelled : T.ready,
                            }}
                          >
                            {busy ? '● Занят' : '○ Свободен'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : waiters.length === 0 ? (
          <div style={{ color: T.textMuted, padding: 40, textAlign: 'center', fontSize: 16 }}>
            Официанты филиала не найдены
            <div style={{ marginTop: 16 }}>
              <CTA height={56} fontSize={17} onClick={() => setStep('menu')}>
                Продолжить без официанта →
              </CTA>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {waiters.map((w) => (
              <button
                key={w._id}
                onClick={() => {
                  setWaiter(w);
                  setStep('menu');
                }}
                style={{
                  background: T.surface,
                  border: `2px solid ${T.borderStrong}`,
                  padding: '22px 16px',
                  cursor: 'pointer',
                  fontFamily: T.font,
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 19, fontWeight: 800 }}>{w.name}</div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4, fontWeight: 700 }}>
                  {w.phone || ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
