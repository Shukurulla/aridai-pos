// Order total hisoblash — YAGONA haqiqat manbai (server authority).
// obsidian/05-data-model/biznes-mantiq/total-hisoblash.md
//
// MUHIM tartib (foydalanuvchi qarori — 2026-05-31, eski spec bekor qilindi):
//   1) subTotal  = taomlar yig'indisi (snapshot narx × effective qty)
//   2) service   = subTotal asosida (usluga foizi — chegirmadan OLDIN)
//   3) discount  = (subTotal + service) asosida  ← usluga QO'SHILGANdan KEYIN
//   4) tariff    = stol tarifi (alohida, service/discount'ga aralashmaydi)
//   5) total     = subTotal + tariff + service − discount
//
// Misol (foydalanuvchi): 2900 + service50%=1450 → discount=(2900+1450)×10%=435 → total=3915.
// MUHIM: local order-calc.js, order.routes recalcOrder va POS renderer bilan BIR XIL bo'lishi shart.

const round = (x) => Math.round(x);

// Taom miqdori inc/dec o'zgarishlari bilan
export function effectiveQuantity(item) {
  const cancels = Array.isArray(item.cancels) ? item.cancels : [];
  const inc = cancels.filter((c) => c.status === "inc").reduce((s, c) => s + c.changeVal, 0);
  const dec = cancels.filter((c) => c.status === "dec").reduce((s, c) => s + c.changeVal, 0);
  return Math.max(0, (item.quantity || 0) + inc - dec);
}

// Stol tarifi (hourly/fixed/daily)
export function calculateTariff(tariff) {
  if (!tariff || !tariff.chargeType) return 0;
  if (tariff.chargeType === "fixed") {
    return tariff.price || 0;
  }
  if (tariff.chargeType === "hourly") {
    const startedAt = tariff.startedAt ? new Date(tariff.startedAt).getTime() : Date.now();
    const elapsedMin = (Date.now() - startedAt) / 60000;
    const unit = tariff.duration || 60;
    const units = Math.max(1, Math.ceil(elapsedMin / unit));
    return units * (tariff.price || 0);
  }
  if (tariff.chargeType === "daily") {
    const startedAt = tariff.startedAt ? new Date(tariff.startedAt).getTime() : Date.now();
    const days = Math.max(1, Math.ceil((Date.now() - startedAt) / (24 * 3600 * 1000)));
    return days * (tariff.price || 0);
  }
  return 0;
}

// Order narxlarini hisoblaydi va order obyektiga yozadi (mutate).
// order.foods, order.service.percent, order.discount{type,percent,amount}, order.selectedTariff
export function calculateOrderTotals(order) {
  // === 1. subTotal ===
  const foods = Array.isArray(order.foods) ? order.foods : [];
  const subTotal = foods.reduce((sum, item) => sum + (item.foodPrice || 0) * effectiveQuantity(item), 0);
  order.subTotal = subTotal;

  // === 2. tariffAmount (alohida) ===
  let tariffAmount = 0;
  if (order.selectedTariff?.chargeType) {
    tariffAmount = calculateTariff(order.selectedTariff);
    order.selectedTariff.totalAmount = tariffAmount;
  }

  // === 3. serviceAmount (subTotal asosida — chegirmadan OLDIN) ===
  let serviceAmount = 0;
  const servicePercent = order.service?.waived ? 0 : order.service?.percent || 0;
  if (servicePercent > 0) {
    serviceAmount = round((subTotal * servicePercent) / 100);
  }
  if (order.service) order.service.amount = serviceAmount;

  // === 4. discountAmount ((subTotal + service) asosida — usluga QO'SHILGAN summadan) ===
  const discountBase = subTotal + serviceAmount;
  let discountAmount = 0;
  if (order.discount && (order.discount.percent || order.discount.amount)) {
    if (order.discount.type === "amount") {
      discountAmount = Math.min(order.discount.amount || 0, discountBase);
    } else {
      discountAmount = round((discountBase * (order.discount.percent || 0)) / 100);
    }
  }
  discountAmount = Math.max(0, Math.min(discountAmount, discountBase));
  order.discountAmount = discountAmount;

  // === 5. totalPrice ===
  const totalPrice = subTotal + tariffAmount + serviceAmount - discountAmount;
  if (totalPrice < 0) {
    throw new Error("NEGATIVE_TOTAL: discount > subTotal — hisob xatosi");
  }
  order.totalPrice = totalPrice;

  return {
    subTotal,
    tariffAmount,
    discountAmount,
    serviceAmount,
    totalPrice,
  };
}
