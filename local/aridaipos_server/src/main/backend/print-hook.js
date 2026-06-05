// Backend ↔ main process ajratish (decoupling).
// To'lov bo'lganda chek chop etish kerak, lekin backend (Express) Electron'ga
// bog'lanmasligi kerak (standalone `node server.js` ham ishlasin). Shuning uchun:
//   - backend faqat firePrintReceipt(orderId) chaqiradi (no-op agar hook yo'q).
//   - main process (index.js) setPrintHook(fn) bilan haqiqiy print mantig'ini beradi.
let hook = null;

export function setPrintHook(fn) {
  hook = typeof fn === "function" ? fn : null;
}

export function firePrintReceipt(orderId) {
  if (!hook || !orderId) return;
  Promise.resolve()
    .then(() => hook(orderId))
    .catch((e) => console.warn("[print-hook] chek chop etishda xato:", e?.message));
}
