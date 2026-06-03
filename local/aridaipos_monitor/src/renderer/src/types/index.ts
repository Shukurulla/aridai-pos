export interface User {
  _id: string;
  name: string;
  phone: string;
  role: string;
  restaurantId: string;
  branchId?: string | null;
}

export interface Restaurant {
  _id: string;
  name: string;
}

export interface Branch {
  _id: string;
  name: string;
  isMain?: boolean;
}

export interface OrderItem {
  _id: string;
  name: string;
  quantity: number;
  price: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  readyAt?: string;
  // Cancelled item fields
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  // Soft delete
  isDeleted?: boolean;
  // Payment tracking per item
  isPaid?: boolean;
  paidAt?: string;
  paymentSessionId?: string;
  itemPaymentType?: PaymentType;
  // Soatlik xizmat (PlayStation, bilyard va h.k.)
  isHourly?: boolean;
  hourlyPrice?: number;
  hourlyStartedAt?: string;
  hourlyStoppedAt?: string;
  hourlyFinalAmount?: number;
  addedAt?: string;
}

export interface PartialPaymentSession {
  sessionId: string;
  paidItems: {
    itemId: string;
    foodName: string;
    quantity: number;
    price: number;
    subtotal: number;
  }[];
  subtotal: number;
  serviceCharge: number;
  total: number;
  paymentType: PaymentType;
  paidAt: string;
}

export interface PartialPaymentResult {
  order: Order;
  paymentSession: PartialPaymentSession;
  allItemsPaid: boolean;
  remainingTotal: number;
  paidTotal: number;
  unpaidTotal: number;
}

export type PaymentType = 'cash' | 'card' | 'click' | 'mixed';

export interface PaymentSplit {
  cash: number;
  card: number;
  click: number;
}

export type OrderType = 'dine-in' | 'saboy';

export interface Order {
  _id: string;
  orderNumber: number;
  // Offline yaratilgan, hali VPS raqami yo'q — UI'da "Офлайн" deb ko'rsatamiz
  // (oldin ro'yxat tartibiga qarab o'zgaruvchan index+1 chiqib chalkashtirardi)
  isOffline?: boolean;
  orderType?: OrderType;
  saboyNumber?: number;
  tableId?: string;
  tableNumber: number;
  tableName: string;
  // Stol kategoriyasi (этаж) nomi — bir xil raqamli stollarni farqlash uchun
  tableCategoryTitle?: string;
  items: OrderItem[];
  status: 'active' | 'paid' | 'cancelled';
  paymentStatus: 'pending' | 'paid';
  paymentType?: PaymentType;
  paymentSplit?: PaymentSplit;
  comment?: string;
  total: number;
  serviceFee: number;
  discount?: number;
  serviceChargePercent?: number;
  discountPercent?: number;
  grandTotal: number;
  waiter: {
    _id: string;
    name: string;
  };
  createdAt: string;
  paidAt?: string;
  // Почасовая оплата (hourly charge)
  hasHourlyCharge?: boolean;
  hourlyChargeAmount?: number;  // Почасовая цена
  hourlyCharge?: number;        // Рассчитанная общая плата за занятость
  hourlyChargeHours?: number;   // Сколько часов
}

// Данные блюд для собой
export interface SaboyItem {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface DailySummary {
  totalRevenue: number;
  totalOrders: number;
  cashRevenue: number;
  cardRevenue: number;
  clickRevenue: number;
  activeOrders: number;
  paidOrders: number;
  // По расходам
  cashExpenses: number;
  clickExpenses: number;
  // Доступные средства (приход - расход)
  availableCash: number;
  availableClick: number;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export interface PaymentData {
  orderId: string;
  orderNumber: number;
  tableName: string;
  waiterName: string;
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  serviceFee: number;
  serviceFeePercent?: number;
  discount?: number;
  discountPercent?: number;
  // Почасовая оплата (hourly charge)
  hourlyCharge?: number;
  hourlyHours?: number;
  total: number;
  paymentType: PaymentType;
  paymentSplit?: PaymentSplit;
  comment?: string;
  restaurantName: string;
  date: string;
  // Hujjat turi — prechek/to'lov/qisman bir-birini "dublikat" deb
  // o'tkazib yubormasligi uchun (Local Server dedupe imzosida ishlatiladi).
  docType?: 'precheck' | 'payment' | 'partial';
}

export type FilterType = 'active' | 'paid' | 'cancelled' | 'all';

// Shift (Smena) types
export interface Shift {
  _id: string;
  restaurantId: string;
  shiftNumber: number;
  status: 'active' | 'closed';
  openedAt: string;
  closedAt?: string;
  openedBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  closedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  openingCash: number;
  closingCash?: number;
  expectedClosingCash?: number;
  cashDifference?: number;
  stats?: ShiftStats;
  openingNotes?: string;
  closingNotes?: string;
  duration?: number;
  durationFormatted?: string;
}

export interface ShiftStats {
  totalOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  foodRevenue: number;
  serviceRevenue: number;
  cashPayments: number;
  cardPayments: number;
  clickPayments: number;
  mixedPayments: number;
  averageOrderValue: number;
  totalItemsSold: number;
  totalCancelledItems: number;
  cancelledItemsValue: number;
}

// ERP Types
export interface ExpenseCategory {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Expense {
  _id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  description?: string;
  source: 'cashier' | 'admin';
  type: 'expense' | 'income';
  paymentType: 'cash' | 'click';
  createdBy: string;
  createdAt: string;
}

export interface Advance {
  _id: string;
  waiterId: string;
  waiterName: string;
  amount: number;
  description?: string;
  paymentType: 'cash' | 'click';
  status: 'pending' | 'settled';
  createdBy: string;
  createdAt: string;
  settledAt?: string;
}

export interface Waiter {
  _id: string;
  name: string;
  phone: string;
}
