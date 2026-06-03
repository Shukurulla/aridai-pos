// Tizim bo'ylab umumiy konstantalar.
// Qarang: obsidian/01-vizyon/glossariy.md, obsidian/07-nozik-nuqtalar/

// ===== Rollar (RBAC) — obsidian/02-arxitektura/xavfsizlik/role-based-access.md =====
export const ROLES = {
  SYSTEM_ADMIN: "system_admin",
  OWNER: "owner",
  BRANCH_ADMIN: "branch_admin",
  CASHIER: "cashier",
  WAITER: "waiter",
  COOK: "cook",
};
export const ROLE_LIST = Object.values(ROLES);
// Filialga bog'liq (users collection'idagi) rollar
export const BRANCH_ROLES = [ROLES.BRANCH_ADMIN, ROLES.CASHIER, ROLES.WAITER, ROLES.COOK];

// ===== Valyuta — obsidian/07-nozik-nuqtalar/pul-valyuta-yaxlitlash.md =====
export const CURRENCIES = ["UZS", "KZT"];
// Naqd kupyura tugmalari (yaxlitlash YO'Q, faqat tezkor kiritish + qaytim)
export const CASH_DENOMINATIONS = {
  KZT: [1000, 2000, 5000, 10000, 20000],
  UZS: [5000, 10000, 20000, 50000, 100000, 200000],
};
export const COUNTRY_BY_CURRENCY = { UZS: "UZ", KZT: "KZ" };
export const DEFAULT_TIMEZONE_BY_CURRENCY = { UZS: "Asia/Tashkent", KZT: "Asia/Almaty" };

// ===== Order — obsidian/05-data-model/order.md =====
export const ORDER_TYPES = ["dineIn", "takeaway", "delivery"];
export const PAYMENT_METHODS = ["cash", "card", "transfer", "kaspi", "mixed", "cashback"];
export const PAYMENT_STATUS = ["pending", "paid", "partiallyPaid", "refunded"];
export const COOKING_STATUS = ["waiting", "cooking", "ready", "served"];
export const ORDER_MODES = ["online", "offline", "possiz"];
export const CANCEL_TYPES = ["void", "cancel"]; // void=oshxona boshlamagan, cancel=boshlagan

// ===== Sync — obsidian/05-data-model/sync-metadata.md =====
export const SYNC_STATUS = ["synced", "pending", "in_progress", "rejected", "conflict"];

// ===== Feature toggle kalitlari — obsidian/03-tool-strategiyasi/feature-toggle-tizimi.md =====
export const FEATURE_KEYS = {
  OFFLINE: "offline",
  POSSIZ: "possiz",
  SKLAD: "sklad",
  KELDI_KETTI: "keldiKetti",
  QR_ORDER: "qrOrder",
  QR_PAY: "qrPay",
  KESHBEK: "keshbek",
};

// ===== Soft delete — obsidian/07-nozik-nuqtalar/ochirish-cascade.md =====
// O'chirish = isDeleted:true, 1 oy saqlanadi (tiklash), keyin cleanup. Order/shift o'chirilmaydi.
export const SOFT_DELETE_RETENTION_DAYS = 30;

// ===== Biznes kun — obsidian/07-nozik-nuqtalar/vaqt-va-soat.md =====
export const DEFAULT_BUSINESS_DAY_START_HOUR = 6; // 06:00
