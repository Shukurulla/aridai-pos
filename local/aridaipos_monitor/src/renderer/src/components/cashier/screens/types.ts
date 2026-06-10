import { Order, DailySummary, Shift, PaymentType, PaymentSplit, PartialPaymentResult, User, Restaurant, Branch } from '@/types';
import { Screen } from '../shell';

export interface ScreenCtx {
  go: (s: Screen) => void;
  screen: Screen;
  orders: Order[];
  summary: DailySummary;
  activeShift: Shift | null;
  user: User | null;
  restaurant: Restaurant | null;
  branch: Branch | null;
  isConnected: boolean;
  // POS rejimi: VPS bilan online'mi (true) yoki offline (local-server)mi.
  // Online'da order kartochkasida "Детали" tugmasi ko'rsatilmaydi.
  posOnline: boolean;
  // Filial услуга/chegirma sozlamasi (GLOBAL backend = manba). Kartochka,
  // to'lov, chek — hammasi shu bitta manbadan hisoblaydi (divergensiya yo'q).
  branchSvc: { en: boolean; pct: number; disc: number };
  // Order stoli kategoriyasi (этаж) nomi — tableId yoki tableName bo'yicha.
  tableCategory: (o: { tableId?: string; tableName?: string; orderType?: string }) => string;

  // Current order context (detail / payment / addItems)
  currentOrder: Order | null;
  setCurrentOrderId: (id: string | null) => void;

  // Merge mode
  mergeSelection: string[];
  setMergeSelection: (ids: string[]) => void;

  // Data + actions
  reload: (shiftId?: string) => Promise<void>;
  onPay: (
    orderId: string,
    paymentType: PaymentType,
    paymentSplit?: PaymentSplit,
    comment?: string,
  ) => Promise<void>;
  onPartialPay: (
    orderId: string,
    itemIds: string[],
    paymentType: PaymentType,
    paymentSplit?: PaymentSplit,
    comment?: string,
  ) => Promise<PartialPaymentResult>;
  onPrint: (order: Order) => Promise<void> | void;
  onAddItemsSuccess: (order: Order) => void;
  // Yangi zakaz yaratilganda (+ Новый заказ / Собой) — backend response'dagi
  // to'liq order'ni darhol state'ga qo'shadi. Reload race condition'ini
  // chetlab o'tadi (povorga check ketdi-yu, lekin Dashboard'da ko'rinmadi).
  onOrderCreated: (order: Order) => void;
  onShiftChanged: (shift: Shift | null) => void;
  onChangeItemQty: (orderId: string, itemId: string, quantity: number, pin?: string) => Promise<void>;
  // Позицию убрать из заказа (отмена блюда). Последнее блюдо удалить нельзя.
  onCancelItem: (orderId: string, itemId: string, reason?: string, pin?: string) => Promise<void>;
  // Отменить весь заказ (isCancel). Оплаченный нельзя.
  onCancelOrder: (orderId: string, reason?: string, pin?: string) => Promise<void>;
  // Возврат оплаченного заказа (paymentStatus → refunded).
  onRefund: (orderId: string, reason?: string, pin?: string) => Promise<void>;
  onLogout: () => void;
}
