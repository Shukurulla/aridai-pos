// Chek HTML shabloni — TOZA (Electron'ga bog'liq emas). Backend ham, main ham
// import qila oladi. Print (HTML→PDF→printer) esa print.js'da (Electron).
// Dizayn: VECTOR STYLE — jadval ko'rinish, nuqtali leader'lar.

export const esc = (s) =>
  String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

export const fmt = (n) => Number(n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

// Restoran valyutasi → belgi (obsidian: yaratilgach o'zgarmaydi)
export function currencyLabel(code) {
  const c = String(code || "UZS").toUpperCase();
  if (c === "KZT") return "₸";
  if (c === "RUB") return "₽";
  if (c === "USD") return "$";
  return "сум"; // UZS
}

// Nuqtali leader qatori (label ······· value) — flexbox (toza, ASCII chiziq emas)
function leaderRow(label, value, opts = {}) {
  const big = opts.big ? "font-size:15px;font-weight:900;" : "";
  const italic = opts.italic ? "font-style:italic;" : "";
  const vstyle = `white-space:nowrap;font-weight:800;${big}${italic}`;
  return `<div style="display:flex;align-items:flex-end;margin:4px 0;${big}${italic}">
    <span style="white-space:nowrap;padding-bottom:1px;">${esc(label)}</span>
    <span style="flex:1 1 auto;border-bottom:2px dotted #000;margin:0 6px 4px;min-width:14px;"></span>
    <span style="${vstyle}">${esc(value)}</span>
  </div>`;
}

// ===== To'lov cheki — VECTOR STYLE =====
export function buildReceiptHtml(data = {}) {
  const {
    brand = "AridaiPOS",
    branchName,
    logo, // base64 data URL — bo'lsa brend tepasida ko'rsatiladi
    receiptNumber,
    date = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" }),
    sellerName,
    tableName,
    clientName,
    clientPhone,
    items = [],
    subtotal = 0,
    discountTotal = 0,
    discountPercent = 0,
    serviceAmount = 0,
    servicePercent = 0,
    total = 0,
    paymentLabel,
    mixedSplit, // { cash, card, transfer } — aralash to'lov bo'lganda
    statusLabel, // "ОПЛАЧЕНО" / "ОТМЕНЕНО" — bo'lsa footer o'rniga (pastda)
    cashbackQr, // { dataUrl, earnAmount } — keshbek QR (toggle yoqiq bo'lsa)
    currency = "UZS",
    footer = "Спасибо за покупку!",
  } = data;

  const CUR = currencyLabel(currency);
  const sep = `<div style="border-top:2px dotted #000;margin:8px 0;"></div>`;
  const metaLine = (l, v) =>
    `<div style="margin:3px 0;"><b style="font-weight:800;">${esc(l)}:</b> ${esc(v)}</div>`;

  const itemsHtml = items
    .map((it, i) => {
      const meta = [it.meta, it.variant].filter(Boolean).map(esc).join(" / ");
      const head = `<div style="font-weight:800;margin:8px 0 2px;">${i + 1}. ${esc(it.name)}${meta ? " / " + meta : ""}</div>`;
      const qtyRow = leaderRow(`${fmt(it.qty)} шт x ${fmt(it.price)}`, `${fmt(it.lineTotal ?? it.qty * it.price)} ${CUR}`);
      const discRow =
        it.discountPercent > 0
          ? leaderRow(`Скидка ${fmt(it.discountPercent)}%`, `${fmt(it.discountedTotal ?? 0)} ${CUR}`)
          : "";
      return head + qtyRow + discRow;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;}
    body{width:72mm;margin:0;padding:8px 10px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:13px;line-height:1.35;}
  </style></head><body>
    ${logo ? `<div style="text-align:center;margin:2px 0 6px;"><img src="${logo}" style="max-width:58mm;max-height:28mm;" /></div>` : ""}
    <div style="text-align:center;font-weight:900;font-size:22px;letter-spacing:1px;margin:2px 0 4px;">${esc(brand)}</div>
    ${branchName ? `<div style="text-align:center;font-size:12px;margin-bottom:4px;">${esc(branchName)}</div>` : ""}
    ${sep}
    ${receiptNumber ? metaLine("Заказ", "#" + receiptNumber) : ""}
    ${metaLine("Дата", date)}
    ${tableName ? metaLine("Стол", tableName) : ""}
    ${sellerName ? metaLine("Официант", sellerName) : ""}
    ${clientName ? metaLine("Клиент", clientName) : ""}
    ${clientPhone ? metaLine("Контакты", clientPhone) : ""}
    ${sep}
    ${itemsHtml}
    ${sep}
    ${leaderRow("Подытог", `${fmt(subtotal)} ${CUR}`)}
    ${discountTotal > 0 ? leaderRow("Скидка", `${fmt(discountTotal)} ${CUR}`) : ""}
    ${discountPercent > 0 ? leaderRow("Скидка %", `${fmt(discountPercent)} %`) : ""}
    ${serviceAmount > 0 ? leaderRow(`Обслуживание${servicePercent > 0 ? ` (${fmt(servicePercent)}%)` : ""}`, `${fmt(serviceAmount)} ${CUR}`) : ""}
    ${leaderRow("ИТОГО", `${fmt(total)} ${CUR}`, { big: true })}
    ${
      mixedSplit && (Number(mixedSplit.cash) || Number(mixedSplit.card) || Number(mixedSplit.transfer))
        ? (Number(mixedSplit.cash) > 0 ? leaderRow("Наличные", `${fmt(mixedSplit.cash)} ${CUR}`, { italic: true }) : "") +
          (Number(mixedSplit.card) > 0 ? leaderRow("Карта", `${fmt(mixedSplit.card)} ${CUR}`, { italic: true }) : "") +
          (Number(mixedSplit.transfer) > 0 ? leaderRow("Перевод", `${fmt(mixedSplit.transfer)} ${CUR}`, { italic: true }) : "")
        : paymentLabel
          ? leaderRow(paymentLabel, `${fmt(total)} ${CUR}`, { italic: true })
          : ""
    }
    ${
      cashbackQr
        ? `${sep}<div style="text-align:center;margin-top:6px;">
          <div style="font-weight:900;font-size:14px;">КЕШБЭК ${fmt(cashbackQr.earnAmount)} ${CUR}</div>
          <img src="${cashbackQr.dataUrl}" style="width:34mm;height:34mm;margin:4px 0;" />
          <div style="font-size:11px;line-height:1.3;">Отсканируйте QR и отправьте номер<br/>телефона — кешбэк зачислится на баланс</div>
        </div>`
        : ""
    }
    ${sep}
    <div style="text-align:center;font-weight:900;font-size:${statusLabel ? "17px" : "14px"};margin-top:10px;">${esc(statusLabel || footer)}</div>
  </body></html>`;
}

// ===== Kuxnya cheki (povar) — narxsiz, katta taom nomlari =====
// Ikki rejim:
//   • Yangi order / to'liq → items[] ({name, qty}) → "КУХНЯ" + tayyorlash ro'yxati.
//   • O'zgarish → added[] / cancelled[] ({name, qty, left?}) → "ИЗМЕНЕНИЕ" +
//     ДОБАВЛЕНО ×N (ko'proq tayyorlash) / ОТМЕНЕНО ×N (osha taom qancha kamaydi,
//     left bo'lsa "осталось N" — povar yakuniy qancha qilishni biladi).
export function buildKitchenTicketHtml(data = {}) {
  const {
    title,
    cookName,
    tableName,
    waiterName,
    receiptNumber,
    date = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" }),
    items = [],
    added = [],
    cancelled = [],
  } = data;
  const hasChange = (Array.isArray(added) && added.length) || (Array.isArray(cancelled) && cancelled.length);
  const head = title || (hasChange ? "ИЗМЕНЕНИЕ" : "КУХНЯ");
  const sep = `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`;

  const line = (name, qty, opts = {}) =>
    `<div style="display:flex;justify-content:space-between;align-items:baseline;margin:7px 0;font-size:18px;font-weight:800;${opts.strike ? "text-decoration:line-through;" : ""}">
      <span>${esc(name)}${opts.left != null && opts.left > 0 ? ` <span style="font-size:13px;font-weight:600;text-decoration:none;">(осталось ${esc(opts.left)})</span>` : ""}</span>
      <span style="white-space:nowrap;margin-left:12px;">× ${esc(qty)}</span>
    </div>`;

  const sectionLabel = (text, mark) =>
    `<div style="font-size:15px;font-weight:900;letter-spacing:0.5px;margin:6px 0 2px;border:2px solid #000;padding:3px 10px;display:inline-block;">${mark} ${esc(text)}</div>`;

  let body;
  if (hasChange) {
    let s = "";
    if (added.length) {
      s += sectionLabel("ДОБАВЛЕНО", "+");
      s += added.map((it) => line(it.name, it.qty)).join("");
    }
    if (cancelled.length) {
      if (added.length) s += sep;
      s += sectionLabel("ОТМЕНЕНО", "×");
      s += cancelled.map((it) => line(it.name, it.qty, { strike: true, left: it.left })).join("");
    }
    body = s;
  } else {
    body = items.length
      ? items.map((it) => line(it.name, it.qty)).join("")
      : '<div style="text-align:center;">—</div>';
  }

  return `<!doctype html><html><head><meta charset="utf-8"></head>
  <body style="width:72mm;margin:0;padding:8px 10px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:14px;line-height:1.3;">
    <div style="text-align:center;font-weight:900;font-size:20px;letter-spacing:1px;">${esc(head)}</div>
    ${cookName ? `<div style="text-align:center;font-size:13px;margin-top:2px;">${esc(cookName)}</div>` : ""}
    ${sep}
    ${tableName ? `<div style="font-weight:900;font-size:17px;">${esc(tableName)}</div>` : ""}
    ${waiterName ? `<div style="margin-top:2px;">Официант: <b>${esc(waiterName)}</b></div>` : ""}
    ${receiptNumber ? `<div style="font-size:12px;color:#000;">№ ${esc(receiptNumber)}</div>` : ""}
    <div style="font-size:12px;">${esc(date)}</div>
    ${sep}
    ${body}
    ${sep}
  </body></html>`;
}

// Test chek — namuna ma'lumot (chegirma ham ko'rinadi)
export function buildTestReceiptHtml(ctx = {}) {
  return buildReceiptHtml({
    brand: ctx.restaurantName || "AridaiPOS",
    branchName: ctx.branchName,
    receiptNumber: "TEST-0001",
    sellerName: ctx.sellerName || "Кассир",
    clientName: ctx.printerName ? `Принтер: ${ctx.printerName}` : undefined,
    currency: ctx.currency || "UZS",
    items: [
      { name: "Плов", meta: "Горячее", qty: 1, price: 30000, lineTotal: 30000, discountPercent: 50, discountedTotal: 15000 },
      { name: "Кола 0.5", qty: 2, price: 12000, lineTotal: 24000 },
    ],
    subtotal: 54000,
    discountTotal: 15000,
    discountPercent: 28,
    total: 39000,
    paymentLabel: "Наличные",
    footer: "ТЕСТ ПЕЧАТИ · Спасибо!",
  });
}
