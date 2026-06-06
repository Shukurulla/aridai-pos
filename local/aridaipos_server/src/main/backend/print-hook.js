// Backend ↔ main process ajratish (decoupling).
// To'lov bo'lganda chek chop etish kerak, lekin backend (Express) Electron'ga
// bog'lanmasligi kerak (standalone `node server.js` ham ishlasin). Shuning uchun:
//   - backend faqat firePrintReceipt(orderId) chaqiradi (no-op agar hook yo'q).
//   - main process (index.js) setPrintHook(fn) bilan haqiqiy print mantig'ini beradi.
let hook = null; // firePrintReceipt(orderId) — to'lovda avtomatik kassir cheki
let kitchenHook = null; // firePrintKitchen(orderId) — order qo'shilganda povar (kuxnya) cheki
let printer = null; // (html, deviceName) => {success, error} — umumiy print (Electron)

export function setPrintHook(fn) {
  hook = typeof fn === "function" ? fn : null;
}

export function firePrintReceipt(orderId) {
  if (!hook || !orderId) return;
  Promise.resolve()
    .then(() => hook(orderId))
    .catch((e) => console.warn("[print-hook] chek chop etishda xato:", e?.message));
}

// Kuxnya cheki — order yaratilganda/taom qo'shilganda povar printeriga.
export function setKitchenHook(fn) {
  kitchenHook = typeof fn === "function" ? fn : null;
}

export function firePrintKitchen(orderId) {
  if (!kitchenHook || !orderId) return;
  Promise.resolve()
    .then(() => kitchenHook(orderId))
    .catch((e) => console.warn("[print-hook] kuxnya cheki xato:", e?.message));
}

// Umumiy print hook — backend HTML quradi, main process Electron orqali chop etadi.
export function setPrinter(fn) {
  printer = typeof fn === "function" ? fn : null;
}

export async function printViaHook(html, deviceName) {
  if (!printer) return { success: false, error: "Печать недоступна (сервер не в Electron)" };
  return await printer(html, deviceName);
}
