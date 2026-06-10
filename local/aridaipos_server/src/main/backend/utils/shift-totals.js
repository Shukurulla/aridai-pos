// Smena yopilganda totals — YAGONA hisob (global + local BIR XIL bo'lishi shart).
// BARCHA to'lov turlari: cash/card/transfer/kaspi + mixed (split) + cashback +
// chegirma/usluga yig'indisi + bekor qilingan orderlar. Aks holda offline yopilgan
// smena to'liqsiz raqamni global'ga yozadi (kassa farqi, hisobot noto'g'ri).
//
// orders — smenaning BARCHA orderlari (find { shift: id }). Funksiya ichida paid/cancel
// filtrlanadi. Qaytadi: { ordersCount, revenue, cashRevenue, cardRevenue,
//   transferRevenue, kaspiRevenue, cashbackUsed, discountTotal, serviceTotal, cancelledOrders }.
export function computeShiftTotals(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const notCancelled = list.filter((o) => !o.isCancel);
  const paid = notCancelled.filter((o) => o.paymentStatus === "paid");
  const refunded = notCancelled.filter((o) => o.paymentStatus === "refunded");

  const t = {
    ordersCount: notCancelled.length,
    revenue: 0,
    cashRevenue: 0,
    cardRevenue: 0,
    transferRevenue: 0,
    kaspiRevenue: 0,
    cashbackUsed: 0,
    discountTotal: 0,
    serviceTotal: 0,
    cancelledOrders: list.length - notCancelled.length,
    // Vozvrat — qaytarilgan orderlar revenue'ga KIRMAYDI (paid emas), alohida ko'rsatkich.
    refundsCount: refunded.length,
    refundsTotal: refunded.reduce((s, o) => s + (o.totalPrice || 0), 0),
  };

  for (const o of paid) {
    const total = o.totalPrice || 0;
    t.revenue += total;
    t.discountTotal += o.discountAmount || 0;
    t.serviceTotal += o.service?.amount || 0;
    t.cashbackUsed += o.cashback?.spent || 0;

    const m = o.paymentMethod;
    if (m === "cash") t.cashRevenue += total;
    else if (m === "card") t.cardRevenue += total;
    else if (m === "transfer") t.transferRevenue += total;
    else if (m === "kaspi") t.kaspiRevenue += total;
    else if (m === "mixed") {
      t.cashRevenue += o.mixed?.cash || 0;
      t.cardRevenue += o.mixed?.card || 0;
      t.transferRevenue += o.mixed?.transfer || 0;
      t.kaspiRevenue += o.mixed?.kaspi || 0;
    } else if (m === "cashback") {
      // To'liq keshbek bilan to'langan — pul kassaga kirmaydi (cashbackUsed'da hisoblanadi)
    } else {
      t.cashRevenue += total; // noma'lum usul → naqd deb hisoblaymiz (yo'qolmasin)
    }
  }

  return t;
}
