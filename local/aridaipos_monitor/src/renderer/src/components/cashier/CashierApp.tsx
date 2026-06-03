'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { api, getSyncStatus } from '@/services/api';
import { PrinterAPI } from '@/services/printer';
import { Order, DailySummary, PaymentType, PaymentSplit, PartialPaymentResult, Shift } from '@/types';
import { itemLineTotal } from '@/utils/hourly';
import { T } from '@/lib/theme';
import { Header, SideNav, Screen } from './shell';
import { Numpad } from './Numpad';
import { ScreenCtx } from './screens/types';
import { ShiftOpenScreen } from './screens/ShiftOpen';
import { ShiftCloseScreen } from './screens/ShiftClose';
import { DashboardScreen } from './screens/Dashboard';
import { OrderDetailScreen } from './screens/OrderDetail';
import { PaymentScreen } from './screens/Payment';
import { AddItemsScreen, SaboyScreen, NewOrderScreen } from './screens/Menu';
import { ReportsScreen } from './screens/Reports';
import { SettingsScreen } from './screens/Settings';
import { ExpensesScreen } from './screens/Expenses';
import { AdvancesScreen } from './screens/Advances';

// Realtime socket — LOKAL serverga (aridaipos_server, localhost:4561) yoki
// Settings'dagi hub-url (boshqa PC'dagi server IP). Kepket VPS'ga ULANMAYDI.
// Server offline bo'lsa socket ulanmaydi (xato bermay, POS polling bilan ishlaydi).
const readStoredHubUrl = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return (window.localStorage?.getItem('hub-url') || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
};
const API_URL =
  (typeof window !== 'undefined' &&
    (window as unknown as { __API_BASE__?: string }).__API_BASE__) ||
  readStoredHubUrl() ||
  'http://localhost:4561';

const EMPTY_SUMMARY: DailySummary = {
  totalRevenue: 0,
  totalOrders: 0,
  cashRevenue: 0,
  cardRevenue: 0,
  clickRevenue: 0,
  activeOrders: 0,
  paidOrders: 0,
  cashExpenses: 0,
  clickExpenses: 0,
  availableCash: 0,
  availableClick: 0,
};

// Чек оплаты: собирает данные из заказа и печатает через Local Server.
// silent=true — авто-печать после оплаты (без alert при отсутствии блюд).
async function printOrderReceipt(
  order: Order,
  restaurantName: string,
  silent: boolean,
  br: { en: boolean; pct: number; disc: number },
) {
  const isFullyPaid = order.paymentStatus === 'paid';
  const itemsForPrint = order.items.filter((item) => {
    if (item.status === 'cancelled' || item.isCancelled) return false;
    if (item.isDeleted) return false;
    if (isFullyPaid) return true;
    return item.isPaid !== true;
  });
  if (itemsForPrint.length === 0) {
    if (!silent) alert('Нет блюд для печати — все позиции уже оплачены или отменены.');
    return;
  }
  // Soatlik item — DAQIQALI hisoblangan summa (chekda 0 emas, real narx).
  const printSubtotal = itemsForPrint.reduce((s, i) => s + itemLineTotal(i), 0);
  let hourlyCharge = 0;
  let hourlyHours = 0;
  if (!isFullyPaid && order.hasHourlyCharge && order.hourlyChargeAmount && order.hourlyChargeAmount > 0) {
    const diffH = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
    hourlyHours = Math.floor(diffH) + 1;
    hourlyCharge = hourlyHours * order.hourlyChargeAmount;
  } else if (isFullyPaid) {
    hourlyCharge = order.hourlyCharge || 0;
    hourlyHours = order.hourlyChargeHours || 0;
  }
  // #1/#2: услуга% / chegirma%. To'langan order — backend hisoblagan
  // qiymat (AYNAN). To'lanmagan/prechek — order'da % bo'lsa o'sha,
  // bo'lmasa FILIAL sozlamasi (xizmat yoqilgandan OLDIN yaratilgan
  // orderlarga ham услуга qo'shilsin — backend ham to'lovda shunday qiladi).
  const oSvc = Number((order as { serviceCharge?: number }).serviceCharge || 0);
  const oSvcP = Number((order as { serviceChargePercent?: number }).serviceChargePercent || 0);
  const oDisc = Number((order as { discount?: number }).discount || 0);
  const oDiscP = Number((order as { discountPercent?: number }).discountPercent || 0);
  // Услуга = STOL XIZMATI → saboy/takeaway uchun UMUMAN yo'q (backend bilan bir xil).
  const isDineIn = order.orderType !== 'saboy' && order.orderType !== 'takeaway';
  const eSvcP = !isDineIn ? 0 : oSvcP > 0 ? oSvcP : br.en ? br.pct : 0;
  const eDiscP = oDiscP > 0 ? oDiscP : br.disc > 0 ? br.disc : 0;
  const _svcP = eSvcP;
  const _discP = eDiscP;
  const _svcFee = !isDineIn
    ? 0
    : isFullyPaid && oSvc > 0
      ? oSvc
      : eSvcP > 0
        ? Math.round(printSubtotal * (eSvcP / 100))
        : 0;
  const _discAmt =
    isFullyPaid && oDisc > 0 ? oDisc : eDiscP > 0 ? Math.round(printSubtotal * (eDiscP / 100)) : 0;
  try {
    const result = await PrinterAPI.printPayment({
      orderId: order._id,
      orderNumber: order.orderNumber,
      tableName: order.tableName,
      waiterName: order.waiter.name,
      items: itemsForPrint.map((i) =>
        i.isHourly
          ? { name: i.name, quantity: 1, price: itemLineTotal(i) }
          : { name: i.name, quantity: i.quantity, price: i.price },
      ),
      subtotal: printSubtotal,
      serviceFee: _svcFee,
      serviceFeePercent: _svcP,
      discount: _discAmt,
      discountPercent: _discP,
      hourlyCharge: hourlyCharge > 0 ? hourlyCharge : undefined,
      hourlyHours: hourlyHours > 0 ? hourlyHours : undefined,
      total: printSubtotal + hourlyCharge + _svcFee - _discAmt,
      paymentType: order.paymentType || 'cash',
      restaurantName: restaurantName || 'Ресторан',
      date: new Date().toLocaleString('ru-RU'),
      // To'langan bo'lsa — to'lov cheki; bo'lmasa — prechek. Imzo
      // farqlansin (prechekdan keyin to'lov cheki o'tkazib yuborilmasin).
      docType: isFullyPaid ? 'payment' : 'precheck',
    });
    if (!result.success && !silent) {
      alert('Ошибка печати чека: ' + (result.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка печати чека:', error);
    if (!silent) alert('Произошла ошибка при печати чека');
  }
}

export function CashierApp() {
  const { user, restaurant, branch, logout } = useAuth();
  const [numpadOpen, setNumpadOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DailySummary>(EMPTY_SUMMARY);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  // Oxirgi ma'lum smena _id — loadData (useCallback []) yangi state'ni
  // ko'rmaydi. Online VPS /orders/today shiftId SIZ BO'SH qaytaradi, shuning
  // uchun shiftId aniqlanmasa shu zaxiradan olamiz (ekran bo'shab qolmasin).
  const lastShiftIdRef = useRef<string | undefined>(undefined);
  const [shiftLoaded, setShiftLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  // POS rejimi (mode-detector): 'online' bo'lsa VPS ulanган, 'offline' bo'lsa
  // local-server. 'unknown'/online'ni online deb hisoblaymiz (default xavfsiz).
  const [posOnline, setPosOnline] = useState(true);
  // Stol kategoriyasi (этаж): tableId → nom, va nom (Стол 10) → этаж.
  // Order'da kategoriya kelmaydi (getOrders populate qilmaydi) — shuning
  // uchun /api/tables'dan jonli xarita tuzamiz va render paytida hal qilamiz.
  const [tableCatById, setTableCatById] = useState<Record<string, string>>({});
  const [tableCatByName, setTableCatByName] = useState<Record<string, string>>({});

  const [screen, setScreenState] = useState<Screen>('orders');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);

  // Sync overlay state — offline → online o'tishda local-server outbox'ni
  // VPS'ga jo'natayotgan paytda foydalanuvchi orderlarning "birin-ketin"
  // paydo bo'lishini ko'rmaslik uchun "Синхронизация…" overlay.
  const [syncing, setSyncing] = useState(false);
  const [syncPending, setSyncPending] = useState(0);
  // Sync tugagandan keyin qolgan unsynced ops (failed retry holatida) — pastdagi
  // banner orqali foydalanuvchini xabardor qiladi. Hech narsa "yashirin" qolmasin.
  const [syncWarning, setSyncWarning] = useState<{ count: number; message: string } | null>(null);
  // Filial sinxronlash flag'i (boshqa POS yoki local-server outbox flush)
  // — VPS'dan `branch:sync_started` eventi kelsa true bo'ladi. Bu vaqtda
  // order eventlarini IGNORE qilamiz (flicker yo'q). `branch:sync_completed`
  // kelganda false → loadData bitta fresh state oladi.
  const branchSyncingRef = useRef(false);

  const [audio] = useState(() => {
    if (typeof window !== 'undefined') {
      const a = new Audio();
      a.src = '/notification.mp3';
      return a;
    }
    return null;
  });

  const ordersRef = useRef<Order[]>([]);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Дедуп авто-печати прчека: один и тот же запрос (reconnect/повтор события)
  // не печатается дважды в течение окна.
  const printedChecksRef = useRef<Map<string, number>>(new Map());

  // Filial услуга/chegirma sozlamasi (GLOBAL backend = manba). Chek/prechek
  // shu bo'yicha hisoblanadi — order'da % hali bo'lmasa ham (eski orderlar).
  // Ref orqali — socket handler eski closure'da ham eng so'nggi qiymatni o'qiydi.
  const [brSvc, setBrSvc] = useState<{ en: boolean; pct: number; disc: number }>({
    en: false,
    pct: 0,
    disc: 0,
  });
  const brSvcRef = useRef(brSvc);
  useEffect(() => {
    brSvcRef.current = brSvc;
  }, [brSvc]);
  useEffect(() => {
    let alive = true;
    const pull = () =>
      api
        .getRestaurantSettings()
        .then((s) => {
          if (!alive || !s) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = s as any;
          setBrSvc({
            en: a.serviceChargeEnabled === true,
            pct: Number(a.serviceChargePercent) || 0,
            disc: Number(a.discountPercent) || 0,
          });
        })
        .catch(() => {});
    pull();
    // Sozlama boshqa terminalda o'zgarishi mumkin — vaqti-vaqti bilan yangilab turamiz.
    const t = setInterval(pull, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Restore persisted screen + current order
  useEffect(() => {
    try {
      const s = localStorage.getItem('kassir-screen') as Screen | null;
      if (s) setScreenState(s);
      const oid = localStorage.getItem('kassir-current-order');
      if (oid) setCurrentOrderId(oid);
    } catch {
      /* ignore */
    }
  }, []);

  const setScreen = useCallback((s: Screen) => {
    setScreenState(s);
    try {
      localStorage.setItem('kassir-screen', s);
    } catch {
      /* ignore */
    }
  }, []);
  const go = setScreen;

  useEffect(() => {
    try {
      if (currentOrderId) localStorage.setItem('kassir-current-order', currentOrderId);
      else localStorage.removeItem('kassir-current-order');
    } catch {
      /* ignore */
    }
  }, [currentOrderId]);

  const loadData = useCallback(async (shiftId?: string) => {
    try {
      let currentShiftId = shiftId;
      if (!currentShiftId) {
        // Smena offline'da xato bersa ham TO'XTAMAYMIZ — orderlar baribir
        // yuklanishi shart (avval bu throw bo'lsa setOrders chaqirilmasdi).
        try {
          const shiftData = await api.getActiveShift();
          currentShiftId = shiftData?._id;
          // MUHIM: server muvaffaqiyatli javob berdi — bu AVTORITATIV holat.
          // Aktiv смена bo'lsa — o'rnatamiz; bo'lmasa (null) — TOZALAYMIZ.
          // Avval faqat truthy bo'lsa o'rnatardi, hech qachon tozalamasdi →
          // yopilgan смена xotirada qolib, "qayta ochish"da Закрыть bosilganda
          // backend "Активная смена не найдена" (404) qaytarardi.
          setActiveShift(shiftData || null);
        } catch (e) {
          // Faqat XATO (offline/noma'lum) bo'lsa — eski holatni saqlab qolamiz
          // (online'da flicker bo'lmasligi uchun). Tozalamaymiz.
          console.warn('[loadData] getActiveShift xato (offline?), davom etamiz:', e);
        } finally {
          setShiftLoaded(true);
        }
      }
      // Zaxira: smena aniqlanmasa oxirgi ma'lumdan olamiz. Online'da
      // shiftId SIZ /orders/today BO'SH qaytaradi → yangi zakaz "ekranda
      // ko'rinmaydi" bo'lardi. Aniqlangan smenani ref'ga saqlaymiz.
      if (!currentShiftId) currentShiftId = lastShiftIdRef.current;
      if (currentShiftId) lastShiftIdRef.current = currentShiftId;
      // ENG MUHIM: orderlar. Avval Promise.all edi — getDailySummary
      // (/api/reports/dashboard offline handleri YO'Q → 503) reject bo'lsa
      // setOrders UMUMAN chaqirilmasdi va offline yaratilgan order
      // (jumladan saboy) ekranda chiqmasdi. Endi orderlarni alohida,
      // birinchi navbatda o'rnatamiz; summary/tables — best-effort.
      const ordersData = await api.getOrders(currentShiftId);
      // Smena aniqlanmay BO'SH kelsa, oldingi ro'yxatni o'chirmaymiz
      // (online'da ekran kutilmaganda bo'shab qolmasin).
      setOrders((prev) => {
        if (!Array.isArray(ordersData)) return prev;
        const canOverwrite = ordersData.length > 0 || currentShiftId || prev.length === 0;
        if (!canOverwrite) return prev;

        // OPTIMISTIC ORDER GRACE WINDOW — handleOrderCreated yangi qo'shilgan
        // order'ga `_optimistic` timestamp qo'yadi. Agar VPS hali bu order'ni
        // qaytarmagan bo'lsa (Mongo replica lag), 60 soniya ichida saqlab
        // qolamiz. 60s'dan keyin agar VPS'da hali ham yo'q bo'lsa — olib
        // tashlanadi (haqiqatan yaratilmagan).
        const GRACE_MS = 60_000;
        const now = Date.now();
        const vpsIds = new Set(ordersData.map((o) => o._id));
        const optimisticOrphans = prev.filter((o) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ts = (o as any)._optimistic;
          return typeof ts === 'number' && now - ts < GRACE_MS && !vpsIds.has(o._id);
        });
        return optimisticOrphans.length > 0
          ? [...optimisticOrphans, ...ordersData]
          : ordersData;
      });
      // Summary — ikkilamchi: xato bersa ham orderlarga ta'sir qilmaydi.
      api
        .getDailySummary(currentShiftId)
        .then((s) => setSummary(s))
        .catch((e) => console.warn('[loadData] getDailySummary xato (offline?):', e));
      // Stol nomlari + kategoriya (этаж) keshini issitamiz. Order'da
      // kategoriya bo'lmaydi — shuning uchun bu yerda jonli xarita tuzamiz
      // (tableId VA nom bo'yicha — moslashuvchan).
      api
        .getTables()
        .then((tbls) => {
          const byId: Record<string, string> = {};
          const byName: Record<string, string> = {};
          for (const t of tbls || []) {
            if (t.categoryTitle) {
              if (t._id) byId[t._id] = t.categoryTitle;
              if (t.title) byName[t.title] = t.categoryTitle;
            }
          }
          setTableCatById(byId);
          setTableCatByName(byName);
        })
        .catch(() => []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setShiftLoaded(true);
    }
  }, []);

  // Socket connection (ported from original Dashboard)
  useEffect(() => {
    const token = api.getToken();
    if (!token || !user?.restaurantId) return;

    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('cashier_connect', { cashierId: user._id, restaurantId: user.restaurantId });
    });
    socket.on('disconnect', () => setIsConnected(false));

    // Filial sinxronlash paytida event'larni IGNORE qilamiz — flicker yo'q.
    // Sync tugagach loadData() yagona chaqiriladi (fresh state).
    const refresh = () => {
      if (branchSyncingRef.current) return;
      loadData();
    };
    const refreshSound = () => {
      if (branchSyncingRef.current) {
        // Yangi order keldi (sync paytida) — ovoz chiqaradi-yu, lekin reload
        // qilmaymiz. Sync tugaganda bitta refresh bilan ko'rinadi.
        audio?.play().catch(() => {});
        return;
      }
      loadData();
      audio?.play().catch(() => {});
    };

    // Бэкенд при создании заказа официантом шлёт 'new_order' (роль cashier)
    // и 'order:created' (комната ресторана) — раньше их НЕ слушали, поэтому
    // новые заказы не появлялись в реальном времени.
    socket.on('new_order', refreshSound);
    socket.on('new_order_for_cashier', refreshSound);
    socket.on('new_kitchen_order', refreshSound);
    socket.on('order_updated', refresh);
    socket.on('kitchen_orders_updated', refresh);
    socket.on('order_paid', refresh);
    socket.on('order_paid_success', refresh);
    socket.on('item_status_updated', refresh);
    socket.on('food_status_changed', refresh);
    socket.on('order_completed', refresh);
    socket.on('order_deleted', refresh);
    socket.on('order_item_deleted', refresh);
    // Menyu/kategoriya/stol global'da o'zgarsa (sync topdi) → REAL-TIME qayta yuklash.
    // Dashboard'ni yangilaymiz + ochiq menyu ekraniga window-event yuboramiz.
    socket.on('menu:updated', () => {
      loadData();
      window.dispatchEvent(new Event('aridai:menu-updated'));
    });
    socket.on('order_rejected', refresh);
    socket.on('order_cancelled', refresh);
    socket.on('order_item_cancelled', refresh);
    // Комнатные (broadcast на весь ресторан) — на случай, если роль-комната
    // не совпала; гарантирует real-time у кассы.
    socket.on('order:created', refreshSound);
    socket.on('order:updated', refresh);
    socket.on('order:deleted', refresh);
    socket.on('order:cancelled', refresh);
    socket.on('order:paid', refresh);

    // Filial sinxronlash (local-server outbox flush boshlandi/tugadi) —
    // overlay ko'rsatamiz va order eventlarini ignore qilamiz, sync tugagach
    // bitta fresh loadData() bilan to'liq state'ni olamiz (flicker yo'q).
    socket.on('branch:sync_started', (data) => {
      console.log('[socket] branch:sync_started', data);
      branchSyncingRef.current = true;
      setSyncing(true);
      setSyncPending(Number(data?.pending) || 0);
    });
    socket.on('branch:sync_completed', (data) => {
      console.log('[socket] branch:sync_completed', data);
      branchSyncingRef.current = false;
      setSyncing(false);
      setSyncPending(0);
      // Bitta fresh state — flicker yo'q.
      loadData();
    });

    socket.on('shift:opened', (data) => {
      setActiveShift(data.shift);
      setShiftLoaded(true);
      loadData(data.shift?._id);
    });
    socket.on('shift:closed', () => {
      setActiveShift(null);
      setShiftLoaded(true);
      setOrders([]);
      setSummary(EMPTY_SUMMARY);
    });
    socket.on('shift:updated', (data) => {
      // Yopilgan смена'ni aktiv qilib qo'ymaymiz (aks holda Закрыть → 404)
      if (data.shift && data.shift.status && data.shift.status !== 'active') {
        setActiveShift(null);
        return;
      }
      if (data.shift) setActiveShift(data.shift);
    });

    // Auto-print pre-check from waiter (gated by Settings toggle)
    socket.on('print_check_requested', async (data) => {
      audio?.play().catch(() => {});
      if (typeof window !== 'undefined' && localStorage.getItem('autoprint-check') === '0') return;

      // Дедуп: backend printData'da requestId/checkId YO'Q, har chaqiruvda
      // yangi requestedAt. Event 'cashier'+'admin' room'ga, reconnect'da
      // yoki qayta-emit'da bir necha marta kelishi mumkin → har xil
      // requestedAt → eski kalit ushlamasdi (ikki marta bosilardi).
      // Endi FAQAT orderId bo'yicha: bitta order uchun 30s ichida bitta
      // prechek (qayta bosish kerak bo'lsa — kassada "Чек" tugmasi bor).
      const dedupKey = `pc:${String(data.orderId || '')}`;
      const now = Date.now();
      const seen = printedChecksRef.current;
      const last = seen.get(dedupKey);
      if (last && now - last < 30000) return;
      seen.set(dedupKey, now);
      for (const [k, ts] of seen) if (now - ts > 300000) seen.delete(k);

      // Hourly TO'G'RI hisoblanishi uchun lokal order kerak. Event orderlar
      // yuklanmasdan kelsa, qisqa kutib bir marta qayta qaraymiz — aks holda
      // backend'ning XOM (hourly=0) ma'lumotidan "0 ₸" chek chiqardi.
      let localOrder = ordersRef.current.find((o) => o._id === data.orderId);
      if (!localOrder) {
        await new Promise((r) => setTimeout(r, 900));
        localOrder = ordersRef.current.find((o) => o._id === data.orderId);
      }
      let itemsForPrint: { name: string; quantity: number; price: number }[];
      let subtotal: number;
      let hourlyCharge = 0;
      let hourlyHours = 0;

      if (localOrder) {
        const unpaidItems = localOrder.items.filter(
          (i) => i.status !== 'cancelled' && !i.isCancelled && !i.isDeleted && i.isPaid !== true,
        );
        if (unpaidItems.length === 0) return;
        // Soatlik item — DAQIQALI hisoblangan summa (chekda 0 emas).
        itemsForPrint = unpaidItems.map((i) =>
          i.isHourly
            ? { name: i.name, quantity: 1, price: itemLineTotal(i) }
            : { name: i.name, quantity: i.quantity, price: i.price },
        );
        subtotal = unpaidItems.reduce((s, i) => s + itemLineTotal(i), 0);
        if (localOrder.hasHourlyCharge && localOrder.hourlyChargeAmount && localOrder.hourlyChargeAmount > 0) {
          const diffH = (Date.now() - new Date(localOrder.createdAt).getTime()) / 3600000;
          hourlyHours = Math.floor(diffH) + 1;
          hourlyCharge = hourlyHours * localOrder.hourlyChargeAmount;
        }
      } else {
        itemsForPrint = data.items || [];
        subtotal = data.subtotal || 0;
        if (data.hasHourlyCharge && data.hourlyChargeAmount && data.hourlyChargeAmount > 0) {
          const diffH =
            (Date.now() - new Date(data.requestedAt || new Date().toISOString()).getTime()) / 3600000;
          hourlyHours = Math.floor(diffH) + 1;
          hourlyCharge = hourlyHours * data.hourlyChargeAmount;
        }
      }

      // услуга/chegirma — order'da % bo'lsa o'sha, bo'lmasa filial sozlamasi.
      // Prechekda ham 10% услуга ko'rinishi kerak (backend to'lovda qo'shadi).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _lo = localOrder as any;
      const _br = brSvcRef.current;
      // Услуга = STOL XIZMATI → saboy/takeaway uchun yo'q (backend bilan bir xil).
      const _ot = _lo?.orderType || data?.orderType;
      const _isDineIn = _ot !== 'saboy' && _ot !== 'takeaway';
      const _svcP = !_isDineIn
        ? 0
        : Number(_lo?.serviceChargePercent || 0) || (_br.en ? _br.pct : 0);
      const _discP = Number(_lo?.discountPercent || 0) || (_br.disc > 0 ? _br.disc : 0);
      const _svcFee = _svcP > 0 ? Math.round(subtotal * (_svcP / 100)) : 0;
      const _discAmt = _discP > 0 ? Math.round(subtotal * (_discP / 100)) : 0;
      try {
        await PrinterAPI.printPayment(
          {
            orderId: data.orderId,
            orderNumber: data.orderNumber || 0,
            tableName: data.tableName || 'Неизвестный стол',
            waiterName: data.waiterName || '',
            items: itemsForPrint,
            subtotal,
            serviceFee: _svcFee,
            serviceFeePercent: _svcP,
            discount: _discAmt,
            discountPercent: _discP,
            hourlyCharge: hourlyCharge > 0 ? hourlyCharge : undefined,
            hourlyHours: hourlyHours > 0 ? hourlyHours : undefined,
            total: subtotal + hourlyCharge + _svcFee - _discAmt,
            paymentType: 'cash',
            restaurantName: restaurant?.name || 'Ресторан',
            date: new Date().toLocaleString('ru-RU'),
            docType: 'precheck',
          },
        );
      } catch (err) {
        console.error('Auto-print error:', err);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?._id, user?.restaurantId, audio, loadData, restaurant?.name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // POS online/offline rejimini kuzatish (order kartochkasida "Детали"
  // tugamasini online'da yashirish uchun). mode-detector → window.pos.mode.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== 'undefined' ? (window as any).pos : null;
    if (!w?.mode) return;
    let off: (() => void) | undefined;
    const apply = (m: unknown) => {
      // get() → { mode, cashierUrl }; onChange → 'online'|'offline'|'unknown'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = typeof m === 'string' ? m : (m as any)?.mode;
      // Faqat aniq 'offline' bo'lsa offline; aks holda online (xavfsiz default).
      setPosOnline(val !== 'offline');
    };
    try {
      Promise.resolve(w.mode.get?.()).then(apply).catch(() => {});
      off = w.mode.onChange?.(apply);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        off?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Офлайн-изменения НЕ приходят через socket.io VPS (их там ещё нет).
  // Поэтому:
  //   1. Mode 'online'ga o'tganda local-server outbox sync'ini KUTAMIZ
  //      (polling /sync/status). Sync paytida overlay ko'rsatamiz, reload
  //      qilmaymiz — natija birdaniga keladi ("birin-ketin" yo'qoladi).
  //   2. Страховочный опрос har 10s — экраны sami обновляются.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== 'undefined' ? (window as any).pos : null;
    let pollSyncT: ReturnType<typeof setTimeout> | undefined;
    let off: (() => void) | undefined;

    const waitForSyncThenReload = async (maxWaitMs = 15_000) => {
      // Mantiq: avval flush BOSHLANISHINI kutamiz (isFlushing=true ko'rinishi).
      // Keyin flush TUGASHINI kutamiz (isFlushing=true → false transition).
      // Tugagandan keyin DARHOL overlay yopiladi va reload bo'ladi.
      // Pending qoldi-yu xato yo'q (network glitch) — failed sifatida banner
      // ko'rsatamiz, lekin foydalanuvchini ko'p kuttirmaymiz.
      const start = Date.now();
      setSyncing(true);
      setSyncWarning(null);

      let seenFlushing = false; // hech bo'lmasa bir marta isFlushing=true ko'rdikmi
      let lastStatus: Awaited<ReturnType<typeof getSyncStatus>> = null;

      while (Date.now() - start < maxWaitMs) {
        const st = await getSyncStatus();
        if (!st) {
          // local-server javob bermadi — chiqamiz, web rejim bo'lishi mumkin.
          break;
        }
        lastStatus = st;
        setSyncPending(st.pending + (st.isFlushing ? 1 : 0));

        if (st.isFlushing) {
          seenFlushing = true;
        } else if (seenFlushing) {
          // Flush boshlangan edi va endi tugadi — DARHOL chiqamiz.
          break;
        } else if (st.pending === 0) {
          // Hali flush boshlanmagan-u, lekin queue ham bo'sh — kutmaymiz.
          break;
        }

        await new Promise((r) => {
          pollSyncT = setTimeout(r, 700);
        });
      }

      // Agar pending qolgan bo'lsa (xato bergan ops) — banner ko'rsatamiz.
      if (lastStatus && lastStatus.pending > 0) {
        const errMsg = lastStatus.lastError?.message
          ? `${lastStatus.lastError.operation} #${lastStatus.lastError.entityId.slice(-6)}: ${lastStatus.lastError.message}`
          : 'Автоматический повтор через несколько секунд.';
        setSyncWarning({ count: lastStatus.pending, message: errMsg });
      } else {
        setSyncWarning(null);
      }

      setSyncing(false);
      setSyncPending(0);
      // Endi to'liq state'ni tortib olamiz — orderlar TO'G'RI holatda chiqadi.
      await loadData();
    };

    try {
      off = w?.mode?.onChange?.((mode: string) => {
        if (mode === 'online') {
          if (pollSyncT) clearTimeout(pollSyncT);
          // Avval kichik kechikish — local-server'ga sync boshlashga vaqt.
          setTimeout(() => waitForSyncThenReload(), 1500);
        }
      });
    } catch {
      /* ignore */
    }
    const poll = setInterval(() => {
      // Sync paytida poll qilmaymiz — overlay tugashini kutamiz.
      if (!syncing) loadData();
    }, 10000);

    // Banner aktiv bo'lsa — har 5 soniyada /sync/status tekshirib turamiz.
    // Local-server flushOutbox o'zi qayta urinadi; pending=0 bo'lsa banner
    // yopiladi va loadData() chaqiriladi (oxirgi order ham yangilanadi).
    const warningPoll = setInterval(async () => {
      if (syncing) return; // overlay aktiv, alohida poll mantiqi
      if (!syncWarning) return;
      const st = await getSyncStatus();
      if (!st) return;
      if (st.pending === 0) {
        setSyncWarning(null);
        loadData(); // qolgan o'zgarishlarni tortib olamiz
      } else if (st.lastError) {
        const msg = `${st.lastError.operation} #${st.lastError.entityId.slice(-6)}: ${st.lastError.message}`;
        setSyncWarning({ count: st.pending, message: msg });
      }
    }, 5000);
    return () => {
      if (off) off();
      if (pollSyncT) clearTimeout(pollSyncT);
      clearInterval(poll);
      clearInterval(warningPoll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, syncWarning]);

  // ─── Handlers (ported) ─────────────────────────────────────────────────────
  const handlePayment = useCallback(
    async (orderId: string, paymentType: PaymentType, paymentSplit?: PaymentSplit, comment?: string) => {
      try {
        // To'lovdan OLDINGI order (ekranda, stol/ofitsiant TO'G'RI).
        // Backend to'lov javobida tableId/waiterId populate qilinmaydi va
        // stol bo'shaydi → paidOrder'da "Стол 0"/"Неизвестно" bo'lib qoladi.
        // Chek uchun stol/ofitsiantni avvalgi orderdan tiklaymiz.
        const prevOrder = orders.find((o) => o._id === orderId);
        const paidOrder = await api.processPayment(orderId, paymentType, paymentSplit, comment);
        setOrders((prev) => prev.map((o) => (o._id === orderId ? paidOrder : o)));
        const badTable = !paidOrder.tableName || /^\s*(Стол\s*0|Неизвест)/i.test(paidOrder.tableName);
        const badWaiter = !paidOrder.waiter?.name || /Неизвест/i.test(paidOrder.waiter.name);
        const forPrint = {
          ...paidOrder,
          tableName: badTable && prevOrder?.tableName ? prevOrder.tableName : paidOrder.tableName,
          waiter: badWaiter && prevOrder?.waiter?.name ? prevOrder.waiter : paidOrder.waiter,
        };
        // Оплачено → автоматически печатаем чек (Local Server направит на кассу)
        printOrderReceipt(forPrint, restaurant?.name || 'Ресторан', true, brSvcRef.current);
        await loadData();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Оплата не выполнена';
        // Заказ фактически уже оплачен (двойной клик / устаревший экран) —
        // это не ошибка: обновляем список и выходим без alert.
        if (/уже оплач|already paid/i.test(msg)) {
          await loadData();
          return;
        }
        alert(msg);
        throw error;
      }
    },
    [loadData, restaurant?.name, orders],
  );

  const handlePartialPayment = useCallback(
    async (
      orderId: string,
      itemIds: string[],
      paymentType: PaymentType,
      paymentSplit?: PaymentSplit,
      comment?: string,
    ): Promise<PartialPaymentResult> => {
      try {
        const prevOrder = orders.find((o) => o._id === orderId);
        const result = await api.processPartialPayment(orderId, itemIds, paymentType, paymentSplit, comment);
        setOrders((prev) => prev.map((o) => (o._id === orderId ? result.order : o)));
        // Частичная оплата → печатаем чек ТОЛЬКО на оплаченные позиции
        const ps = result.paymentSession;
        const o = result.order;
        // To'lov javobida stol/ofitsiant yo'qolishi mumkin → avvalgi orderdan tiklaymiz.
        const okTable =
          o.tableName && !/^\s*(Стол\s*0|Неизвест)/i.test(o.tableName)
            ? o.tableName
            : prevOrder?.tableName || o.tableName;
        const okWaiter =
          o.waiter?.name && !/Неизвест/i.test(o.waiter.name)
            ? o.waiter.name
            : prevOrder?.waiter?.name || o.waiter?.name || '';
        if (ps && Array.isArray(ps.paidItems) && ps.paidItems.length > 0) {
          const sub = ps.paidItems.reduce((s, i) => s + i.price * i.quantity, 0);
          const ppSub = ps.subtotal || sub;
          // услуга/chegirma — order'da % bo'lsa o'sha, bo'lmasa filial sozlamasi.
          // Qisman to'lovda ham shu qism summasiga услуга qo'shiladi.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const _o = o as any;
          const _br = brSvcRef.current;
          // Услуга = STOL XIZMATI → saboy/takeaway uchun yo'q (backend bilan bir xil).
          const _isDineIn = _o?.orderType !== 'saboy' && _o?.orderType !== 'takeaway';
          const _svcP = !_isDineIn
            ? 0
            : Number(_o?.serviceChargePercent || 0) || (_br.en ? _br.pct : 0);
          const _discP = Number(_o?.discountPercent || 0) || (_br.disc > 0 ? _br.disc : 0);
          const _svcFee = _svcP > 0 ? Math.round(ppSub * (_svcP / 100)) : 0;
          const _discAmt = _discP > 0 ? Math.round(ppSub * (_discP / 100)) : 0;
          PrinterAPI.printPayment({
            orderId: o._id,
            orderNumber: o.orderNumber,
            tableName: okTable,
            waiterName: okWaiter,
            items: ps.paidItems.map((i) => ({ name: i.foodName, quantity: i.quantity, price: i.price })),
            subtotal: ppSub,
            serviceFee: _svcFee,
            serviceFeePercent: _svcP,
            discount: _discAmt,
            discountPercent: _discP,
            total: ppSub + _svcFee - _discAmt,
            paymentType: ps.paymentType || paymentType,
            restaurantName: restaurant?.name || 'Ресторан',
            date: new Date().toLocaleString('ru-RU'),
            docType: 'partial',
          }).catch((e) => console.error('Partial receipt print error:', e));
        }
        await loadData();
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Оплата не выполнена';
        alert(msg);
        throw error;
      }
    },
    [loadData, restaurant?.name, orders],
  );

  const handlePrint = useCallback(
    async (order: Order) => {
      await printOrderReceipt(order, restaurant?.name || 'Ресторан', false, brSvcRef.current);
    },
    [restaurant?.name],
  );

  const handleAddItemsSuccess = useCallback(
    (updated: Order) => {
      setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
      loadData();
    },
    [loadData],
  );

  // Yangi zakaz yaratilganda — backend response'dagi to'liq order'ni darhol
  // local state'ga qo'shamiz. Avval `await ctx.reload()` chaqirilardi, lekin
  // Mongo replica eventual consistency / race tufayli yangi order Dashboard'da
  // ko'rinmasdi (povorga check ketgani holda). Endi: optimistic qo'shamiz,
  // keyin loadData() sync uchun.
  //
  // MUHIM: optimistic qo'shilgan order'ga `_optimistic` timestamp belgisi
  // qo'shamiz — loadData() ichida VPS hali bu order'ni qaytarmagan bo'lsa
  // (replica lag), uni overwrite paytida YO'QOTMAYMIZ (60s gracewindow).
  // Avval shu yo'qolish kabina/dine-in orderda yuz berardi (1-zakaz ko'rinmas,
  // 2-zakazdan keyin ikkalasi ham paydo bo'lardi).
  const handleOrderCreated = useCallback(
    (newOrder: Order) => {
      const tagged = { ...newOrder, _optimistic: Date.now() } as Order;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o._id === newOrder._id);
        if (idx === -1) return [tagged, ...prev];
        // Allaqachon mavjud bo'lsa (mas. mavjud orderga item qo'shildi) —
        // yangilangan obyektga almashtiramiz, dublikat qilmaymiz.
        const next = prev.slice();
        next[idx] = tagged;
        return next;
      });
      // Backend bilan to'liq sync uchun fon rejimda yangilash. Race'dan keyin
      // ham yangi order yo'qolmaydi (yuqoridagi setOrders'da allaqachon bor).
      loadData();
    },
    [loadData],
  );

  const handleChangeItemQty = useCallback(
    async (orderId: string, itemId: string, quantity: number) => {
      try {
        await api.updateItemQuantity(orderId, itemId, quantity);
        await loadData();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Не удалось изменить количество';
        alert(msg);
        throw error;
      }
    },
    [loadData],
  );

  const currentOrder = useMemo(
    () => orders.find((o) => o._id === currentOrderId) || null,
    [orders, currentOrderId],
  );

  // Header tushumi — kassir ko'rayotgan paid orderlardan, to'lov turi bo'yicha.
  // (opening kassa / avans / rasxod ARALASHMAYDI — faqat kunlik tushum.
  //  cash+card+перевод === Выручка bo'lib, ichki izchil.)
  const headerSummary = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let click = 0;
    for (const o of orders) {
      if (o.paymentStatus !== 'paid') continue;
      const amt =
        o.grandTotal ||
        (o.items || [])
          .filter((i) => i.status !== 'cancelled' && !i.isCancelled)
          .reduce((s, i) => s + i.price * i.quantity, 0);
      total += amt;
      const sp = o.paymentSplit;
      if (o.paymentType === 'mixed' && sp) {
        cash += sp.cash || 0;
        card += sp.card || 0;
        click += sp.click || 0;
      } else if (o.paymentType === 'card') {
        card += amt;
      } else if (o.paymentType === 'click') {
        click += amt;
      } else {
        cash += amt;
      }
    }
    // Сервер (api.getDailySummary) — источник истины за смену: он считает все
    // оплаченные заказы, а не только активные, что лежат сейчас в памяти.
    // Локальный пересчёт берём ТОЛЬКО когда сервер ещё отдал 0 (самый первый
    // оплаченный заказ до рефреша) — иначе шапка показывала 0 при реальной выручке.
    const serverTotal = summary.totalRevenue || 0;
    if (serverTotal > 0) return summary;
    return {
      ...summary,
      totalRevenue: total,
      cashRevenue: cash,
      cardRevenue: card,
      clickRevenue: click,
    };
  }, [orders, summary]);

  const ctx: ScreenCtx = {
    go,
    screen,
    orders,
    summary,
    activeShift,
    user,
    restaurant,
    branch,
    isConnected,
    posOnline,
    branchSvc: brSvc,
    tableCategory: (o) => {
      if (!o || o.orderType === 'saboy' || o.orderType === 'takeaway') return '';
      const byId = o.tableId ? tableCatById[o.tableId] : '';
      if (byId) return byId;
      const byName = o.tableName ? tableCatByName[o.tableName] : '';
      if (byName) return byName;
      // Transform paytida saqlangan zaxira
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (o as any).tableCategoryTitle || '';
    },
    currentOrder,
    setCurrentOrderId,
    mergeSelection,
    setMergeSelection,
    reload: loadData,
    onPay: handlePayment,
    onPartialPay: handlePartialPayment,
    onPrint: handlePrint,
    onAddItemsSuccess: handleAddItemsSuccess,
    onOrderCreated: handleOrderCreated,
    onChangeItemQty: handleChangeItemQty,
    onShiftChanged: (s) => {
      setActiveShift(s);
      setShiftLoaded(true);
    },
    onLogout: logout,
  };

  // No active shift → force shift-open (full screen, no chrome)
  if (shiftLoaded && !activeShift) {
    return <ShiftOpenScreen ctx={ctx} />;
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: T.font }}>
      <Header
        summary={headerSummary}
        activeShift={activeShift}
        user={user}
        restaurant={restaurant}
        branch={branch}
        isConnected={isConnected}
        numpadOpen={numpadOpen}
        onToggleNumpad={() => setNumpadOpen((v) => !v)}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'auto', minHeight: 0 }}>
        <SideNav current={screen} go={go} />
        {screen === 'orders' && <DashboardScreen ctx={ctx} />}
        {screen === 'merge' && <DashboardScreen ctx={ctx} />}
        {screen === 'orderDetail' && <OrderDetailScreen ctx={ctx} />}
        {screen === 'payment' && <PaymentScreen ctx={ctx} />}
        {screen === 'addItems' && <AddItemsScreen ctx={ctx} />}
        {screen === 'newOrder' && <NewOrderScreen ctx={ctx} />}
        {(screen === 'saboy' || screen === 'menu') && <SaboyScreen ctx={ctx} />}
        {screen === 'reports' && <ReportsScreen ctx={ctx} />}
        {screen === 'expenses' && <ExpensesScreen ctx={ctx} />}
        {screen === 'advances' && <AdvancesScreen ctx={ctx} />}
        {screen === 'settings' && <SettingsScreen ctx={ctx} />}
        {screen === 'shiftClose' && <ShiftCloseScreen ctx={ctx} />}
      </div>
      <Numpad open={numpadOpen} onClose={() => setNumpadOpen(false)} />

      {/* Warning banner — overlay yopilgandan keyin pending qolsa. */}
      {syncWarning && !syncing && (
        <div
          style={{
            position: 'fixed',
            bottom: 18,
            right: 18,
            zIndex: 9998,
            background: '#fff4e0',
            border: '2px solid #e09020',
            color: '#5a3500',
            padding: '14px 18px',
            maxWidth: 460,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            boxShadow: '0 6px 22px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.3 }}>
              ⚠ Не синхронизировано: {syncWarning.count}
            </div>
            <button
              onClick={() => setSyncWarning(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 800,
                color: '#5a3500',
                padding: '0 4px',
              }}
              aria-label="close"
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
            {syncWarning.message}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            Автоматический повтор каждые несколько секунд.
          </div>
        </div>
      )}

      {/* Sync overlay — offline→online o'tishda outbox bo'shaguncha. */}
      {syncing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 18, 14, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: T.surface,
              border: `2px solid ${T.cta}`,
              padding: '34px 44px',
              minWidth: 380,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                border: `5px solid ${T.border}`,
                borderTopColor: T.cta,
                borderRadius: '50%',
                animation: 'sync-spin 0.9s linear infinite',
              }}
            />
            <style>{`@keyframes sync-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.text, letterSpacing: 0.4 }}>
              Синхронизация…
            </div>
            <div style={{ fontSize: 14, color: T.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
              Соединение восстановлено. Отправляем оффлайн-изменения на сервер.
              <br />
              Подождите, не закрывайте окно.
            </div>
            {syncPending > 0 && (
              <div
                style={{
                  marginTop: 6,
                  padding: '6px 14px',
                  background: T.panelStrong,
                  fontSize: 14,
                  fontWeight: 800,
                  color: T.text,
                }}
              >
                Осталось: {syncPending}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
