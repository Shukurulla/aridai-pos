// Soatlik taom (PlayStation, bilyard va h.k.) — DAQIQALI proratsiya.
// Soatiga `hourlyPrice` bo'lsa: 60 daqiqa = hourlyPrice, 20 daqiqa =
// (20/60)*hourlyPrice. Order'da JONLI ko'rinadi (vaqt o'tgani sayin oshadi),
// chekda ham shu hisoblangan summa chiqadi (0 emas).
//
// YAGONA MANBA: Dashboard, OrderDetail, Payment, chek — hammasi shu yerdan.
// (Avval bu Dashboard.tsx ichida edi; api.ts undan import qila olmasdi.)
import { Order, OrderItem } from '@/types';

// Bitta soatlik item: o'tgan daqiqa + hisoblangan summa.
// To'langan/to'xtatilgan bo'lsa — muzlatilgan yakuniy summa (oshmaydi).
export const computeHourlyForItem = (
  item: OrderItem,
  now: number,
): { totalMinutes: number; amount: number } => {
  if (!item.isHourly) return { totalMinutes: 0, amount: 0 };
  if (item.hourlyFinalAmount && item.hourlyFinalAmount > 0) {
    const start = item.hourlyStartedAt ? new Date(item.hourlyStartedAt).getTime() : 0;
    const stop = item.hourlyStoppedAt ? new Date(item.hourlyStoppedAt).getTime() : now;
    const minutes = Math.max(0, Math.floor((stop - start) / 60000));
    return { totalMinutes: minutes, amount: item.hourlyFinalAmount };
  }
  const start = item.hourlyStartedAt
    ? new Date(item.hourlyStartedAt).getTime()
    : item.addedAt
      ? new Date(item.addedAt).getTime()
      : now;
  const stop = item.hourlyStoppedAt ? new Date(item.hourlyStoppedAt).getTime() : now;
  const diffMs = Math.max(0, stop - start);
  const totalMinutes = Math.floor(diffMs / 60000);
  // DAQIQALI × MIQDOR: har daqiqa = hourlyPrice/60, har dona uchun alohida.
  // Mas. soatiga 1500, 3 ta PlayStation → 1 soat = 4500, 20 daqiqa = 1500.
  // amount = (diffMs/1soat) × hourlyPrice × quantity.
  const amount = Math.round((diffMs / 3600000) * (item.hourlyPrice || 0) * (item.quantity || 1));
  return { totalMinutes, amount };
};

export const formatDuration = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
};

// Stol/kabina darajasidagi soatlik haq (item emas, butun stol vaqti bo'yicha).
export const calculateHourlyCharge = (order: Order): { hours: number; charge: number } => {
  if (!order.hasHourlyCharge || !order.hourlyChargeAmount || order.hourlyChargeAmount <= 0) {
    return { hours: 0, charge: 0 };
  }
  const createdAt = new Date(order.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const hours = Math.max(1, Math.ceil(diffHours));
  const charge = hours * order.hourlyChargeAmount;
  return { hours, charge };
};

// Item qatori jami: soatlik bo'lsa DAQIQALI hisoblangan summa, aks holda
// price*miqdor. (api.ts subtotal, har joyda bir xil natija uchun.)
export const itemLineTotal = (item: OrderItem, now: number = Date.now()): number => {
  if (item && item.isHourly) return computeHourlyForItem(item, now).amount;
  return (item?.price || 0) * (item?.quantity || 1);
};

// Order'da JONLI o'sib turuvchi soatlik item bormi? (har daqiqa re-render —
// to'lov/detail ekranida summa vaqt o'tgani sayin yangilanib tursin).
export const hasLiveHourly = (items: OrderItem[]): boolean => {
  if (!Array.isArray(items)) return false;
  return items.some(
    (it) =>
      it &&
      it.isHourly &&
      !it.isPaid &&
      !it.hourlyStoppedAt &&
      (it.hourlyFinalAmount == null || it.hourlyFinalAmount <= 0) &&
      it.status !== 'cancelled' &&
      !it.isCancelled &&
      !it.isDeleted,
  );
};
