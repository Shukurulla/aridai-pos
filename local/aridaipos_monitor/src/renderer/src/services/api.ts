import { User, Restaurant, Order, DailySummary, PaymentType, PaymentSplit, SaboyItem, PartialPaymentResult, OrderItem, Shift, ExpenseCategory, Expense, Advance, Waiter } from "@/types";
import { itemLineTotal } from "@/utils/hourly";
import { setCurrency } from "@/lib/theme";

// API manzili — POS monitor FAQAT LOCAL SERVER (aridaipos_server) ga ulanadi.
// Global/VPS'ga TO'G'RIDAN ULANMAYDI (global bilan sync — local-server vazifasi;
// online → local-server VPS'ga shaffof proksi, offline → lokal nusxa). Priority:
//  1) window.__API_BASE__ (preload injekt — odatda berilmaydi),
//  2) localStorage 'hub-url' (Settings — filialdagi BOSHQA PC'dagi local-server
//     LAN IP, mas. "http://192.168.1.50:4561"),
//  3) default: "http://localhost:4561" (shu PC'dagi local-server).
function readStoredHubUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage?.getItem("hub-url") || "";
    const trimmed = raw.trim().replace(/\/+$/, ""); // oxiridagi / olib tashlash
    return trimmed;
  } catch {
    return "";
  }
}

// Soatlik taom rate'i = taomning JORIY narxi (foods.price). getMenuItems
// uni 'foodPriceMap' (foodId→price) ga keshlaydi. getOrders/optimistik
// mapping soatlik item.hourlyPrice'ini SHU yerdan override qiladi —
// backend/VPS statik (yaratilgandagi) qiymatga TAYANMAYMIZ. Online ham,
// offline ham bir xil; local-server qayta ishga tushishi shart emas.
function readFoodPriceMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage?.getItem('foodPriceMap') || '{}') || {};
  } catch {
    return {};
  }
}
function foodIdOf(it: { foodId?: unknown }): string {
  const f = it?.foodId as { _id?: string; id?: string } | string | undefined | null;
  if (f && typeof f === 'object') return String(f._id || f.id || '');
  return f != null ? String(f) : '';
}

const API_BASE_URL =
  (typeof window !== "undefined" &&
    (window as unknown as { __API_BASE__?: string }).__API_BASE__) ||
  readStoredHubUrl() ||
  // AridaiPos: lokal backend (4561). Electron'da preload window.__API_BASE__ beradi.
  "http://localhost:4561";

// Debug uchun — qaysi URL'ga ulanyapti ko'rinsin.
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log(`[api] base URL: ${API_BASE_URL}`);
}

// Local server manzili (ulanish-darvozasi ko'rsatishi uchun).
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

// Local server bilan aloqa bor-yo'qligini tekshiradi (GET /api/health).
// Ulanish-darvozasi (ServerGate) shu orqali offline holatni aniqlaydi.
export async function pingServer(timeoutMs = 2500): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(`${API_BASE_URL}/api/health`, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// Sync status — local-server hub'idan (api siz, lokal endpoint).
// Pos-monitor "Синхронизация…" overlay'i uchun mode 'online'ga o'tganda
// polling qilinadi. Web'da (cashier-web) ishlatilmaydi.
export type SyncStatus = {
  pending: number;
  failed: number;
  isFlushing: boolean;
  lastFlushedAt: number;
  lastFlushedCount: number;
  isOnline: boolean;
  lastError: null | {
    entityType: string;
    entityId: string;
    operation: string;
    attempts: number;
    message: string;
    at: number;
  };
};

// Backend response order obyekti (populated waiterId/tableId) → Dashboard
// kutadigan 'Order' formatiga moslashtirish. `getOrders` ham xuddi shu
// shaklni qaytaradi (waiter.name string, tableName, items shakli va h.k.).
// `createOrder`/`createSaboyOrder` response'ini optimistic update qilishda
// shuning uchun shu mapping kerak — aks holda OrderCard `order.waiter.name`
// undefined da crash bo'ladi.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBackendOrderToDashboard(rawOrder: any): Order {
  const o = rawOrder || {};
  const rawItems = Array.isArray(o.items) ? o.items : [];
  const _fpm = readFoodPriceMap();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = rawItems.map((item: any) => ({
    _id: item._id?.toString() || item.id || '',
    foodId: item.foodId?._id || item.foodId || '',
    name: item.foodId?.name || item.foodName || item.name || 'Блюдо',
    foodName: item.foodId?.name || item.foodName || item.name || 'Блюдо',
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
    status: item.status || 'pending',
    addedAt: item.addedAt || item.createdAt || o.createdAt,
    addedBy: item.addedBy,
    addedByName: item.addedByName,
    isHourly: item.isHourly === true,
    // Soatlik rate = taom JORIY narxi (kesh); statik qiymat zaxira.
    hourlyPrice:
      item.isHourly === true
        ? Number(_fpm[foodIdOf(item)]) || Number(item.hourlyPrice) || 0
        : Number(item.hourlyPrice) || 0,
    hourlyStartedAt: item.hourlyStartedAt,
    hourlyStoppedAt: item.hourlyStoppedAt,
    hourlyFinalAmount: item.hourlyFinalAmount,
    isPaid: item.isPaid === true,
    paidAt: item.paidAt,
    paymentSessionId: item.paymentSessionId,
    itemPaymentType: item.itemPaymentType,
    isCancelled: item.status === 'cancelled' || item.isCancelled === true,
    cancelledAt: item.cancelledAt,
    cancelledBy: item.cancelledBy,
    cancelReason: item.cancelReason,
    isDeleted: item.isDeleted === true,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableId: any = o.tableId;
  const tableNumber = tableId?.number || o.tableNumber || 0;
  const tableName =
    (tableId && typeof tableId === 'object' && (tableId.title || (tableId.number != null ? `Стол ${tableId.number}` : null))) ||
    o.tableName ||
    (tableNumber ? `Стол ${tableNumber}` : '');

  const isSaboy = o.orderType === 'saboy';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waiterId: any = o.waiterId;
  const waiterName = waiterId && typeof waiterId === 'object'
    ? `${waiterId.firstName || ''} ${waiterId.lastName || ''}`.trim()
    : (o.waiterName || '');

  const activeItems = items.filter((i: { status: string; isCancelled?: boolean }) => i.status !== 'cancelled' && !i.isCancelled);
  const subtotal = activeItems.reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0);
  const isPaid = o.isPaid === true || o.status === 'paid';
  const isCancelled = o.status === 'cancelled';
  // Возврат — kartochka cancelled kabi yopiq ko'rinadi, paymentStatus saqlanadi
  // (OrderDetail "ВОЗВРАТ ОФОРМЛЕН" ko'rsatadi). partiallyPaid ham o'tkaziladi.
  const isRefunded = o.paymentStatus === 'refunded';
  const isPartial = o.paymentStatus === 'partiallyPaid';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    _id: o._id?.toString() || '',
    orderNumber: o.orderNumber || 0,
    isOffline: false,
    orderType: o.orderType,
    saboyNumber: o.saboyNumber || o.orderNumber,
    tableNumber,
    tableName: isSaboy ? 'Собой' : tableName,
    tableId:
      (tableId && typeof tableId === 'object' ? tableId._id : tableId) || '',
    tableCategoryTitle: isSaboy
      ? ''
      : (tableId && typeof tableId === 'object'
          ? (tableId.categoryId && typeof tableId.categoryId === 'object'
              ? tableId.categoryId.title
              : null) || tableId.categoryTitle || ''
          : '') ||
        (() => {
          try {
            const id =
              tableId && typeof tableId === 'object' ? tableId._id : tableId;
            const m = JSON.parse(localStorage.getItem('tableCatMap') || '{}');
            return id && m[id] ? String(m[id]) : '';
          } catch {
            return '';
          }
        })(),
    items,
    status: isCancelled || isRefunded ? 'cancelled' : isPaid ? 'paid' : 'active',
    paymentStatus: isRefunded ? 'refunded' : isPartial ? 'partiallyPaid' : isPaid ? 'paid' : 'pending',
    paymentType: o.paymentType,
    total: subtotal,
    serviceFee: 0,
    grandTotal: subtotal,
    waiter: {
      _id: waiterId?._id?.toString() || waiterId || '',
      name: waiterName || 'Неизвестно',
    },
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    hasHourlyCharge: o.hasHourlyCharge || tableId?.hasHourlyCharge || false,
    hourlyChargeAmount: o.hourlyChargeAmount || tableId?.hourlyChargeAmount || 0,
    hourlyCharge: o.hourlyCharge || 0,
    hourlyChargeHours: o.hourlyChargeHours || 0,
  } as unknown as Order;
}

export async function getSyncStatus(): Promise<SyncStatus | null> {
  // window.pos bo'lmasa (web mode) — sync overlay shartmas.
  if (typeof window === "undefined") return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/sync/status`, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data || null) as SyncStatus | null;
  } catch {
    return null;
  }
}

// Stol nomini har xil backend/mirror shaklidan aniqlash. tableId populate
// qilinmasa — oxirgi /api/tables keshi (localStorage 'tablesMap') orqali.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveTableName(order: any): string {
  const t = order?.tableId;
  if (t && typeof t === 'object') {
    if (t.title) return String(t.title);
    if (t.number != null) return `Стол ${t.number}`;
    if (t.name) return String(t.name);
  }
  if (order?.tableName) return String(order.tableName);
  if (order?.tableTitle) return String(order.tableTitle);
  const id = typeof t === 'string' ? t : t?._id;
  if (id) {
    try {
      const m = JSON.parse(localStorage.getItem('tablesMap') || '{}');
      if (m[id]) return String(m[id]);
    } catch {
      /* ignore */
    }
  }
  if (order?.tableNumber) return `Стол ${order.tableNumber}`;
  return 'Неизвестный стол';
}

// Stol kategoriyasi (этаж) nomi — order kartochkasida bir xil raqamli
// stollarni (1-этаж/2-этаж) farqlash uchun. tableId populate bo'lsa o'shandan,
// aks holda /api/tables keshi (localStorage 'tableCatMap') orqali.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveTableCategory(order: any): string {
  const t = order?.tableId;
  if (t && typeof t === 'object') {
    const c = t.categoryId;
    if (c && typeof c === 'object' && c.title) return String(c.title);
    if (t.categoryTitle) return String(t.categoryTitle);
  }
  if (order?.tableCategoryTitle) return String(order.tableCategoryTitle);
  const id = typeof t === 'string' ? t : t?._id;
  if (id) {
    try {
      const m = JSON.parse(localStorage.getItem('tableCatMap') || '{}');
      if (m[id]) return String(m[id]);
    } catch {
      /* ignore */
    }
  }
  return '';
}

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("token");
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("restaurant");
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getToken();

    // Electron pos-monitor: so'rovni MAIN process orqali (window.pos.hub).
    // Sabab: internet uzilganda Chromium renderer loopback (localhost) ni
    // ham bloklaydi (ERR_INTERNET_DISCONNECTED). Node (main) esa offline
    // ham localhost'ga kira oladi → offline rejim ishlaydi.
    const hub =
      typeof window !== "undefined"
        ? (window as unknown as {
            pos?: {
              hub?: {
                request: (
                  m: string,
                  p: string,
                  b?: unknown,
                ) => Promise<{ success: boolean; data?: unknown; error?: unknown }>;
              };
            };
          }).pos?.hub
        : undefined;
    if (hub) {
      const method = (options.method || "GET").toString().toUpperCase();
      let body: unknown;
      if (options.body) {
        try {
          body = JSON.parse(options.body as string);
        } catch {
          body = options.body;
        }
      }
      const r = await hub.request(method, endpoint, body);
      if (!r || r.success === false) {
        const e = r && (r as { error?: unknown }).error;
        const eo = (e && typeof e === "object" ? e : {}) as { message?: string; code?: string; status?: number };
        const msg =
          eo.message ||
          (typeof e === "string" ? e : "") ||
          "Сервер недоступен";
        // 401 / token yaroqsiz (local qayta provision / user yo'q) → login'ga
        const unauthorized =
          eo.status === 401 ||
          /\b401\b|AUTH_REQUIRED|TOKEN_INVALID|TOKEN_REVOKED|USER_INACTIVE/i.test(`${eo.code || ""} ${msg}`);
        if (unauthorized && !endpoint.includes("/auth/login") && typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        throw new Error(msg);
      }
      return r.data as T;
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      // 401 — token yaroqsiz (local server qayta provision qilingan / user yo'q).
      // Login endpointidan tashqari → sessiyani tugatib login'ga qaytaramiz.
      if (res.status === 401 && !endpoint.includes("/auth/login") && typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
      // Бэкенд отдаёт { success:false, error:{ code, message } }
      const msg =
        error?.error?.message ||
        error?.message ||
        `Ошибка ${res.status}`;
      throw new Error(msg);
    }

    return res.json();
  }

  // ========== AUTH (новый endpoint: /api/auth/login) ==========
  async login(
    phone: string,
    password: string,
  ): Promise<{ user: User; token: string; restaurant: Restaurant }> {
    // Telefonni har doim "+7XXXXXXXXXX" formatda yuborish (formatdan tozalash)
    const cleanPhone = '+' + String(phone).replace(/\D/g, '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: cleanPhone, password }),
    });

    // Новый ответ backend: { success, data: { staff, token, restaurant, branch } }
    const responseData = data.data || data;
    this.setToken(responseData.token);

    const staff = responseData.staff;
    const user: User = {
      _id: staff._id,
      name: `${staff.firstName} ${staff.lastName}`,
      phone: staff.phone,
      role: staff.role,
      restaurantId: staff.restaurantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: staff.branchId || null as any,
    };

    const restaurant: Restaurant = {
      _id: responseData.restaurant?._id || '',
      name: responseData.restaurant?.name || '',
      currency: responseData.restaurant?.currency || 'UZS',
    };
    setCurrency(restaurant.currency);

    const branch = responseData.branch || null;

    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("restaurant", JSON.stringify(restaurant));
      if (branch) {
        localStorage.setItem("branch", JSON.stringify(branch));
      } else {
        localStorage.removeItem("branch");
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { user, token: responseData.token, restaurant, branch } as any;
  }

  // ========== ORDERS (новый формат: массив items[]) ==========
  async getOrders(shiftId?: string): Promise<Order[]> {
    // Фильтр по ShiftId - при открытии новой смены получать только заказы текущей смены
    const params = new URLSearchParams();
    if (shiftId) {
      params.append('shiftId', shiftId);
    }
    const queryString = params.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/orders/today${queryString ? '?' + queryString : ''}`);

    // Новый backend: { success, data: { orders } }
    const orders = data.data?.orders || data.data || data.orders || [];

    // Soatlik rate = taom JORIY narxi (kesh). Bo'sh bo'lsa — menyuni
    // orqa fonda bir marta tortib keshlaymiz (keyingi yangilanishda to'g'ri).
    const _fpm = readFoodPriceMap();
    if (Object.keys(_fpm).length === 0) {
      try {
        this.getMenuItems().catch(() => {});
      } catch {
        /* ignore */
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return orders.map((order: any, index: number) => {
      // Новый формат: items[] (вместо старых selectFoods/allOrders)
      // Фильтруем isDeleted элементы
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (order.items || [])
        .filter((item: any) => !item.isDeleted)
        .map((item: any, idx: number) => ({
          _id: item._id || `item-${idx}`,
          name: item.foodId?.name || item.foodName || item.name || 'Неизвестно',
          quantity: item.quantity || 1,
          price: item.price || 0,
          status: item.status || item.kitchenStatus || 'pending',
          isDeleted: item.isDeleted || false,
          // Payment fields
          isPaid: item.isPaid || false,
          paidAt: item.paidAt,
          paymentSessionId: item.paymentSessionId,
          itemPaymentType: item.itemPaymentType,
          // Cancelled item fields
          isCancelled: item.status === 'cancelled',
          cancelledAt: item.cancelledAt,
          cancelledBy: item.cancelledBy,
          cancelReason: item.cancelReason,
          // Soatlik taom (PlayStation/bilyard) — daqiqali proratsiya uchun
          // kerakli maydonlar. Avval bular tashlab yuborilardi → renderer
          // item soatlik ekanini bilmay, narx 0 chiqardi.
          isHourly: item.isHourly === true,
          // Soatlik rate = taom JORIY narxi (kesh); statik qiymat zaxira.
          hourlyPrice:
            item.isHourly === true
              ? Number(_fpm[foodIdOf(item)]) || Number(item.hourlyPrice) || 0
              : Number(item.hourlyPrice) || 0,
          hourlyStartedAt: item.hourlyStartedAt,
          hourlyStoppedAt: item.hourlyStoppedAt,
          hourlyFinalAmount: item.hourlyFinalAmount,
          addedAt: item.addedAt,
        }));

      const tableNumber = order.tableId?.number || order.tableNumber || 0;
      const tableName = resolveTableName(order);

      // Тип заказа - saboy или dine-in
      const orderType = order.orderType || (order.isSaboy ? 'saboy' : undefined);
      const isSaboy = orderType === 'saboy';

      // Если backend не возвращает суммы, считаем на frontend
      // Не учитываем отменённые элементы
      const activeItems = items.filter((item: { status: string; isCancelled?: boolean }) => item.status !== 'cancelled' && !item.isCancelled);
      // Всегда считаем по активным элементам (отменённые не учитываются).
      // Soatlik item'lar DAQIQALI hisoblanadi (jonli) — itemLineTotal.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subtotal = activeItems.reduce((sum: number, item: any) => sum + itemLineTotal(item), 0);
      // #1/#2: услуга/chegирма — GLOBAL backend hisoblaydi, POS faqat
      // backend summasini ko'rsatadi (admin panel bilan AYNAN bir xil).
      const serviceChargePercent = Number(order.serviceChargePercent || 0);
      const discountPercent = Number(order.discountPercent || 0);
      const serviceCharge = Number(order.serviceCharge || 0);
      const discount = Number(order.discount || 0);
      const grandTotal = subtotal + serviceCharge - discount;

      // Статус оплаты: isPaid или status === 'paid'
      const isPaid = order.isPaid === true || order.status === 'paid';
      // Сохраняем статус отмены
      const isCancelled = order.status === 'cancelled';
      // Возврат / qisman to'lov — paymentStatus saqlanadi (refund UI + partial)
      const isRefunded = order.paymentStatus === 'refunded';
      const isPartial = order.paymentStatus === 'partiallyPaid';

      // Всегда используем grandTotal, рассчитанный по активным элементам
      const finalGrandTotal = grandTotal;

      // Offline yaratilgan order (hali VPS'ga ketmagan, raqam yo'q).
      // MUHIM: bunda orderNumber'ga index+1 BERMAYMIZ — ro'yxat tartibi
      // o'zgarganda raqam sakrab chalkashtirardi. Barqaror: 0 + isOffline.
      const isOffline =
        order._localOnly === true ||
        order.source === 'pos-monitor-offline' ||
        order.sync_status === 'local';

      return {
        _id: order._id,
        orderNumber: order.orderNumber || (isOffline ? 0 : index + 1),
        isOffline,
        orderType: orderType,
        saboyNumber: order.saboyNumber || order.orderNumber,
        tableId:
          (order.tableId && typeof order.tableId === 'object'
            ? order.tableId._id
            : order.tableId) || '',
        tableNumber,
        tableName: isSaboy ? 'Собой' : tableName,
        items,
        status: isCancelled || isRefunded ? 'cancelled' : isPaid ? 'paid' : 'active',
        paymentStatus: isRefunded ? 'refunded' : isPartial ? 'partiallyPaid' : isPaid ? 'paid' : 'pending',
        paymentType: order.paymentType,
        total: subtotal,
        serviceFee: serviceCharge,
        discount,
        serviceChargePercent,
        discountPercent,
        grandTotal: finalGrandTotal,
        waiter: {
          _id: order.waiterId?._id || order.waiterId || '',
          name: order.waiterId?.firstName
            ? `${order.waiterId.firstName} ${order.waiterId.lastName}`
            : (order.waiterName || 'Неизвестно'),
        },
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        // Данные почасовой оплаты (hourly charge)
        hasHourlyCharge: order.hasHourlyCharge || order.tableId?.hasHourlyCharge || false,
        hourlyChargeAmount: order.hourlyChargeAmount || order.tableId?.hourlyChargeAmount || 0,
        // Рассчитанные значения от backend (для оплаченных заказов)
        hourlyCharge: order.hourlyCharge || 0,
        hourlyChargeHours: order.hourlyChargeHours || 0,
      } as Order;
    });
  }

  async getDailySummary(shiftId?: string): Promise<DailySummary> {
    // Фильтр по ShiftId - получать статистику только текущей смены
    const params = new URLSearchParams();
    params.append('period', 'today');
    if (shiftId) {
      params.append('shiftId', shiftId);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/reports/dashboard?${params.toString()}`);

    const summary = data.data?.summary || data.summary || {};

    // Загружаем смену чтобы получить начальную кассу
    let openingCash = 0;
    try {
      const shift = await this.getActiveShift();
      openingCash = shift?.openingCash || 0;
    } catch {
      // Ignore
    }

    // По типам оплаты
    let cashRevenue = 0, cardRevenue = 0, clickRevenue = 0;
    try {
      const today = new Date().toISOString().split('T')[0];
      // Передаём ShiftId и в endpoint payments
      const paymentParams = new URLSearchParams();
      paymentParams.append('startDate', today);
      if (shiftId) {
        paymentParams.append('shiftId', shiftId);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paymentData = await this.request<any>(`/api/reports/payments?${paymentParams.toString()}`);
      const breakdown = paymentData.data?.paymentBreakdown || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cashRevenue = breakdown.find((p: any) => p.method === 'cash')?.total || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cardRevenue = breakdown.find((p: any) => p.method === 'card')?.total || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clickRevenue = breakdown.find((p: any) => p.method === 'click')?.total || 0;
    } catch {
      // Ignore payment report errors
    }

    // Получаем расходы и разделяем по типу оплаты (только для текущей смены)
    let cashExpenses = 0, clickExpenses = 0;
    try {
      const expenseParams = new URLSearchParams();
      if (shiftId) {
        expenseParams.append('shiftId', shiftId);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const expensesData = await this.request<any>(`/api/expenses?${expenseParams.toString()}`);
      const expenses = expensesData.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const expense of expenses) {
        // Учитываем только расходы (не приходы)
        if (expense.type === 'expense') {
          if (expense.paymentType === 'click') {
            clickExpenses += expense.amount || 0;
          } else {
            // cash или другой тип - из наличных
            cashExpenses += expense.amount || 0;
          }
        }
      }
    } catch {
      // Ignore expense errors
    }

    // Получаем авансы и вычитаем из наличных (только для текущей смены)
    let advancesCash = 0, advancesClick = 0;
    try {
      const advanceParams = new URLSearchParams();
      if (shiftId) {
        advanceParams.append('shiftId', shiftId);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const advancesData = await this.request<any>(`/api/advances?${advanceParams.toString()}`);
      const advances = advancesData.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const advance of advances) {
        if (advance.paymentType === 'click') {
          advancesClick += advance.amount || 0;
        } else {
          advancesCash += advance.amount || 0;
        }
      }
    } catch {
      // Ignore advances errors
    }

    // Общие расходы (expenses + advances)
    const totalCashExpenses = cashExpenses + advancesCash;
    const totalClickExpenses = clickExpenses + advancesClick;

    // Доступные средства = начальная касса + приход - расходы
    const availableCash = openingCash + cashRevenue - totalCashExpenses;
    const availableClick = clickRevenue - totalClickExpenses;

    return {
      totalRevenue: summary.totalRevenue || 0,
      totalOrders: summary.totalOrders || 0,
      cashRevenue,
      cardRevenue,
      clickRevenue,
      activeOrders: (summary.totalOrders || 0) - (summary.completedOrders || 0),
      paidOrders: summary.completedOrders || 0,
      cashExpenses: totalCashExpenses,
      clickExpenses: totalClickExpenses,
      availableCash,
      availableClick,
    };
  }

  async processPayment(
    orderId: string,
    paymentType: PaymentType,
    paymentSplit?: PaymentSplit,
    comment?: string,
  ): Promise<Order> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(
      `/api/orders/${orderId}/pay`,
      {
        method: "POST",
        body: JSON.stringify({
          paymentType: paymentType,
          paymentSplit,
          comment: comment,
        }),
      },
    );

    // Backend (VPS) javobi: { success, data: { order } } — order data.data.ORDER
    // ichida. Lokal (offline) handler esa { success, data: order } qaytaradi.
    // Avval `data.data || ...` edi → online'da order'ning O'RNIGA { order }
    // olinardi, order.items = undefined → chek "blyuda yo'q" deb JIM chiqmasdi.
    const order = data.data?.order || data.data || data.order || data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (order.items || [])
      .filter((item: any) => !item.isDeleted)
      .map((item: any, idx: number) => ({
        _id: item._id || `item-${idx}`,
        name: item.foodId?.name || item.foodName || item.name || 'Неизвестно',
        quantity: item.quantity || 1,
        price: item.price || 0,
        status: 'ready',
        isDeleted: item.isDeleted || false,
      }));

    // Тип заказа - saboy или dine-in
    const orderType = order.orderType || (order.isSaboy ? 'saboy' : undefined);
    const isSaboy = orderType === 'saboy';

    // Не учитываем отменённые элементы
    const activeItems = items.filter((item: { status: string }) => item.status !== 'cancelled');
    const subtotal = activeItems.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);
    // #1/#2: услуга/chegирма — GLOBAL VPS backend hisoblaydi va bazaga
    // yozadi. POS mijoz tomonda FOIZ HISOBLAMAYDI — backend bergan
    // serviceCharge/discount summasini KO'RSATADI (admin panel bilan
    // AYNAN bir xil). subtotal jonli (soatlik o'sib turadi) qoladi.
    const serviceChargePercent = Number(order.serviceChargePercent || 0);
    const discountPercent = Number(order.discountPercent || 0);
    const serviceCharge = Number(order.serviceCharge || 0);
    const discount = Number(order.discount || 0);
    const grandTotal = subtotal + serviceCharge - discount;

    const tableNumber = order.tableId?.number || 0;
    const tableName = isSaboy ? 'Собой' : `Стол ${tableNumber}`;

    return {
      _id: order._id,
      orderNumber: order.orderNumber || 1,
      orderType: orderType,
      saboyNumber: order.saboyNumber || order.orderNumber,
      tableNumber,
      tableName,
      items,
      status: 'paid',
      paymentStatus: 'paid',
      paymentType: order.paymentType,
      total: subtotal,
      serviceFee: serviceCharge,
      discount,
      serviceChargePercent,
      discountPercent,
      grandTotal: grandTotal,
      waiter: {
        _id: order.waiterId?._id || '',
        name: order.waiterId?.firstName
          ? `${order.waiterId.firstName} ${order.waiterId.lastName}`
          : 'Неизвестно',
      },
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      // Данные почасовой оплаты (hourly charge) - backend может вернуть напрямую или внутри tableId
      hasHourlyCharge: order.hasHourlyCharge || order.tableId?.hasHourlyCharge || false,
      hourlyChargeAmount: order.hourlyChargeAmount || order.tableId?.hourlyChargeAmount || 0,
    } as Order;
  }

  // ========== PARTIAL PAYMENT (Частичная оплата) ==========
  async processPartialPayment(
    orderId: string,
    itemIds: string[],
    paymentType: PaymentType,
    paymentSplit?: PaymentSplit,
    comment?: string,
  ): Promise<PartialPaymentResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(
      `/api/orders/${orderId}/pay-items`,
      {
        method: "POST",
        body: JSON.stringify({
          itemIds,
          paymentType,
          paymentSplit,
          comment,
        }),
      },
    );

    // VPS: { data: { order, paymentSession } }; lokal: { data: order }.
    const order = data.data?.order || data.data || data.order || data;
    const paymentSession = data.data?.paymentSession || data.paymentSession || null;

    // Transform order items (filter isDeleted)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: OrderItem[] = (order.items || [])
      .filter((item: any) => !item.isDeleted)
      .map((item: any, idx: number) => ({
        _id: item._id || `item-${idx}`,
        name: item.foodId?.name || item.foodName || item.name || 'Неизвестно',
        quantity: item.quantity || 1,
        price: item.price || 0,
        status: item.status || 'pending',
        isDeleted: item.isDeleted || false,
        isPaid: item.isPaid || false,
        paidAt: item.paidAt,
        paymentSessionId: item.paymentSessionId,
        itemPaymentType: item.itemPaymentType,
      }));

    const orderType = order.orderType || 'dine-in';
    const isSaboy = orderType === 'saboy';
    // Не учитываем отменённые элементы
    const activeItemsForCalc = items.filter(item => item.status !== 'cancelled');
    const subtotal = activeItemsForCalc.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // #1/#2: услуга/chegирма — GLOBAL VPS backend hisoblaydi va bazaga
    // yozadi. POS mijoz tomonda FOIZ HISOBLAMAYDI — backend bergan
    // serviceCharge/discount summasini KO'RSATADI (admin panel bilan
    // AYNAN bir xil). subtotal jonli (soatlik o'sib turadi) qoladi.
    const serviceChargePercent = Number(order.serviceChargePercent || 0);
    const discountPercent = Number(order.discountPercent || 0);
    const serviceCharge = Number(order.serviceCharge || 0);
    const discount = Number(order.discount || 0);
    const grandTotal = subtotal + serviceCharge - discount;
    const tableNumber = order.tableId?.number || 0;

    const transformedOrder: Order = {
      _id: order._id,
      orderNumber: order.orderNumber || 1,
      orderType: orderType,
      saboyNumber: order.saboyNumber,
      tableNumber,
      tableName: isSaboy ? 'Собой' : (order.tableId?.title || order.tableName || `Стол ${tableNumber}`),
      items,
      status: order.isPaid ? 'paid' : 'active',
      paymentStatus: order.isPaid ? 'paid' : 'pending',
      paymentType: order.paymentType,
      total: subtotal,
      serviceFee: serviceCharge,
      discount,
      serviceChargePercent,
      discountPercent,
      grandTotal: grandTotal,
      waiter: {
        _id: order.waiterId?._id || '',
        name: order.waiterId?.firstName
          ? `${order.waiterId.firstName} ${order.waiterId.lastName}`
          : (order.waiterName || 'Неизвестно'),
      },
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      // Данные почасовой оплаты (hourly charge) - backend может вернуть напрямую или внутри tableId
      hasHourlyCharge: order.hasHourlyCharge || order.tableId?.hasHourlyCharge || false,
      hourlyChargeAmount: order.hourlyChargeAmount || order.tableId?.hourlyChargeAmount || 0,
    };

    return {
      order: transformedOrder,
      paymentSession: {
        sessionId: paymentSession?.sessionId || '',
        paidItems: paymentSession?.paidItems || [],
        subtotal: paymentSession?.subtotal || 0,
        serviceCharge: paymentSession?.serviceCharge || 0,
        total: paymentSession?.total || 0,
        paymentType: paymentSession?.paymentType || paymentType,
        paidAt: paymentSession?.paidAt || new Date().toISOString(),
      },
      allItemsPaid: data.data?.allItemsPaid || false,
      remainingTotal: data.data?.remainingTotal || 0,
      paidTotal: data.data?.paidTotal || 0,
      unpaidTotal: data.data?.unpaidTotal || 0,
    };
  }

  async getWaiterStats(): Promise<
    { name: string; orders: number; revenue: number }[]
  > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>("/api/reports/staff");
    const staff = data.data?.staff || data.staff || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return staff.map((s: any) => ({
      name: s.name,
      orders: s.totalOrders || 0,
      revenue: s.totalRevenue || 0,
    }));
  }

  getStoredUser(): User | null {
    if (typeof window === "undefined") return null;
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  getStoredRestaurant(): Restaurant | null {
    if (typeof window === "undefined") return null;
    const restaurantStr = localStorage.getItem("restaurant");
    if (!restaurantStr) return null;

    try {
      const parsed = JSON.parse(restaurantStr);
      const r = {
        _id: parsed._id || parsed.id || '',
        name: parsed.name || '',
        currency: parsed.currency || 'UZS',
      };
      setCurrency(r.currency); // valyutani tiklash (app qayta ochilganda)
      return r;
    } catch {
      return null;
    }
  }

  // ========== SABOY ==========
  async createSaboyOrder(
    items: SaboyItem[],
    paymentType: PaymentType,
    paymentSplit?: PaymentSplit,
    comment?: string,
  ): Promise<{ success: boolean; saboyNumber: number; grandTotal: number; order?: Order }> {
    const restaurant = this.getStoredRestaurant();
    if (!restaurant) {
      throw new Error("Ресторан не найден");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>("/api/orders/saboy", {
      method: "POST",
      body: JSON.stringify({
        items: items.map(item => ({
          foodId: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        paymentMethod: paymentType,
        paymentSplit,
        notes: comment,
      }),
    });

    const o = data.data || data.order || data;
    return {
      success: data.success,
      saboyNumber: o?.orderNumber || 0,
      grandTotal: o?.finalTotal || o?.grandTotal || 0,
      // To'liq order obyekti — Dashboard state'iga darhol qo'shish uchun.
      // Backend response → Dashboard formatga moslashtirish (crash'siz).
      order: o && o._id ? mapBackendOrderToDashboard(o) : undefined,
    };
  }

  // ========== СТОЛЫ + НОВЫЙ ЗАКАЗ (dine-in) ==========
  async getTables(): Promise<
    { _id: string; title: string; number: number; status: string; occupied: boolean; categoryTitle: string }[]
  > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/tables');
    const list = data.data || data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = list.map((t: any) => ({
      _id: t._id,
      title: t.title || (t.number != null ? `Стол ${t.number}` : 'Стол'),
      number: t.number || 0,
      status: t.status || 'free',
      occupied: t.status === 'occupied' || !!t.activeOrderId,
      categoryTitle:
        (typeof t.categoryId === 'object' ? t.categoryId?.title : null) || t.categoryTitle || '',
    }));
    // Keshlab qo'yamiz — order ro'yxatida tableId populate bo'lmasa, stol
    // nomi shu yerdan aniqlanadi ("Неизвестный стол" o'rniga).
    try {
      const m: Record<string, string> = {};
      const cat: Record<string, string> = {};
      for (const t of mapped) {
        m[t._id] = t.title;
        if (t.categoryTitle) cat[t._id] = t.categoryTitle;
      }
      localStorage.setItem('tablesMap', JSON.stringify(m));
      // Stol kategoriyasi (этаж) keshi — order kartochkasida "Стол 1"
      // qaysi etajdaligini ko'rsatish uchun (bir xil raqamli stollar farqlanadi).
      localStorage.setItem('tableCatMap', JSON.stringify(cat));
    } catch {
      /* ignore */
    }
    return mapped;
  }

  async createOrder(
    tableId: string,
    waiterId: string | undefined,
    items: { foodId: string; name: string; price: number; quantity: number }[],
    meta?: { tableName?: string; tableNumber?: number; waiterName?: string },
  ): Promise<{ success: boolean; orderNumber: number; order?: Order; isNewOrder?: boolean }> {
    // MUHIM: nom (tableName/tableNumber/waiterName) ham yuboramiz. Offline'da
    // local-server mirror bo'sh/eskirgan bo'lsa, faqat id'dan stol/ofitsiant
    // topolmay "Стол 0 / Неизвестно" saqlanib qolardi — shu nomlarni
    // zaxira sifatida ishlatadi (mirror'ga qaram bo'lmaydi).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        tableId,
        waiterId: waiterId || undefined,
        orderType: 'dine-in',
        tableName: meta?.tableName || undefined,
        tableNumber: meta?.tableNumber ?? undefined,
        waiterName: meta?.waiterName || undefined,
        items: items.map((i) => ({ foodId: i.foodId, name: i.name, price: i.price, quantity: i.quantity })),
      }),
    });
    const o = data.data || data.order || data;
    // Backend response Mongoose order — populated waiterId/tableId, lekin
    // Dashboard.tsx 'Order' tipini kutadi (waiter.name, tableName, items).
    // Optimistic add qilishdan oldin minimal mapping qilamiz — aks holda
    // OrderCard `order.waiter.name` da crash bo'ladi.
    return {
      success: data.success !== false,
      orderNumber: o?.orderNumber || 0,
      order: o && o._id ? mapBackendOrderToDashboard(o) : undefined,
      isNewOrder: data.isNewOrder !== false,
    };
  }

  // ========== MENU (новый endpoint: /api/foods/menu) ==========
  async getMenuItems(): Promise<{ _id: string; name: string; price: number; category: string; categoryName?: string; isHourly?: boolean }[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.request<any>('/api/foods/menu');

    const menu = response.data || response || [];
    const foods: { _id: string; name: string; price: number; category: string; categoryName?: string; isHourly?: boolean }[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const category of menu) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const food of (category.foods || [])) {
        foods.push({
          _id: food._id,
          name: food.name,
          price: food.price || 0,
          category: category._id,
          categoryName: category.name,
          isHourly: food.isHourly === true,
        });
      }
    }

    // Soatlik rate uchun foodId→price keshi (getOrders shundan oladi).
    try {
      const pm: Record<string, number> = {};
      for (const f of foods) if (f._id && f.price > 0) pm[f._id] = f.price;
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem('foodPriceMap', JSON.stringify(pm));
      }
    } catch {
      /* ignore */
    }

    return foods;
  }

  // ========== CATEGORIES (новый endpoint: /api/categories) ==========
  async getCategories(): Promise<{ _id: string; title: string }[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.request<any>('/api/categories');
    const categories = response.data || response || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return categories.map((cat: any) => ({
      _id: cat._id,
      title: cat.name || cat.title || '',
    }));
  }

  // ========== ADD ITEMS TO ORDER ==========
  async addItemsToOrder(
    orderId: string,
    items: { foodId: string; name: string; price: number; quantity: number }[],
  ): Promise<Order> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });

    const order = data.data || data.order || data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderItems = (order.items || [])
      .filter((item: any) => !item.isDeleted)
      .map((item: any, idx: number) => ({
        _id: item._id || `item-${idx}`,
        name: item.foodId?.name || item.foodName || item.name || 'Неизвестно',
        quantity: item.quantity || 1,
        price: item.price || 0,
        status: item.status || item.kitchenStatus || 'pending',
        isDeleted: item.isDeleted || false,
        isPaid: item.isPaid || false,
        paidAt: item.paidAt,
        paymentSessionId: item.paymentSessionId,
        itemPaymentType: item.itemPaymentType,
      }));

    const orderType = order.orderType || 'dine-in';
    const isSaboy = orderType === 'saboy';
    const activeOrderItems = orderItems.filter((item: { status: string }) => item.status !== 'cancelled');
    const subtotal = activeOrderItems.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);
    // #1/#2: услуга/chegирма — GLOBAL VPS backend hisoblaydi va bazaga
    // yozadi. POS mijoz tomonda FOIZ HISOBLAMAYDI — backend bergan
    // serviceCharge/discount summasini KO'RSATADI (admin panel bilan
    // AYNAN bir xil). subtotal jonli (soatlik o'sib turadi) qoladi.
    const serviceChargePercent = Number(order.serviceChargePercent || 0);
    const discountPercent = Number(order.discountPercent || 0);
    const serviceCharge = Number(order.serviceCharge || 0);
    const discount = Number(order.discount || 0);
    const grandTotal = subtotal + serviceCharge - discount;
    const tableNumber = order.tableId?.number || 0;

    return {
      _id: order._id,
      orderNumber: order.orderNumber || 1,
      orderType: orderType,
      saboyNumber: order.saboyNumber,
      tableNumber,
      tableName: isSaboy ? 'Собой' : (order.tableId?.title || order.tableName || `Стол ${tableNumber}`),
      items: orderItems,
      status: order.isPaid ? 'paid' : 'active',
      paymentStatus: order.isPaid ? 'paid' : 'pending',
      paymentType: order.paymentType,
      total: subtotal,
      serviceFee: serviceCharge,
      discount,
      serviceChargePercent,
      discountPercent,
      grandTotal: grandTotal,
      waiter: {
        _id: order.waiterId?._id || '',
        name: order.waiterId?.firstName
          ? `${order.waiterId.firstName} ${order.waiterId.lastName}`
          : (order.waiterName || 'Неизвестно'),
      },
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      // Данные почасовой оплаты (hourly charge) - backend может вернуть напрямую или внутри tableId
      hasHourlyCharge: order.hasHourlyCharge || order.tableId?.hasHourlyCharge || false,
      hourlyChargeAmount: order.hourlyChargeAmount || order.tableId?.hourlyChargeAmount || 0,
    } as Order;
  }

  // ========== MERGE ORDERS ==========
  async mergeOrders(
    targetOrderId: string,
    sourceOrderIds: string[],
  ): Promise<{ success: boolean; message: string; mergedOrderIds: string[] }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/orders/merge', {
      method: 'POST',
      body: JSON.stringify({
        targetOrderId,
        sourceOrderIds,
      }),
    });

    return {
      success: data.success,
      message: data.message || 'Заказы объединены',
      mergedOrderIds: data.data?.mergedOrderIds || [],
    };
  }

  // Изменение количества блюда (например 10 → 2). quantity ≥ 1.
  // На бэке эмитит item_quantity_changed → кухня печатает «ОТКАЗ БЛЮДА».
  async updateItemQuantity(orderId: string, itemId: string, quantity: number, pin?: string): Promise<void> {
    await this.request(`/api/orders/${orderId}/items/${itemId}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity, pin: pin || undefined }),
    });
  }

  // Отмена позиции — блюдо убирается из заказа (на бэке "dec" cancel → effQty 0 →
  // total пересчитывается). Последнее блюдо удалить нельзя (отмените весь заказ).
  async cancelItem(orderId: string, itemId: string, reason?: string, pin?: string): Promise<void> {
    await this.request(`/api/orders/${orderId}/items/${itemId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: reason || null, pin: pin || undefined }),
    });
  }

  // Отмена всего заказа (isCancel). Оплаченный заказ отменить нельзя. Стол
  // освобождается автоматически (занятость считается по открытым заказам).
  async cancelOrder(orderId: string, reason?: string, pin?: string): Promise<void> {
    await this.request(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || null, pin: pin || undefined }),
    });
  }

  // KESHBEK — modul holati (tugma ko'rsatish uchun). Xato → o'chiq deb hisoblaymiz.
  async keshbekStatus(): Promise<{ enabled: boolean; percent: number }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = await this.request<any>('/api/keshbek/status');
      return d.data || { enabled: false, percent: 0 };
    } catch {
      return { enabled: false, percent: 0 };
    }
  }

  // KESHBEK balans (GLOBAL'dan, faqat online) — offline'da server 503 KESHBEK_OFFLINE.
  async keshbekBalance(phone: string): Promise<{ balance: number; percent?: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = await this.request<any>(`/api/keshbek/balance/${encodeURIComponent(phone)}`);
    return d.data || { balance: 0 };
  }

  // Vozvrat — to'langan orderni qaytarish (paymentStatus → refunded).
  async refundOrder(orderId: string, reason?: string, pin?: string): Promise<void> {
    await this.request(`/api/orders/${orderId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || null, pin: pin || undefined }),
    });
  }

  // #2: shu order uchun chegирма % (backend updateOrder → recalculateTotals).
  // FAQAT shu zakazga ta'sir qiladi; chekda ko'rsatiladi.
  async setOrderDiscount(orderId: string, discountPercent: number): Promise<void> {
    const p = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    await this.request(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ discountPercent: p }),
    });
  }

  // #1/#2: order'ning услуга% va/yoki chegирма%ini backendga yozadi
  // (updateOrder → recalculateTotals → grandTotal). Backend = yagona
  // haqiqat manbai → ekran, chek, hisobot bir xil bo'ladi.
  async setOrderCharges(
    orderId: string,
    body: { serviceChargePercent?: number; discountPercent?: number },
  ): Promise<void> {
    const patch: { serviceChargePercent?: number; discountPercent?: number } = {};
    if (body.serviceChargePercent !== undefined)
      patch.serviceChargePercent = Math.max(0, Math.min(100, Number(body.serviceChargePercent) || 0));
    if (body.discountPercent !== undefined)
      patch.discountPercent = Math.max(0, Math.min(100, Number(body.discountPercent) || 0));
    await this.request(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // ========== SHIFT (СМЕНА) ==========
  async getActiveShift(): Promise<Shift | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/shifts/active');
    const shift = data.data || null;
    // Himoya: yopilgan смена hech qachon "aktiv" deb qaytmasin (eski
    // mirror/stale javob "Активная смена не найдена" xatosini keltirib chiqaradi).
    if (shift && shift.status && shift.status !== 'active') return null;
    return shift;
  }

  // Открытие смены
  async openShift(openingCash: number, openingNotes?: string): Promise<Shift> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingCash, openingNotes }),
    });
    return data.data || data;
  }

  // Закрытие смены (POST /api/shifts/:id/close)
  async closeShift(shiftId: string, closingCash: number, closingNotes?: string): Promise<Shift> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify({ closingCash, closingNotes }),
    });
    return data.data || data;
  }

  async getAvailableCash(): Promise<{
    availableCash: number;
    openingCash: number;
    cashPayments: number;
    totalExpenses: number;
    totalAdvances: number;
    hasActiveShift: boolean;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/shifts/available-cash');
    return data.data || {
      availableCash: 0,
      openingCash: 0,
      cashPayments: 0,
      totalExpenses: 0,
      totalAdvances: 0,
      hasActiveShift: false,
    };
  }

  // Получение балансов наличных и click (для текущей смены)
  async getAvailableBalances(): Promise<{
    availableCash: number;
    availableClick: number;
    cashRevenue: number;
    clickRevenue: number;
    cashExpenses: number;
    clickExpenses: number;
  }> {
    try {
      // Получаем активную смену
      const shift = await this.getActiveShift();
      const shiftId = shift?._id;

      if (!shiftId) {
        return {
          availableCash: 0,
          availableClick: 0,
          cashRevenue: 0,
          clickRevenue: 0,
          cashExpenses: 0,
          clickExpenses: 0,
        };
      }

      // Получаем приходы
      let cashRevenue = 0, clickRevenue = 0;
      try {
        const today = new Date().toISOString().split('T')[0];
        const paymentParams = new URLSearchParams();
        paymentParams.append('startDate', today);
        paymentParams.append('shiftId', shiftId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paymentData = await this.request<any>(`/api/reports/payments?${paymentParams.toString()}`);
        const breakdown = paymentData.data?.paymentBreakdown || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cashRevenue = breakdown.find((p: any) => p.method === 'cash')?.total || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clickRevenue = breakdown.find((p: any) => p.method === 'click')?.total || 0;
      } catch {
        // Ignore
      }

      // Получаем расходы
      let cashExpenses = 0, clickExpenses = 0;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expensesData = await this.request<any>(`/api/expenses?shiftId=${shiftId}`);
        const expenses = expensesData.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const expense of expenses) {
          if (expense.type === 'expense') {
            if (expense.paymentType === 'click') {
              clickExpenses += expense.amount || 0;
            } else {
              cashExpenses += expense.amount || 0;
            }
          }
        }
      } catch {
        // Ignore
      }

      // Получаем авансы
      let advancesCash = 0, advancesClick = 0;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const advancesData = await this.request<any>(`/api/advances?shiftId=${shiftId}`);
        const advances = advancesData.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const advance of advances) {
          if (advance.paymentType === 'click') {
            advancesClick += advance.amount || 0;
          } else {
            advancesCash += advance.amount || 0;
          }
        }
      } catch {
        // Ignore
      }

      const totalCashExpenses = cashExpenses + advancesCash;
      const totalClickExpenses = clickExpenses + advancesClick;

      // Также учитываем начальную кассу!
      const openingCash = shift?.openingCash || 0;

      return {
        availableCash: openingCash + cashRevenue - totalCashExpenses,
        availableClick: clickRevenue - totalClickExpenses,
        cashRevenue,
        clickRevenue,
        cashExpenses: totalCashExpenses,
        clickExpenses: totalClickExpenses,
      };
    } catch {
      return {
        availableCash: 0,
        availableClick: 0,
        cashRevenue: 0,
        clickRevenue: 0,
        cashExpenses: 0,
        clickExpenses: 0,
      };
    }
  }

  // ========== EXPENSE CATEGORIES ==========
  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/expense-categories?active=true');
    return data.data || [];
  }

  // ========== EXPENSES ==========
  async createExpense(expenseData: {
    categoryId?: string;
    amount: number;
    description?: string;
    type?: 'expense' | 'income';
    paymentType?: 'cash' | 'click';
  }): Promise<Expense> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        ...expenseData,
        source: 'cashier',
        type: expenseData.type || 'expense',
        paymentType: expenseData.paymentType || 'cash',
      }),
    });
    return data.data;
  }

  // ========== WAITERS ==========
  async getWaiters(): Promise<Waiter[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/staff?role=waiter&active=true');
    const staff = data.data || [];
    // Backend ba'zан role bo'yicha filtrlamay hammasini qaytaradi —
    // FAQAT ofitsiantlar (role === 'waiter') qolsin.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return staff
      .filter((s: any) => {
        const r = String(s.role || s.type || '').toLowerCase();
        return r === '' ? true : r === 'waiter' || r === 'official' || r === 'ofitsiant';
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => ({
        _id: s._id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name || s.phone || '—',
        phone: s.phone,
      }));
  }

  // ========== ADVANCES ==========
  async createAdvance(advanceData: {
    waiterId: string;
    amount: number;
    description?: string;
    paymentType?: 'cash' | 'click';
  }): Promise<Advance> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/advances', {
      method: 'POST',
      body: JSON.stringify({
        ...advanceData,
        paymentType: advanceData.paymentType || 'cash',
      }),
    });
    return data.data;
  }

  // ========== ИСТОРИЯ КАССЫ ==========
  async getExpenses(startDate?: string, endDate?: string): Promise<Expense[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/expenses?${params.toString()}`);
    return data.data || [];
  }

  // Получение расходов по смене
  async getExpensesByShift(shiftId: string): Promise<Expense[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/expenses?shiftId=${shiftId}`);
    return data.data || [];
  }

  async getAdvances(startDate?: string, endDate?: string): Promise<Advance[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/advances?${params.toString()}`);
    return data.data || [];
  }

  // Получение авансов по смене
  async getAdvancesByShift(shiftId: string): Promise<Advance[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/advances?shiftId=${shiftId}`);
    return data.data || [];
  }

  // ========== ОТЧЁТЫ (Reports) ==========

  // Полный отчёт - для текущей смены
  async getFullReport(shiftId?: string): Promise<FullReport> {
    const params = new URLSearchParams();
    params.append('period', 'today');
    if (shiftId) {
      params.append('shiftId', shiftId);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/hisobot?${params.toString()}`);
    return data.data;
  }

  // Отменённые элементы (cancelled items)
  async getCancelledItems(shiftId?: string): Promise<CancelledItemsResponse> {
    const params = new URLSearchParams();
    if (shiftId) {
      params.append('shiftId', shiftId);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/orders/cancelled-items?${params.toString()}`);
    return data.data || { items: [], totalCancelledItems: 0, totalCancelledValue: 0 };
  }

  // Отчёт по кассирам
  async getCashierReport(shiftId?: string): Promise<CashierReportItem[]> {
    const params = new URLSearchParams();
    if (shiftId) {
      params.append('shiftId', shiftId);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>(`/api/reports/cashiers?${params.toString()}`);
    return data.data?.cashiers || [];
  }

  // ── Restoran sozlamalari: услуга% / chegирма% ──────────────────────
  async getRestaurantSettings(): Promise<{
    name: string;
    serviceChargeEnabled: boolean;
    serviceChargePercent: number;
    discountPercent: number;
    currency: string;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/restaurant/settings');
    const d = data.data || {};
    const currency = d.currency || 'KZT';
    setCurrency(currency); // serverdan eng yangi valyuta (eski keshlangan emas) → ekran to'g'ri
    // Eski (stale) localStorage valyutasini ham tuzatamiz — aks holda keyingi ochilishda
    // getStoredRestaurant() yana "сум"ni o'rnatadi (createSaboyOrder ham shuni chaqiradi).
    try {
      if (typeof window !== 'undefined') {
        const rs = localStorage.getItem('restaurant');
        if (rs) {
          const r = JSON.parse(rs);
          if (r && r.currency !== currency) {
            r.currency = currency;
            localStorage.setItem('restaurant', JSON.stringify(r));
          }
        }
      }
    } catch {
      /* noop */
    }
    return {
      name: d.branchName || d.name || '',
      serviceChargeEnabled: d.serviceChargeEnabled === true,
      serviceChargePercent: Number(d.serviceChargePercent || 0),
      discountPercent: Number(d.discountPercent || 0),
      currency,
    };
  }

  async updateRestaurantSettings(body: {
    serviceChargeEnabled?: boolean;
    serviceChargePercent?: number;
    discountPercent?: number;
  }): Promise<{
    serviceChargeEnabled: boolean;
    serviceChargePercent: number;
    discountPercent: number;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.request<any>('/api/restaurant/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const d = data.data || {};
    return {
      serviceChargeEnabled: d.serviceChargeEnabled === true,
      serviceChargePercent: Number(d.serviceChargePercent || 0),
      discountPercent: Number(d.discountPercent || 0),
    };
  }
}

// Report Types
export interface FullReport {
  period: {
    type: string;
    startDate?: string;
    endDate?: string;
  };
  sales: {
    totalRevenue: number;
    foodRevenue: number;
    serviceRevenue: number;
    hourlyChargeRevenue: number;
    totalChecks: number;
    averageCheck: number;
  };
  paymentMethods: {
    cash: { total: number; count: number; percentage: number };
    card: { total: number; count: number; percentage: number };
    click: { total: number; count: number; percentage: number };
    mixed: { count: number };
  };
  staff: {
    waiters: WaiterReportItem[];
    totalWaiterSalary: number;
    totalWaiters: number;
    cooks?: {
      _id: string;
      name: string;
      totalItems: number;
      dishes: { name: string; categoryName: string; quantity: number }[];
    }[];
    totalCooks?: number;
  };
  foods: {
    items: FoodReportItem[];
    totalFoodTypes: number;
    totalSold: number;
  };
  categories: {
    items: CategoryReportItem[];
    totalCategories: number;
  };
  hourly: {
    data: { hour: number; orderCount: number; revenue: number }[];
    peakHours: number[];
    maxRevenue: number;
    maxOrders: number;
  };
  profit: {
    netProfit: number;
    totalRevenue: number;
    waiterSalary: number;
    waiterSalaryPercent: number;
  };
}

export interface WaiterReportItem {
  _id: string;
  name: string;
  totalOrders: number;
  totalRevenue: number;
  serviceRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  salary: number;
  averageCheck: number;
}

export interface FoodReportItem {
  _id: string;
  name: string;
  categoryId?: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  price: number;
}

export interface CategoryReportItem {
  _id: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  itemCount: number;
  percentage: number;
}

export interface CancelledItem {
  type: 'order_cancelled' | 'item_cancelled';
  orderId: string;
  orderNumber: number;
  tableName: string;
  waiterName: string;
  foodName: string;
  quantity: number;
  price: number;
  total: number;
  cancelledAt: string;
  cancelledBy: string;
  cancelReason?: string;
}

export interface CancelledItemsResponse {
  items: CancelledItem[];
  totalCancelledItems: number;
  totalCancelledValue: number;
}

export interface CashierReportItem {
  _id: string;
  name: string;
  totalOrders: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  clickRevenue: number;
}

export const api = new ApiService();
