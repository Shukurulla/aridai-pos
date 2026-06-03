/**
 * Receipt Generator Utility
 * Профессиональный формат чека для термопринтера
 * Оптимизировано для 80мм принтера
 */

const SEP = '--------------------------------'; // 32 символа
const SEP_DOUBLE = '================================';

interface PaymentItem {
  foodName: string;
  quantity: number;
  price: number;
}

interface PaymentData {
  items: PaymentItem[];
  tableName: string;
  waiterName?: string;
  cashierName?: string;
  restaurantName: string;
  restaurantAddress?: string;
  itemsTotal: number;
  serviceFee?: number;
  discount?: number;
  // Почасовая оплата (hourly charge)
  hourlyCharge?: number;
  hourlyHours?: number;
  totalPrice: number;
  paymentType: 'cash' | 'card' | string;
  isPaid?: boolean;
}

interface ReportData {
  restaurantName: string;
  date?: string;
  totalOrders?: number;
  totalRevenue?: number;
  cashRevenue?: number;
  cardRevenue?: number;
  totalCash?: number;
  totalCard?: number;
  totalUnpaid?: number;
  waiterStats?: Array<{ name: string; orders: number; revenue: number }>;
}

interface WaiterData {
  name: string;
  cash: number;
  card: number;
  unpaid?: number;
}

interface WaiterReportData {
  restaurantName: string;
  waiters: WaiterData[];
}

interface CancelledItem {
  foodName: string;
  quantity: number;
  price: number;
}

interface CancelledReportData {
  restaurantName: string;
  items: CancelledItem[];
}

// Форматирование времени
function formatDateTime(date: Date | string = new Date()): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Форматирование цены
function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU').format(price || 0);
}

// Генерация HTML
function generateHTML(bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      width: 100%;
      padding: 2mm;
      background: white;
      color: black;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .header { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
    .subheader { font-size: 12px; }
    .large { font-size: 13px; font-weight: bold; }
    .footer { margin-top: 4px; }
    .sep { text-align: center; margin: 2px 0; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      white-space: nowrap;
      margin: 2px 0;
    }
    .left { flex: 1; }
    .right { text-align: right; margin-left: 6px; }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      font-weight: bold;
    }
    .item-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-qty { width: 15%; text-align: center; }
    .item-price {
      min-width: 24px;
      text-align: right;
      font-weight: bold;
    }
    .pending {
      border: 1px dashed #000;
      padding: 3px;
      margin: 3px 0;
      text-align: center;
      font-weight: bold;
    }
    .waiter-block { margin: 3px 0; padding: 2px 0; }
    .waiter-name { font-weight: bold; text-transform: uppercase; }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

// ==================== PUBLIC FUNCTIONS ====================

/**
 * Генерация тестового HTML чека
 */
export function generateTestReceiptHTML(restaurantName: string = 'KEPKET'): string {
  const content = `
<div class="center header">${restaurantName}</div>
<div class="sep">${SEP}</div>
<div class="center bold">TEST PRINT</div>
<div class="sep">${SEP}</div>
<div class="center">Принтер работает!</div>
<div class="center">${formatDateTime()}</div>
<div class="sep">${SEP}</div>
<div class="center bold footer">*** KEPKET ***</div>
`;
  return generateHTML(content);
}

/**
 * Генерация HTML чека оплаты
 */
export function generatePaymentReceiptHTML(data: PaymentData): string {
  const items = data.items || [];
  const isPaid = data.isPaid !== false;

  let itemsHtml = '';
  for (const item of items) {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    itemsHtml += `<div class="item-row"><span class="item-name">${item.foodName}</span><span class="item-qty">${item.quantity}</span><span class="item-price">${formatPrice(itemTotal)}</span></div>\n`;
  }

  const paymentTypeText = data.paymentType === 'cash' ? 'НАЛИЧНЫЕ' : data.paymentType === 'card' ? 'КАРТА' : data.paymentType.toUpperCase();

  const content = `
<div class="center header">${data.restaurantName || 'РЕСТОРАН'}</div>
${data.restaurantAddress ? `<div class="center">${data.restaurantAddress}</div>` : ''}
<div class="sep">${SEP}</div>
<div class="center bold">${isPaid ? "ЧЕК ОПЛАТЫ" : "СЧЁТ"}</div>
<div class="sep">${SEP}</div>
<div class="row"><span class="left">Дата:</span><span class="right">${formatDateTime()}</span></div>
<div class="row"><span class="left">Стол:</span><span class="right">${data.tableName || '-'}</span></div>
${data.waiterName ? `<div class="row"><span class="left">Официант:</span><span class="right">${data.waiterName}</span></div>` : ''}
${data.cashierName ? `<div class="row"><span class="left">Кассир:</span><span class="right">${data.cashierName}</span></div>` : ''}
<div class="sep">${SEP_DOUBLE}</div>
<div class="item-row bold"><span class="item-name">Товар</span><span class="item-qty">Кол-во</span><span class="item-price">Сумма</span></div>
<div class="sep">${SEP}</div>
${itemsHtml}
<div class="sep">${SEP_DOUBLE}</div>
<div class="row bold"><span class="left">Итого:</span><span class="right">${items.length} шт</span></div>
<div class="row"><span class="left">Блюда:</span><span class="right">${formatPrice(data.itemsTotal)} ₸</span></div>
${data.hourlyCharge && data.hourlyCharge > 0 ? `<div class="row"><span class="left">Занятость (${data.hourlyHours || 1} ч):</span><span class="right">${formatPrice(data.hourlyCharge)} ₸</span></div>` : ''}
${data.discount && data.discount > 0 ? `<div class="row"><span class="left">Скидка:</span><span class="right">-${formatPrice(data.discount)} ₸</span></div>` : ''}
<div class="row large"><span class="left">ИТОГО:</span><span class="right">${formatPrice(data.totalPrice)} ₸</span></div>
<div class="sep">${SEP}</div>
${isPaid ? `<div class="row"><span class="left">Тип оплаты:</span><span class="right bold">${paymentTypeText}</span></div>` : ''}
<div class="sep">${SEP_DOUBLE}</div>
${isPaid ? '<div class="center">Спасибо за покупку!</div>' : '<div class="pending">ОЖИДАЕТ ОПЛАТЫ</div>'}
<div class="sep">${SEP}</div>
<div class="center bold footer">*** KEPKET ***</div>
`;
  return generateHTML(content);
}

/**
 * Генерация HTML дневного отчёта
 */
export function generateReportReceiptHTML(data: ReportData): string {
  // Поддержка двух разных вариантов наименования
  const cashAmount = data.cashRevenue ?? data.totalCash ?? 0;
  const cardAmount = data.cardRevenue ?? data.totalCard ?? 0;
  const total = data.totalRevenue ?? (cashAmount + cardAmount);
  const dateStr = data.date || formatDateTime();

  const content = `
<div class="center header">ОТЧЁТ</div>
<div class="center subheader">ОБЩАЯ ВЫРУЧКА</div>
<div class="sep">${SEP}</div>
<div class="row"><span class="left">Заведение:</span><span class="right">${data.restaurantName || 'Ресторан'}</span></div>
<div class="row"><span class="left">Дата:</span><span class="right">${dateStr}</span></div>
${data.totalOrders !== undefined ? `<div class="row"><span class="left">Заказы:</span><span class="right">${data.totalOrders} шт</span></div>` : ''}
<div class="sep">${SEP_DOUBLE}</div>
<div class="row bold"><span class="left">Тип оплаты</span><span class="right">Сумма</span></div>
<div class="sep">${SEP}</div>
<div class="row"><span class="left">Наличные:</span><span class="right">${formatPrice(cashAmount)} ₸</span></div>
<div class="row"><span class="left">Карта:</span><span class="right">${formatPrice(cardAmount)} ₸</span></div>
${data.totalUnpaid !== undefined ? `<div class="row"><span class="left">Не оплачено:</span><span class="right">${formatPrice(data.totalUnpaid)} ₸</span></div>` : ''}
<div class="sep">${SEP_DOUBLE}</div>
<div class="row large"><span class="left">ИТОГО ВЫРУЧКА:</span><span class="right">${formatPrice(total)} ₸</span></div>
<div class="sep">${SEP}</div>
<div class="center bold footer">*** KEPKET ***</div>
`;
  return generateHTML(content);
}

/**
 * Генерация HTML отчёта по официантам
 */
export function generateWaiterReportHTML(data: WaiterReportData): string {
  const waiters = data.waiters || [];
  let totalAll = 0;
  waiters.forEach(w => {
    totalAll += (w.cash || 0) + (w.card || 0);
  });

  let waitersHtml = '';
  for (const waiter of waiters) {
    const waiterTotal = (waiter.cash || 0) + (waiter.card || 0);
    waitersHtml += `
<div class="waiter-block">
  <div class="waiter-name">${waiter.name || ''}</div>
  <div class="row"><span class="left">Наличные:</span><span class="right">${formatPrice(waiter.cash || 0)}</span></div>
  <div class="row"><span class="left">Карта:</span><span class="right">${formatPrice(waiter.card || 0)}</span></div>
  <div class="row"><span class="left">Не оплачено:</span><span class="right">${formatPrice(waiter.unpaid || 0)}</span></div>
  <div class="row bold"><span class="left">ИТОГО:</span><span class="right">${formatPrice(waiterTotal)}</span></div>
</div>
<div class="sep">${SEP}</div>
`;
  }

  const content = `
<div class="center header">ОТЧЁТ</div>
<div class="center subheader">ПО ОФИЦИАНТАМ</div>
<div class="sep">${SEP}</div>
<div class="row"><span class="left">Заведение:</span><span class="right">${data.restaurantName || 'Ресторан'}</span></div>
<div class="row"><span class="left">Дата:</span><span class="right">${formatDateTime()}</span></div>
<div class="sep">${SEP_DOUBLE}</div>
${waitersHtml}
<div class="sep">${SEP_DOUBLE}</div>
<div class="row large"><span class="left">ОБЩИЙ ИТОГ:</span><span class="right">${formatPrice(totalAll)} ₸</span></div>
<div class="sep">${SEP}</div>
<div class="center bold footer">*** KEPKET ***</div>
`;
  return generateHTML(content);
}

/**
 * Генерация HTML отчёта по отменённым позициям
 */
export function generateCancelledReportHTML(data: CancelledReportData): string {
  const items = data.items || [];
  let total = 0;
  items.forEach(item => {
    total += (item.price || 0) * (item.quantity || 1);
  });

  let itemsHtml = '';
  for (const item of items) {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    itemsHtml += `<div class="item-row"><span class="item-name">${item.foodName || ''}</span><span class="item-qty">${item.quantity || 1}</span><span class="item-price">${formatPrice(itemTotal)}</span></div>\n`;
  }

  const content = `
<div class="center header">ОТЧЁТ</div>
<div class="center subheader">ОТМЕНЁННЫЕ</div>
<div class="sep">${SEP}</div>
<div class="row"><span class="left">Заведение:</span><span class="right">${data.restaurantName || 'Ресторан'}</span></div>
<div class="row"><span class="left">Дата:</span><span class="right">${formatDateTime()}</span></div>
<div class="sep">${SEP_DOUBLE}</div>
<div class="item-row bold"><span class="item-name">Товар</span><span class="item-qty">Кол-во</span><span class="item-price">Сумма</span></div>
<div class="sep">${SEP}</div>
${itemsHtml}
<div class="sep">${SEP_DOUBLE}</div>
<div class="row large"><span class="left">ИТОГО:</span><span class="right">${formatPrice(total)} ₸</span></div>
<div class="sep">${SEP}</div>
<div class="center bold footer">*** KEPKET ***</div>
`;
  return generateHTML(content);
}

// Export types
export type { PaymentData, PaymentItem, ReportData, WaiterReportData, WaiterData, CancelledReportData, CancelledItem };
