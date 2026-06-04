import admin from "firebase-admin";
import { readFileSync } from "fs";

// ============================================================
// FCM push — cook/waiter mobil bildirishnomalar.
// FIREBASE_SERVICE_ACCOUNT = service account (env):
//   - inline JSON ('{' bilan boshlansa) YOKI
//   - JSON fayl yo'li (mas. ./.firebase-service-account.json).
// Sozlanmagan bo'lsa — XAVFSIZ no-op (xato bermaydi, push o'chiq).
// ============================================================

let fcmApp = null;
let tried = false;

function ensureInit() {
  if (tried) return fcmApp;
  tried = true;
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) {
    console.log("[push] FIREBASE_SERVICE_ACCOUNT yo'q — FCM OFF (no-op)");
    return null;
  }
  try {
    const cred = raw.startsWith("{") ? JSON.parse(raw) : JSON.parse(readFileSync(raw, "utf8"));
    fcmApp = admin.initializeApp({ credential: admin.credential.cert(cred) });
    console.log(`[push] FCM yoqildi (project: ${cred.project_id})`);
    return fcmApp;
  } catch (e) {
    console.error("[push] init xato:", e.message);
    return null;
  }
}

// tokens: [String]; notif: { title, body }; data: ixtiyoriy (string-ga aylantiriladi)
export async function sendToTokens(tokens, notif, data = {}) {
  const app = ensureInit();
  const list = (tokens || []).filter(Boolean);
  if (!app || list.length === 0) return { sent: 0 };
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens: list.slice(0, 500),
      notification: notif,
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: "high" },
    });
    return { sent: res.successCount, failed: res.failureCount };
  } catch (e) {
    console.error("[push] send xato:", e.message);
    return { sent: 0, error: e.message };
  }
}

// Fire-and-forget (javobni kutmaymiz — order/cooking endpointini sekinlashtirmaymiz)
export function pushAsync(tokens, notif, data = {}) {
  sendToTokens(tokens, notif, data).catch(() => {});
}
