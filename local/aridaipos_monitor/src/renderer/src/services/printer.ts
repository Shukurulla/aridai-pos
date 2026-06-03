import { PrinterInfo, PaymentData } from '@/types';

// AridaiPOS Local Server printer-hub.
// Priority bo'yicha:
//  1) __API_BASE__ (preload injekt),
//  2) 'hub-url' (Settings → Local Server Hub — barcha API requestlar uchun ham
//     shu key ishlatiladi, izchillik uchun),
//  3) 'printHubUrl' (eski key — orqaga muvofiqlik),
//  4) default localhost:3011.
function readPrintHubUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:4561';
  try {
    const injected = (window as unknown as { __API_BASE__?: string }).__API_BASE__;
    if (injected) return injected;
    const hubUrl = localStorage.getItem('hub-url');
    if (hubUrl) return hubUrl.trim().replace(/\/+$/, '');
    const legacy = localStorage.getItem('printHubUrl');
    if (legacy) return legacy.trim().replace(/\/+$/, '');
  } catch {
    /* ignore */
  }
  return 'http://localhost:4561';
}
const PRINT_SERVER_URL = readPrintHubUrl();

// Electron pos-monitor: so'rov MAIN process orqali (window.pos.hub) —
// internet uzilganda ham localhost'ga kira oladi (Node, Chromium emas).
// Web: oddiy fetch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hubCall(method: string, path: string, body?: unknown): Promise<any> {
  const hub =
    typeof window !== 'undefined'
      ? (
          window as unknown as {
            pos?: {
              hub?: {
                request: (
                  m: string,
                  p: string,
                  b?: unknown,
                ) => Promise<{ success: boolean; data?: unknown; error?: unknown }>;
              };
            };
          }
        ).pos?.hub
      : undefined;
  if (hub) {
    const r = await hub.request(method, path, body);
    if (!r || r.success === false) {
      const e = r && (r as { error?: unknown }).error;
      const msg =
        (e && typeof e === 'object' && (e as { message?: string }).message) ||
        (typeof e === 'string' ? e : '') ||
        'Сервер недоступен';
      return { success: false, error: msg };
    }
    return r.data;
  }
  const res = await fetch(`${PRINT_SERVER_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export const PrinterAPI = {
  async getPrinters(): Promise<PrinterInfo[]> {
    try {
      const data = await hubCall('GET', '/printers');
      return data?.printers || [];
    } catch (error) {
      console.error('Failed to get printers:', error);
      return [];
    }
  },

  // Чек оплаты - профессиональная печать через C# TSPL
  async printPayment(paymentData: PaymentData, printerName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Принтер выбирать в POS не нужно — Local Server сам направит чек на
      // принтер с привязанным логином КАССИРА. printerName опционален.
      return await hubCall('POST', '/print/payment', {
        printerName: printerName || undefined,
        docType: paymentData.docType || 'payment',
        restaurantName: paymentData.restaurantName,
        tableName: paymentData.tableName,
        // Zakaz raqami + _id — chekda aniq order ko'rsatish uchun
        // (foydalanuvchi talabi: har chek o'z zakazi bilan, chalkashlik yo'q).
        orderNumber: paymentData.orderNumber,
        orderId: paymentData.orderId,
        waiterName: paymentData.waiterName,
        items: paymentData.items.map(item => ({
          foodName: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        itemsTotal: paymentData.subtotal,
        // #1/#2: услуга / chegирма chekda ko'rsatilsin (avval 0 edi).
        serviceFee: paymentData.serviceFee || 0,
        serviceFeePercent: paymentData.serviceFeePercent || 0,
        hourlyCharge: paymentData.hourlyCharge,
        hourlyHours: paymentData.hourlyHours,
        totalPrice: paymentData.total,
        discount: paymentData.discount || 0,
        discountPercent: paymentData.discountPercent || 0,
      });
    } catch (error) {
      console.error('Failed to print payment:', error);
      return { success: false, error: 'Не удалось подключиться к серверу принтера' };
    }
  },

  // Тестовая печать - через C# TSPL
  async printTest(printerName?: string, restaurantName: string = 'KEPKET'): Promise<{ success: boolean; error?: string }> {
    try {
      return await hubCall('POST', '/print/test', {
        printerName: printerName || undefined,
        restaurantName
      });
    } catch (error) {
      console.error('Failed to print test:', error);
      return { success: false, error: 'Не удалось подключиться к серверу принтера' };
    }
  },

  // Дневной отчёт - через C# TSPL
  async printDailyReport(reportData: {
    restaurantName: string;
    date?: string;
    totalOrders?: number;
    totalRevenue?: number;
    cashRevenue?: number;
    cardRevenue?: number;
    waiterStats?: Array<{ name: string; orders: number; revenue: number }>;
  }, printerName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Создание отчёта в текстовом формате
      const lines: string[] = [];
      lines.push(reportData.restaurantName || 'РЕСТОРАН');
      lines.push('================================');
      lines.push('ДНЕВНОЙ ОТЧЁТ');
      lines.push('================================');
      lines.push(`Дата: ${reportData.date || new Date().toLocaleDateString('ru-RU')}`);
      if (reportData.totalOrders !== undefined) {
        lines.push(`Заказы: ${reportData.totalOrders} шт`);
      }
      lines.push('--------------------------------');
      if (reportData.cashRevenue !== undefined) {
        lines.push(`Наличные: ${reportData.cashRevenue.toLocaleString()} ₸`);
      }
      if (reportData.cardRevenue !== undefined) {
        lines.push(`Карта: ${reportData.cardRevenue.toLocaleString()} ₸`);
      }
      lines.push('================================');
      if (reportData.totalRevenue !== undefined) {
        lines.push(`ИТОГО: ${reportData.totalRevenue.toLocaleString()} ₸`);
      }

      // Статистика по официантам
      if (reportData.waiterStats && reportData.waiterStats.length > 0) {
        lines.push('--------------------------------');
        lines.push('ОФИЦИАНТЫ:');
        lines.push('--------------------------------');
        for (const waiter of reportData.waiterStats) {
          lines.push(`${waiter.name}: ${waiter.orders} шт, ${waiter.revenue.toLocaleString()}`);
        }
      }

      lines.push('================================');

      return await hubCall('POST', '/print/raw', {
        printerName: printerName || undefined,
        text: lines.join('\n')
      });
    } catch (error) {
      console.error('Failed to print daily report:', error);
      return { success: false, error: 'Не удалось подключиться к серверу принтера' };
    }
  },

  // Проверка соединения с сервером принтера
  async checkConnection(): Promise<boolean> {
    try {
      const d = await hubCall('GET', '/health');
      return !!d && d.success !== false;
    } catch {
      return false;
    }
  },

  // ============================================================
  // YANGI STRUKTURALI PRINT API (alohida — eski raw print bilan
  // birga ishlaydi. Print server payloadni o'zi formatlab chiqaradi)
  // ============================================================

  /**
   * ПРОДАННЫЕ БЛЮДА — kategoriyalar bo'yicha guruhlangan
   * POST /print/sold-foods
   */
  async printSoldFoods(payload: SoldFoodsPayload, printerName?: string): Promise<PrintResponse> {
    return postStructured('/print/sold-foods', payload, printerName);
  },

  /**
   * ПРОДАЖИ ПО КУХНЯМ — oshxonalar bo'yicha guruhlangan
   * POST /print/by-kitchen
   */
  async printByKitchen(payload: ByKitchenPayload, printerName?: string): Promise<PrintResponse> {
    return postStructured('/print/by-kitchen', payload, printerName);
  },

  /**
   * ОБЩАЯ ВЫРУЧКА / СУТОЧНЫЙ ОТЧЁТ — moslashuvchan sections
   * POST /print/revenue
   */
  async printRevenue(payload: RevenuePayload, printerName?: string): Promise<PrintResponse> {
    return postStructured('/print/revenue', payload, printerName);
  },

  /**
   * ОТМЕНЁННЫЕ — bekor qilingan itemlar/orderlar ro'yxati
   * POST /print/cancelled
   */
  async printCancelled(payload: CancelledPayload, printerName?: string): Promise<PrintResponse> {
    return postStructured('/print/cancelled', payload, printerName);
  },

  /**
   * ПО ОФИЦИАНТАМ — ofitsiantlar reytingi
   * POST /print/waiters
   */
  async printWaiters(payload: WaitersPayload, printerName?: string): Promise<PrintResponse> {
    return postStructured('/print/waiters', payload, printerName);
  },

  /**
   * АКТ РЕАЛ — to'liq smena akti (sotilgan taomlar + Итоговый отчёт).
   * POST /print/act-real
   */
  async printActReal(payload: ActRealPayload, printerName?: string): Promise<PrintResponse> {
    return postStructured('/print/act-real', payload, printerName);
  }
};

/* ---------- /print/act-real ---------- */
export interface ActRealItem {
  name: string;
  qty: number;
  price: number;
  sum: number;
}
export interface ActRealPayload {
  printerName: string;
  header: PrintHeader;
  currency: string;
  shift?: { from?: string; to?: string };
  items: ActRealItem[];
  totals: { qty: number; sum: number };
  summary: {
    totalChecks: number;
    orderPositions: number;
    refusalChecks: number;
    refusalPositions: number;
    refusalSum: number;
    guests: number;
    transfers: number;
    unlocks: number;
  };
  payments: { name: string; sum: number }[];
  paymentsTotal: number;
  staff: { name: string; count: number; service: number; sum: number }[];
  subdivisions: { name: string; count: number; service: number; sum: number }[];
  subTotal?: { count: number; service: number; sum: number };
  clients: {
    name: string;
    checks: number;
    orders: number;
    sum: number;
    sumNoDiscount: number;
  }[];
}

// ==================================================================
// Common types for new structured print API
// ==================================================================

export type PrintResponse =
  | { success: true; skipped?: boolean }
  | { success: false; error: string };

export interface PrintHeader {
  restaurantName: string;
  /** Свободная строка — "15.05.2026", "01-15 мая 2026", "01.05 — 15.05.2026" */
  date: string;
  title: string;
}

interface BasePayload {
  printerName: string;
  header: PrintHeader;
  /** Всегда "₸" — сервер маппит на принтер */
  currency: string;
}

/* ---------- /print/sold-foods ---------- */

export interface SoldFoodsCategory {
  name: string;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  subtotal: number;
}

export interface SoldFoodsPayload extends BasePayload {
  categories: SoldFoodsCategory[];
  grandTotal: number;
}

/* ---------- /print/by-kitchen ---------- */

export interface KitchenGroup {
  name: string;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  subtotal: number;
}

export interface ByKitchenPayload extends BasePayload {
  kitchens: KitchenGroup[];
  grandTotal: number;
}

/* ---------- /print/revenue ---------- */

/**
 * Revenue row — 2 ta shakl:
 *  - amount (pul) + count (optional, chek soni)
 *  - value (ixtiyoriy matn — sanoq raqamlari yoki bo'lak matn)
 */
export type RevenueRow =
  | { label: string; amount: number; count?: number }
  | { label: string; value: string };

export interface RevenueSection {
  title: string;
  rows: RevenueRow[];
  subtotal?: number;
}

export interface RevenuePayload extends BasePayload {
  sections: RevenueSection[];
  grandTotal?: number;
}

/* ---------- /print/cancelled ---------- */

export interface CancelledItem {
  /** HH:MM yoki to'liq sana */
  time: string;
  tableName: string;
  foodName: string;
  qty: number;
  total: number;
  reason?: string;
  cancelledBy?: string;
}

export interface CancelledPayload extends BasePayload {
  items: CancelledItem[];
  totalCount: number;
  grandTotal: number;
}

/* ---------- /print/waiters ---------- */

export interface WaiterRow {
  name: string;
  ordersCount: number;
  guestsCount?: number;
  totalRevenue: number;
  averageCheck?: number;
}

export interface WaitersPayload extends BasePayload {
  waiters: WaiterRow[];
  grandTotal: number;
}

// ==================================================================
// Internal helper — printerName ni avtomatik to'ldirish + POST
// ==================================================================

async function postStructured(
  path: string,
  payload: SoldFoodsPayload | ByKitchenPayload | RevenuePayload | CancelledPayload | WaitersPayload,
  printerName?: string
): Promise<PrintResponse> {
  try {
    // Local Server сам направит на принтер с логином КАССИРА
    const body = {
      ...payload,
      printerName: printerName || undefined,
      currency: payload.currency || '₸'
    };

    return await hubCall('POST', path, body);
  } catch (error) {
    console.error(`Failed to print ${path}:`, error);
    return { success: false, error: 'Не удалось подключиться к серверу принтера' };
  }
}
