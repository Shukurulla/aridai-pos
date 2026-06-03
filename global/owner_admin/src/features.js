// Метаданные функций — UI-представление backend-реестра (только для отображения).
// Backend: global/backend/features/registry.js — единственный источник истины.
// Здесь название/порядок/зависимости только для UI; реальную проверку делает backend.

export const FEATURE_META = [
  {
    key: "offline",
    name: "Офлайн-режим",
    desc: "POS работает даже без интернета, синхронизация при восстановлении связи",
    requires: [],
    excludes: [],
  },
  {
    key: "possiz",
    name: "Режим без кассы (повар + официант)",
    desc: "Работа без кассы — через приложения повара и официанта",
    requires: ["offline"],
    excludes: ["qrPay"],
  },
  {
    key: "sklad",
    name: "Склад",
    desc: "Остатки товаров, автосписание по рецепту, блокировка при нуле",
    requires: [],
    excludes: [],
  },
  {
    key: "keldiKetti",
    name: "Учёт времени (приход-уход)",
    desc: "Учёт рабочего времени сотрудников, геолокация, процент за обслуживание",
    requires: [],
    excludes: [],
  },
  {
    key: "qrOrder",
    name: "QR-заказ",
    desc: "Гость делает заказ через QR-код на столе",
    requires: [],
    excludes: [],
  },
  {
    key: "qrPay",
    name: "QR-оплата (Kaspi)",
    desc: "Гость оплачивает через QR-код (Kaspi)",
    requires: [],
    excludes: ["possiz"],
  },
  {
    key: "keshbek",
    name: "Кешбэк",
    desc: "Накопление и списание кешбэка для гостей",
    requires: [],
    excludes: [],
  },
];

// restaurant.features (объект или Map flatten) → { key: {enabled,...} }
export function featuresToObject(features) {
  if (!features) return {};
  if (features instanceof Map) return Object.fromEntries(features);
  return features; // backend с flattenMaps:true возвращает обычный объект
}
