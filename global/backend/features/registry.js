// Feature toggle registry — har tool'ning yagona haqiqat manbai
// obsidian/03-tool-strategiyasi/feature-toggle-tizimi.md
// obsidian/03-tool-strategiyasi/modullar-orasidagi-bogliqlik.md

export const FEATURES = {
  offline: {
    key: "offline",
    displayName: { uz: "Offline rejim", ru: "Офлайн режим" },
    defaultEnabled: true,
    requires: [],
    excludes: [],
    version: 1,
    defaultConfig: { syncBatchSize: 100, heartbeatIntervalMs: 3000 },
  },
  possiz: {
    key: "possiz",
    displayName: { uz: "Possiz (cook+waiter)", ru: "POS-less" },
    defaultEnabled: false,
    requires: ["offline"],
    excludes: ["qrPay"],
    version: 1,
    defaultConfig: { notificationChannel: "push" },
  },
  sklad: {
    key: "sklad",
    displayName: { uz: "Sklad", ru: "Склад" },
    defaultEnabled: false,
    requires: [],
    excludes: [],
    version: 1,
    // O1 qaror: stock tugasa BLOK (obsidian/07-nozik-nuqtalar/stop-list-limit.md)
    defaultConfig: { autoDeductOnOrder: true, blockOrderIfOutOfStock: true, lowStockAlert: 10 },
  },
  keldiKetti: {
    key: "keldiKetti",
    displayName: { uz: "Keldi-ketti", ru: "Учёт времени" },
    defaultEnabled: false,
    requires: [],
    excludes: [],
    version: 1,
    defaultConfig: { geoFenceRadius: 100, lateGracePeriod: 5, servicePercentDefault: 6 },
  },
  qrOrder: {
    key: "qrOrder",
    displayName: { uz: "QR Order", ru: "QR заказ" },
    defaultEnabled: false,
    requires: [],
    excludes: [],
    version: 1,
    defaultConfig: { pendingExpiryMinutes: 5, autoApprove: false },
  },
  qrPay: {
    key: "qrPay",
    displayName: { uz: "QR Pay (Kaspi)", ru: "QR оплата" },
    defaultEnabled: false,
    requires: [],
    excludes: ["possiz"],
    version: 1,
    defaultConfig: { provider: "kaspi" },
  },
  keshbek: {
    key: "keshbek",
    displayName: { uz: "Keshbek", ru: "Кешбэк" },
    defaultEnabled: false,
    requires: [],
    excludes: [],
    version: 1,
    defaultConfig: { percent: 5, minOrderAmount: 1000, expireUnusedAfterDays: 365 },
  },
  // Yangi tool shu yerga qo'shiladi (production'da ham — schema migration kerak emas)
};

export function getFeature(key) {
  return FEATURES[key] || null;
}

// Restaurant yaratilganda default toggle holatlari (Map uchun obyekt)
export function buildDefaultFeatures() {
  const out = {};
  for (const [key, def] of Object.entries(FEATURES)) {
    out[key] = {
      enabled: !!def.defaultEnabled,
      config: def.defaultConfig || {},
      installedVersion: def.defaultEnabled ? def.version : 0,
      enabledAt: def.defaultEnabled ? new Date() : null,
      disabledAt: null,
    };
  }
  return out;
}

// currentFeatures — plain object { key: { enabled } }
export function validateEnable(featureKey, currentFeatures = {}) {
  const def = FEATURES[featureKey];
  if (!def) return { ok: false, code: "UNKNOWN_FEATURE", reason: "Noma'lum tool" };
  for (const dep of def.requires) {
    if (!currentFeatures?.[dep]?.enabled) {
      return { ok: false, code: "REQUIRES_UNMET", reason: `Avval "${dep}" yoqilishi kerak` };
    }
  }
  for (const exc of def.excludes) {
    if (currentFeatures?.[exc]?.enabled) {
      return { ok: false, code: "EXCLUDES_CONFLICT", reason: `"${exc}" bilan birga ishlay olmaydi` };
    }
  }
  return { ok: true };
}

export function validateDisable(featureKey, currentFeatures = {}) {
  const cascade = [];
  for (const [k, def] of Object.entries(FEATURES)) {
    if (k === featureKey) continue;
    if (currentFeatures?.[k]?.enabled && def.requires.includes(featureKey)) {
      cascade.push(k);
    }
  }
  if (cascade.length) {
    return { ok: false, code: "CASCADE", cascade, reason: `${cascade.join(", ")} ham o'chiriladi` };
  }
  return { ok: true };
}

// Lifecycle hook'lar — har tool implementatsiya qilinganda to'ldiriladi (Phase 3)
// FEATURES[key].onEnable / onDisable / onInstall
