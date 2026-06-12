'use client';

import { useState, useEffect, useMemo } from 'react';
import { Order, PaymentType, PaymentSplit } from '@/types';
import { api } from '@/services/api';
import { T, NavIcon, fmt, fmtN, useCurrency } from '@/lib/theme';
import { Pager, CTA } from '../shell';
import { ScreenCtx } from './types';
import { itemLineTotal, computeHourlyForItem, hasLiveHourly } from '@/utils/hourly';

const calcHourly = (order: Order | null): { hours: number; charge: number } => {
  if (!order || !order.hasHourlyCharge || !order.hourlyChargeAmount || order.hourlyChargeAmount <= 0) {
    return { hours: 0, charge: 0 };
  }
  const diffMs = Date.now() - new Date(order.createdAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const hours = Math.floor(diffHours) + 1;
  return { hours, charge: hours * order.hourlyChargeAmount };
};

export function PaymentScreen({ ctx }: { ctx: ScreenCtx }) {
  const order = ctx.currentOrder;

  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payType, setPayType] = useState<PaymentType>('cash');
  const [split, setSplit] = useState<PaymentSplit>({ cash: 0, card: 0, click: 0, cashback: 0 });
  // KESHBEK (modul yoqiq bo'lsa): СМЕШАННАЯ ichida balansdan to'lash. Spend FAQAT
  // ONLINE — balans tekshiruvi global'dan; offline'da server aniq xato qaytaradi.
  const [kb, setKb] = useState<{ enabled: boolean; percent: number }>({ enabled: false, percent: 0 });
  const [kbPhone, setKbPhone] = useState('');
  const [kbBalance, setKbBalance] = useState<number | null>(null);
  const [kbBusy, setKbBusy] = useState(false);
  const [kbErr, setKbErr] = useState('');
  // Keshbek yetmaganda qolgan summa: false — bitta usul (tez tugma), true — qo'lda bo'lish
  const [kbManual, setKbManual] = useState(false);
  const [itemPage, setItemPage] = useState(1);
  const [busy, setBusy] = useState(false);
  // #15: наличные — «Получено» (введённая клиентом сумма) + «Сдача»
  const [received, setReceived] = useState<number | null>(null);
  const [padBuf, setPadBuf] = useState<string | null>(null); // null = пэд скрыт
  // #2: shu order uchun chegирма tugmasi (backendga PATCH → qayta hisob)
  const [discOpen, setDiscOpen] = useState(false);
  const [chgBusy, setChgBusy] = useState(false);
  // Filial sozlamasi (услуга on/off + %) — order'da stamp bo'lmagan
  // (yaratilgan, to'lanmagan) order uchun OLDINDAN ko'rsatish. Backend
  // to'lov payti AYNAN shu filial %ini stamp qiladi → divergensiya yo'q.
  const [brSvcEn, setBrSvcEn] = useState(false);
  const [brSvcPct, setBrSvcPct] = useState(0);
  const [brDiscPct, setBrDiscPct] = useState(0);
  // Telefon prefiksi — filial valyutasidan (₸=KZ → +7, сум=UZ → +998). Ekran
  // klaviaturasida '+' yo'q, shuning uchun prefiks AVTOMATIK — kassir faqat raqam yozadi.
  const dialPrefix = useCurrency() === 'сум' ? '+998' : '+7';

  const allItems = useMemo(
    () => (order ? order.items.filter((i) => i.status !== 'cancelled' && !i.isDeleted) : []),
    [order],
  );
  const unpaidItems = useMemo(() => allItems.filter((i) => !i.isPaid), [allItems]);
  const paidItems = useMemo(() => allItems.filter((i) => i.isPaid), [allItems]);

  useEffect(() => {
    if (order) {
      setMode('full');
      setSelected(new Set(unpaidItems.map((i) => i._id)));
      setPayType('cash');
      setSplit({ cash: 0, card: 0, click: 0, cashback: 0 });
      setKbPhone('');
      setKbBalance(null);
      setKbErr('');
      setKbManual(false);
      setItemPage(1);
      setReceived(null);
      setPadBuf(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?._id]);

  // Soatlik item bo'lsa — har 30s re-render, summa JONLI o'sib tursin.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!order || !hasLiveHourly(order.items)) return;
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, [order]);

  useEffect(() => {
    if (!order) ctx.go('orders');
  }, [order, ctx]);

  useEffect(() => {
    api.keshbekStatus().then(setKb).catch(() => {});
  }, []);

  // Partial rejimga o'tilsa keshbek qismi tozalanadi. MUHIM: bu hook
  // `if (!order) return null` dan OLDIN turishi shart (hooklar tartibi buzilmasin).
  useEffect(() => {
    if (mode === 'partial') {
      setSplit((s) => ((s.cashback || 0) > 0 ? { ...s, cashback: 0 } : s));
    }
  }, [mode]);

  // Usul almashganda split TOZALANADI. Aks holda КЕШБЭК'da tekshirilgan balans/summa
  // (split.cashback) СМЕШАННАЯ'ga "sizib" o'tib, ko'rinmas holda mijoz keshbek
  // balansidan JIMGINA yechilardi (review HIGH). Har usul toza boshlanadi.
  // MUHIM: bu hook `if (!order) return null` dan OLDIN (hooklar tartibi buzilmasin).
  useEffect(() => {
    setSplit({ cash: 0, card: 0, click: 0, cashback: 0 });
    setKbManual(false);
    setKbBalance(null);
    setKbErr('');
  }, [payType]);

  useEffect(() => {
    let alive = true;
    api
      .getRestaurantSettings()
      .then((s) => {
        if (!alive) return;
        setBrSvcEn(s.serviceChargeEnabled === true);
        setBrSvcPct(Number(s.serviceChargePercent || 0));
        setBrDiscPct(Number(s.discountPercent || 0));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!order) return null;

  const allPaid = unpaidItems.length === 0;

  const selectedItems = unpaidItems.filter((i) => selected.has(i._id));
  const itemsToPay = mode === 'full' ? unpaidItems : selectedItems;
  // Soatlik item'lar (PlayStation/bilyard) DAQIQALI hisoblanadi — 0 emas.
  const subtotal = itemsToPay.reduce((s, i) => s + itemLineTotal(i), 0);
  const { hours, charge } = calcHourly(order);
  const hourly = mode === 'full' ? charge : 0;
  // #1/#2: услуга/chegирма. Order'da STAMP bo'lsa (backend allaqachon
  // hisoblagan) — o'shani ko'rsatamiz. STAMP yo'q (yaratilgan, to'lanmagan
  // eski order) bo'lsa — FILIAL sozlamasidan OLDINDAN ko'rsatamiz; backend
  // to'lov payti AYNAN shu filial %ini stamp qiladi (db6be06) → bir xil.
  const oSvcPct = Number((order as { serviceChargePercent?: number }).serviceChargePercent || 0);
  const oDiscPct = Number((order as { discountPercent?: number }).discountPercent || 0);
  const oSvc = Number((order as { serviceCharge?: number }).serviceCharge || 0);
  const oDisc = Number((order as { discount?: number }).discount || 0);
  // Услуга = STOL XIZMATI → saboy/takeaway uchun UMUMAN yo'q (backend bilan bir xil).
  const isDineIn = order.orderType !== 'saboy' && order.orderType !== 'takeaway';
  // QISMAN TO'LANGAN order: server услуга/chegirmani WAIVE qilgan (pay-items
  // shartnomasi) — filial %' fallback'i qayta qo'shilsa mijozdan ortiqcha olinadi
  // yoki mixed to'lov server bilan hech qachon mos kelmaydi (deadlock).
  const partialFlow = order.paymentStatus === 'partiallyPaid';
  const svcPct = !isDineIn || partialFlow ? 0 : oSvcPct > 0 ? oSvcPct : brSvcEn ? brSvcPct : 0;
  const discPct = partialFlow ? 0 : oDiscPct > 0 ? oDiscPct : brDiscPct;
  const serviceFee =
    mode !== 'full' || !isDineIn
      ? 0
      : oSvc > 0
        ? oSvc
        : svcPct > 0
          ? Math.round(subtotal * (svcPct / 100))
          : 0;
  // Skidka USLUGA QO'SHILGAN summadan hisoblanadi (backend order-calc bilan bir xil):
  // base = subtotal + service → discount = base × disc%. Mas. (2900+1450)×10% = 435.
  const discountAmt =
    mode !== 'full'
      ? 0
      : oDisc > 0
        ? oDisc
        : discPct > 0
          ? Math.round((subtotal + serviceFee) * (discPct / 100))
          : 0;
  const grandTotal = subtotal + hourly + serviceFee - discountAmt;
  const paidTotal = paidItems.reduce((s, i) => s + itemLineTotal(i), 0);

  const splitSum = split.cash + split.card + split.click + (split.cashback || 0);
  const splitRemaining = grandTotal - splitSum;

  const ITEMS_PER_PAGE = 5;
  const totalItemPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));
  const curPage = Math.min(itemPage, totalItemPages);
  const visibleItems = allItems.slice((curPage - 1) * ITEMS_PER_PAGE, curPage * ITEMS_PER_PAGE);

  const toggleItem = (id: string) => {
    if (mode !== 'partial') return;
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // mixed VA cashback — ikkalasi ham split bilan ishlaydi (qoldiq nolga yaqin bo'lsin)
  const splitMode = payType === 'mixed' || payType === 'cashback';
  const kbUsed = splitMode ? split.cashback || 0 : 0;
  const isValid =
    (mode === 'full' || selectedItems.length > 0) &&
    (!splitMode || Math.abs(splitRemaining) < 100) &&
    // KESHBEK: balansdan to'lansa (kbUsed>0) — tekshirilgan, oshmagan, telefon to'liq
    (kbUsed <= 0 || (kbBalance != null && kbUsed <= kbBalance && kbPhone.length >= 9)) &&
    // Кешбэк usuli: balans TEKSHIRILGAN bo'lsin (0 bo'lsa ham — qolgani naqd/karta/
    // perevod bilan to'lanadi; balansdan to'lov MAJBURIY EMAS).
    (payType !== 'cashback' || kbBalance != null) &&
    // Naqd: "Получено" summasi to'liq summadan KAM bo'lsa to'lash MUMKIN EMAS
    // (foydalanuvchi talabi: kam summa o'tib ketmasin). received >= grandTotal shart.
    (payType !== 'cash' || (received !== null && received >= grandTotal));

  // KESHBEK — telefon orqali balansni tekshirish (faqat online; offline → aniq xato).
  // Balansdan to'lov avto: cashback = min(balans, summa), qolgani naqdga (almashsa bo'ladi).
  const checkKbBalance = async () => {
    if (kbBusy || kbPhone.length < 9) return;
    setKbBusy(true);
    setKbErr('');
    try {
      const d = await api.keshbekBalance(dialPrefix + kbPhone);
      const bal = d.balance || 0;
      setKbBalance(bal);
      const cb = Math.min(bal, grandTotal);
      setSplit({ cash: Math.max(0, grandTotal - cb), card: 0, click: 0, cashback: cb });
      setKbManual(false);
    } catch (e) {
      setKbBalance(null);
      setKbErr(e instanceof Error ? e.message : 'Не удалось проверить баланс');
    } finally {
      setKbBusy(false);
    }
  };

  // Keshbekdan keyingi qoldiqni bitta usulga yo'naltirish (naqd/karta/perevod)
  const assignRemainder = (bucket: 'cash' | 'card' | 'click') => {
    setSplit((s) => {
      const cb = s.cashback || 0;
      const rem = Math.max(0, grandTotal - cb);
      return { cash: bucket === 'cash' ? rem : 0, card: bucket === 'card' ? rem : 0, click: bucket === 'click' ? rem : 0, cashback: cb };
    });
    setKbManual(false);
  };

  const confirm = async () => {
    if (!isValid || busy) return;
    setBusy(true);
    try {
      // cashback usuli backend'ga 'mixed' bo'lib boradi (split.cashback + qolgani).
      // HIMOYA: cashback FAQAT 'cashback' usulida yuboriladi — mixed'da hech qachon
      // (backend faqat shu split.cashback'ga qarab balansdan yechadi).
      const cbToSend = payType === 'cashback' ? split.cashback || 0 : 0;
      let paymentType: PaymentType = splitMode ? 'mixed' : payType;
      let splitArg = splitMode
        ? { ...split, cashback: cbToSend, cashbackPhone: cbToSend > 0 ? dialPrefix + kbPhone : undefined }
        : undefined;
      // Keshbek tanlangan-u balansdan to'lov yo'q (balans 0) + qolgani BITTA usul
      // bilan to'liq to'langan bo'lsa — 'mixed' emas, o'sha toza usul yoziladi.
      if (payType === 'cashback' && cbToSend === 0) {
        const active = (['cash', 'card', 'click'] as const).filter((k) => (split[k] || 0) > 0);
        if (active.length === 1) {
          paymentType = active[0];
          splitArg = undefined;
        }
      }
      if (mode === 'partial') {
        await ctx.onPartialPay(order._id, Array.from(selected), paymentType, splitArg, undefined);
      } else {
        await ctx.onPay(order._id, paymentType, splitArg, undefined);
      }
      ctx.go('orders');
    } catch {
      /* handled in orchestrator (alert) */
    } finally {
      setBusy(false);
    }
  };

  const methods: { id: PaymentType; label: string; sub: string; color: string; bg: string; wide?: boolean }[] = [
    { id: 'cash', label: 'НАЛИЧНЫЕ', sub: 'Сом / тенге', color: T.ready, bg: T.readyBg },
    { id: 'card', label: 'КАРТА', sub: 'Банковская карта', color: T.served, bg: T.servedBg },
    { id: 'click', label: 'ПЕРЕВОД', sub: 'На счёт', color: T.cta, bg: '#f8d9c0' },
    { id: 'mixed', label: 'СМЕШАННАЯ', sub: 'Несколько', color: T.preparing, bg: T.preparingBg },
    // KESHBEK — alohida usul, FAQAT modul yoqiq bo'lsa (faqat online ishlaydi)
    ...(kb.enabled
      ? [{ id: 'cashback' as PaymentType, label: 'КЕШБЭК', sub: 'С баланса гостя', color: '#7c3aed', bg: '#ede9fe', wide: true }]
      : []),
  ];

  if (allPaid) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: T.bg,
          gap: 20,
        }}
      >
        <NavIcon kind="check" color={T.paid} size={64} />
        <div style={{ fontSize: 26, fontWeight: 900, color: T.paid }}>Заказ полностью оплачен</div>
        <CTA fullWidth={false} height={64} fontSize={20} onClick={() => ctx.go('orders')}>
          <NavIcon kind="chevronLeft" color="#fff" /> К заказам
        </CTA>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
      {/* Sub-header */}
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
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.4 }}>ПРИЁМ ОПЛАТЫ</span>
          <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', fontSize: 17, fontWeight: 800 }}>
            {order.orderType === 'saboy' ? 'Собой' : order.tableName}
          </span>
          <span style={{ fontSize: 16, opacity: 0.9 }}>
            {order.isOffline ? 'Офлайн' : `№${order.orderNumber}`} · {order.waiter.name}
          </span>
        </div>
        <button
          onClick={() => ctx.go('orders')}
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
          <NavIcon kind="chevronLeft" color="#fff" /> К заказам
        </button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 540px', overflow: 'hidden' }}>
        {/* LEFT — items */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              borderBottom: `1px solid ${T.border}`,
              background: T.surface,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: 800,
                color: T.textMuted,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Что оплачиваем · {itemsToPay.length} из {unpaidItems.length} блюд
            </div>
            <div style={{ display: 'flex', border: `2px solid ${T.borderStrong}` }}>
              {(['full', 'partial'] as const).map((m, i) => {
                const a = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      if (m === 'full') setSelected(new Set(unpaidItems.map((x) => x._id)));
                    }}
                    style={{
                      height: 52,
                      padding: '0 22px',
                      background: a ? T.borderStrong : T.surface,
                      color: a ? '#fff' : T.text,
                      border: 'none',
                      borderRight: i === 0 ? `2px solid ${T.borderStrong}` : 'none',
                      fontFamily: T.font,
                      fontSize: 16,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {m === 'full' ? 'Полная оплата' : 'Выбрать блюда'}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div
              style={{
                flex: 1,
                padding: 14,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {visibleItems.map((it) => {
                const isPaid = it.isPaid;
                const isSel = selected.has(it._id);
                const canSelect = !isPaid && mode === 'partial';
                // Soatlik item — DAQIQALI hisoblangan summa (0 emas).
                const hcalc = it.isHourly ? computeHourlyForItem(it, Date.now()) : null;
                const amount = it.isHourly ? hcalc!.amount : it.price * it.quantity;
                return (
                  <div
                    key={it._id}
                    onClick={() => canSelect && toggleItem(it._id)}
                    style={{
                      background: isPaid ? T.paidBg : mode === 'partial' && isSel ? '#fff5ed' : T.surface,
                      border: isPaid
                        ? `2px solid ${T.paid}`
                        : mode === 'partial' && isSel
                          ? `3px solid ${T.cta}`
                          : `2px solid ${T.border}`,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: canSelect ? 'pointer' : 'default',
                      opacity: isPaid ? 0.7 : 1,
                      textDecoration: isPaid ? 'line-through' : 'none',
                    }}
                  >
                    {mode === 'partial' && !isPaid && (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          border: `2px solid ${isSel ? T.cta : T.borderStrong}`,
                          background: isSel ? T.cta : T.surface,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSel && <NavIcon kind="check" color="#fff" size={20} />}
                      </div>
                    )}
                    {isPaid && (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          background: T.paid,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <NavIcon kind="check" color="#fff" size={20} />
                      </div>
                    )}
                    <div
                      style={{
                        background: T.panel,
                        padding: '6px 12px',
                        fontSize: 17,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: 56,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {it.quantity}×
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 19,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {it.name}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: T.textMuted,
                          marginTop: 3,
                          display: 'flex',
                          gap: 10,
                        }}
                      >
                        <span>
                          {it.isHourly
                            ? `${fmt(it.hourlyPrice || 0)}/ч · ${Math.floor((hcalc!.totalMinutes || 0) / 60)}ч ${(hcalc!.totalMinutes || 0) % 60}мин`
                            : `${fmt(it.price)} × ${it.quantity}`}
                        </span>
                        {isPaid && <span style={{ color: T.paid, fontWeight: 800 }}>ОПЛАЧЕНО</span>}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                    >
                      {fmt(amount)}
                    </div>
                  </div>
                );
              })}
            </div>
            {totalItemPages > 1 && (
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
                  total={totalItemPages}
                  onPrev={() => setItemPage(Math.max(1, curPage - 1))}
                  onNext={() => setItemPage(Math.min(totalItemPages, curPage + 1))}
                />
              </div>
            )}
          </div>

          <div
            style={{
              background: T.surface,
              borderTop: `2px solid ${T.borderStrong}`,
              padding: '14px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              flexShrink: 0,
            }}
          >
            {paidItems.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                  color: T.paid,
                  fontWeight: 700,
                }}
              >
                <span>Уже оплачено ({paidItems.length} блюд)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', textDecoration: 'line-through' }}>
                  {fmt(paidTotal)}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                color: T.textMuted,
              }}
            >
              <span>Подытог · {itemsToPay.length} блюд</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(subtotal)}</span>
            </div>
            {hourly > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                  color: T.hourly,
                  fontWeight: 700,
                }}
              >
                <span>● Время ({hours} ч)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(hourly)}</span>
              </div>
            )}
            {serviceFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: T.textMuted }}>
                <span>Услуга{svcPct > 0 ? ` (${svcPct}%)` : ''}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>+{fmt(serviceFee)}</span>
              </div>
            )}
            {discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: T.ready, fontWeight: 700 }}>
                <span>Скидка{discPct > 0 ? ` (${discPct}%)` : ''}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>-{fmt(discountAmt)}</span>
              </div>
            )}
            {mode === 'full' && (
              <button
                onClick={() => !chgBusy && setDiscOpen(true)}
                style={{
                  marginTop: 4,
                  height: 40,
                  background: discountAmt > 0 ? T.ready : T.panel,
                  color: discountAmt > 0 ? '#fff' : T.text,
                  border: `1px solid ${discountAmt > 0 ? T.ready : T.borderStrong}`,
                  fontFamily: T.font,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {discountAmt > 0 ? `Скидка ${discPct}% — изменить` : '+ Добавить скидку'}
              </button>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: `2px solid ${T.borderStrong}`,
                marginTop: 6,
                paddingTop: 8,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                К оплате
              </span>
              <span
                style={{
                  fontSize: 38,
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  color: T.cta,
                }}
              >
                {fmt(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — methods + entry */}
        <div
          style={{
            background: T.panel,
            borderLeft: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            padding: 10,
            gap: 8,
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
            Способ оплаты
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {methods.map((m) => {
              const a = m.id === payType;
              return (
                <button
                  key={m.id}
                  onClick={() => setPayType(m.id)}
                  style={{
                    padding: '10px 14px',
                    background: a ? m.color : m.bg,
                    color: a ? '#fff' : m.color,
                    border: `2px solid ${a ? m.color : 'transparent'}`,
                    fontFamily: T.font,
                    textAlign: 'left',
                    cursor: 'pointer',
                    gridColumn: m.wide ? '1 / -1' : undefined,
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{m.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, fontWeight: 700 }}>{m.sub}</div>
                </button>
              );
            })}
          </div>

          {payType === 'cash' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 16,
                background: T.readyBg,
                overflow: 'hidden',
              }}
            >
              <div style={{ background: T.surface, border: `2px solid ${T.border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.textMuted }}>К ОПЛАТЕ</span>
                <span style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</span>
              </div>

              <div style={{ background: T.surface, border: `2px solid ${T.borderStrong}`, padding: '16px 18px', textAlign: 'right', fontSize: 32, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(received ?? 0)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[200, 500, 1000, 2000, 5000, 10000, 20000].map((d) => (
                  <button
                    key={d}
                    onClick={() => setReceived((r) => (r ?? 0) + d)}
                    style={{ height: 56, background: T.surface, border: `1px solid ${T.border}`, fontFamily: T.font, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
                  >
                    +{d.toLocaleString('ru-RU')}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setReceived(null)}
                  style={{ flex: 1, height: 50, background: T.cancelledBg, color: T.cancelled, border: 'none', fontFamily: T.font, fontSize: 16, fontWeight: 800, letterSpacing: 0.4, cursor: 'pointer' }}
                >
                  Сбросить
                </button>
                <button
                  onClick={() => setPadBuf(received != null ? String(received) : '')}
                  style={{ flex: 1, height: 50, background: T.surface, border: `2px solid ${T.borderStrong}`, fontFamily: T.font, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
                >
                  + Другая сумма
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 8 }} />

              <div
                style={{
                  background: received != null && received > grandTotal ? T.readyBg : received != null && received < grandTotal ? T.cancelledBg : T.panelStrong,
                  color: received != null && received > grandTotal ? T.ready : received != null && received < grandTotal ? T.cancelled : T.textMuted,
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                <span>
                  {received == null
                    ? 'Введите сумму'
                    : received > grandTotal
                      ? 'Сдача'
                      : received < grandTotal
                        ? 'Не хватает'
                        : 'Сумма совпадает'}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 30 }}>
                  {received == null
                    ? '—'
                    : received > grandTotal
                      ? fmt(received - grandTotal)
                      : received < grandTotal
                        ? fmt(grandTotal - received)
                        : '✓'}
                </span>
              </div>
            </div>
          )}

          {/* Suzuvchi (floating) custom-summa klaviaturasi — pastdan EMAS */}
          {padBuf !== null && (
            <div
              onClick={() => setPadBuf(null)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100000,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 340,
                  background: T.surface,
                  border: `2px solid ${T.borderStrong}`,
                  boxShadow: '0 14px 44px rgba(0,0,0,0.35)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Другая сумма
                </div>
                <div style={{ background: T.panel, border: `2px solid ${T.borderStrong}`, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 14px', fontSize: 26, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                  {padBuf === '' ? '0' : Number(padBuf).toLocaleString('ru-RU')} ₸
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((k) => (
                    <button
                      key={k}
                      onClick={() =>
                        setPadBuf((b) => {
                          const cur = b ?? '';
                          if (k === '⌫') return cur.slice(0, -1);
                          const next = (cur + k).replace(/^0+(?=\d)/, '');
                          return next.length > 9 ? cur : next;
                        })
                      }
                      style={{
                        height: 60,
                        background: k === '⌫' ? T.panelStrong : T.panel,
                        border: `2px solid ${T.border}`,
                        fontFamily: T.font,
                        fontSize: 24,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setPadBuf(null)}
                    style={{ flex: 1, height: 52, background: T.surface, border: `2px solid ${T.borderStrong}`, fontFamily: T.font, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      const v = Number(padBuf);
                      setReceived(Number.isFinite(v) && v > 0 ? v : null);
                      setPadBuf(null);
                    }}
                    style={{ flex: 2, height: 52, background: T.cta, color: '#fff', border: 'none', fontFamily: T.font, fontSize: 16, fontWeight: 900, cursor: 'pointer' }}
                  >
                    Готово
                  </button>
                </div>
              </div>
            </div>
          )}
          {payType === 'card' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                background: T.servedBg,
              }}
            >
              <NavIcon kind="pos" color={T.served} size={40} />
              <div style={{ fontSize: 20, fontWeight: 800, color: T.served, textAlign: 'center' }}>
                Передайте терминалу
                <br />
                оплату по карте
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: T.served,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(grandTotal)}
              </div>
            </div>
          )}
          {payType === 'click' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                background: '#f8d9c0',
              }}
            >
              <NavIcon kind="money" color={T.cta} size={40} />
              <div style={{ fontSize: 20, fontWeight: 800, color: T.cta, textAlign: 'center' }}>
                Принять перевод на счёт
                <br />
                ресторана
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: T.cta,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(grandTotal)}
              </div>
            </div>
          )}
          {payType === 'mixed' && (
            <div style={{ background: T.preparingBg, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['cash', 'card', 'click'] as const).map((k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 90, fontSize: 15, fontWeight: 800 }}>
                    {k === 'cash' ? 'Наличные' : k === 'card' ? 'Карта' : 'Перевод'}
                  </div>
                  <input
                    inputMode="numeric"
                    value={split[k] > 0 ? fmtN(split[k]) : ''}
                    onChange={(e) =>
                      setSplit((s) => ({ ...s, [k]: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))
                    }
                    placeholder="0"
                    style={{
                      flex: 1,
                      height: 44,
                      padding: '0 12px',
                      background: T.surface,
                      border: `2px solid ${T.borderStrong}`,
                      fontSize: 18,
                      fontFamily: T.font,
                      fontWeight: 800,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* КЕШБЭК — alohida usul: telefon → balans → balansdan to'lov, qolgani naqd/karta/perevod */}
          {payType === 'cashback' && (
            <div style={{ background: '#f3eefb', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.4 }}>
                КЕШБЭК <span style={{ fontWeight: 600, color: T.textMuted }}>(только онлайн)</span>
              </div>
              {mode !== 'full' ? (
                <div style={{ background: T.surface, padding: '12px 14px', fontSize: 14, fontWeight: 700, color: T.textMuted }}>
                  Кешбэком оплачивается только полная сумма заказа.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* Prefiks AVTOMATIK (filial davlati) — kassir faqat lokal raqam yozadi */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', border: `2px solid ${T.borderStrong}`, background: T.surface }}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: T.panel, fontSize: 18, fontWeight: 900, borderRight: `2px solid ${T.borderStrong}`, whiteSpace: 'nowrap' }}>
                        {dialPrefix}
                      </div>
                      <input
                        inputMode="tel"
                        value={kbPhone}
                        onChange={(e) => {
                          setKbPhone(e.target.value.replace(/\D/g, ''));
                          setKbBalance(null);
                          setKbErr('');
                        }}
                        placeholder={dialPrefix === '+998' ? '90 123 45 67' : '700 123 45 67'}
                        style={{ flex: 1, minWidth: 0, height: 48, padding: '0 12px', background: 'transparent', border: 'none', outline: 'none', fontSize: 18, fontFamily: T.font, fontWeight: 800 }}
                      />
                    </div>
                    <button
                      onClick={checkKbBalance}
                      disabled={kbBusy || kbPhone.length < 9}
                      style={{ height: 48, padding: '0 18px', background: '#7c3aed', color: '#fff', border: 'none', fontFamily: T.font, fontSize: 15, fontWeight: 900, cursor: 'pointer', opacity: kbBusy || kbPhone.length < 9 ? 0.5 : 1 }}
                    >
                      {kbBusy ? '…' : 'Проверить'}
                    </button>
                  </div>
                  {kbErr && (
                    <div style={{ background: T.cancelledBg, color: T.cancelled, padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>{kbErr}</div>
                  )}
                  {kbBalance != null && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800 }}>
                        <span style={{ color: T.textMuted }}>Баланс гостя</span>
                        <span style={{ color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>{fmt(kbBalance)}</span>
                      </div>
                      {kbBalance > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ minWidth: 130, fontSize: 14, fontWeight: 800 }}>Списать кешбэком</div>
                          <input
                            inputMode="numeric"
                            value={(split.cashback || 0) > 0 ? fmtN(split.cashback || 0) : ''}
                            onChange={(e) => {
                              const v = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                              setSplit((s) => {
                                const cb = Math.min(v, kbBalance, grandTotal);
                                return kbManual
                                  ? { ...s, cashback: cb }
                                  : { cash: Math.max(0, grandTotal - cb), card: 0, click: 0, cashback: cb };
                              });
                            }}
                            placeholder="0"
                            style={{ flex: 1, height: 48, padding: '0 12px', background: T.surface, border: `2px solid ${T.borderStrong}`, fontSize: 18, fontFamily: T.font, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                      ) : (
                        <div style={{ background: T.surface, padding: '10px 12px', fontSize: 13, fontWeight: 700, color: T.textMuted }}>
                          У гостя нет кешбэка — оплатите другим способом ниже.
                        </div>
                      )}
                      {grandTotal - (split.cashback || 0) > 0 && (
                        <div style={{ borderTop: `2px dashed ${T.border}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: T.textMuted }}>
                            Остаток {fmt(grandTotal - (split.cashback || 0))} — чем доплатить?
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                            {([
                              { k: 'cash', label: 'Наличные' },
                              { k: 'card', label: 'Карта' },
                              { k: 'click', label: 'Перевод' },
                            ] as const).map(({ k, label }) => {
                              const active = !kbManual && split[k] > 0;
                              return (
                                <button
                                  key={k}
                                  onClick={() => assignRemainder(k)}
                                  style={{ height: 42, background: active ? T.cta : T.surface, color: active ? '#fff' : T.text, border: `2px solid ${active ? T.cta : T.borderStrong}`, fontFamily: T.font, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setKbManual(true)}
                              style={{ height: 42, background: kbManual ? T.cta : T.surface, color: kbManual ? '#fff' : T.text, border: `2px solid ${kbManual ? T.cta : T.borderStrong}`, fontFamily: T.font, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                            >
                              Разделить
                            </button>
                          </div>
                          {kbManual &&
                            (['cash', 'card', 'click'] as const).map((k) => (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ minWidth: 90, fontSize: 14, fontWeight: 800 }}>
                                  {k === 'cash' ? 'Наличные' : k === 'card' ? 'Карта' : 'Перевод'}
                                </div>
                                <input
                                  inputMode="numeric"
                                  value={split[k] > 0 ? fmtN(split[k]) : ''}
                                  onChange={(e) => setSplit((s) => ({ ...s, [k]: parseInt(e.target.value.replace(/\D/g, '')) || 0 }))}
                                  placeholder="0"
                                  style={{ flex: 1, height: 44, padding: '0 12px', background: T.surface, border: `2px solid ${T.borderStrong}`, fontSize: 18, fontFamily: T.font, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                                />
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {splitMode && <div style={{ flex: 1 }} />}

          {splitMode && (
            <div
              style={{
                background: Math.abs(splitRemaining) < 100 ? T.readyBg : T.cancelledBg,
                color: Math.abs(splitRemaining) < 100 ? T.ready : T.cancelled,
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              <span>Остаток</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 26 }}>{fmt(splitRemaining)}</span>
            </div>
          )}

          <CTA height={76} fontSize={22} onClick={confirm} disabled={!isValid || busy}>
            <NavIcon kind="check" color="#fff" /> {busy ? 'ОБРАБОТКА…' : 'ПОДТВЕРДИТЬ ОПЛАТУ'}
          </CTA>
        </div>
      </div>

      {discOpen && (
        <div
          onClick={() => !chgBusy && setDiscOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
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
              {order.tableName} · сохраняется на сервере (виден в чеке и админке)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[0, 5, 10, 15, 20, 25, 30, 50].map((p) => {
                const active = discPct === p;
                return (
                  <button
                    key={p}
                    disabled={chgBusy}
                    onClick={async () => {
                      setChgBusy(true);
                      try {
                        await api.setOrderDiscount(order._id, p);
                        await ctx.reload();
                        setDiscOpen(false);
                      } catch {
                        alert('Не удалось применить скидку');
                      } finally {
                        setChgBusy(false);
                      }
                    }}
                    style={{
                      height: 64,
                      background: active ? T.ready : T.panel,
                      color: active ? '#fff' : T.text,
                      border: `2px solid ${active ? T.ready : T.border}`,
                      fontFamily: T.font,
                      fontSize: 20,
                      fontWeight: 900,
                      cursor: chgBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {p === 0 ? 'Нет' : `${p}%`}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => !chgBusy && setDiscOpen(false)}
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
    </div>
  );
}
