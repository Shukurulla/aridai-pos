// Роли сотрудников филиала (backend: config/constants.js BRANCH_ROLES)
// owner и system_admin сюда не входят — их назначает система.
export const BRANCH_ROLES = [
  { value: "branch_admin", label: "Администратор", desc: "Управляет филиалом, меню, сменами" },
  { value: "cashier", label: "Кассир", desc: "Работает на кассе (POS)" },
  { value: "waiter", label: "Официант", desc: "Принимает заказы, обслуживает столы" },
  { value: "cook", label: "Повар", desc: "Кухня, готовит блюда" },
];

export const ROLE_LABEL = BRANCH_ROLES.reduce((acc, r) => {
  acc[r.value] = r.label;
  return acc;
}, {});

// Режимы работы филиала
export const MODE_LABEL = {
  online: { text: "Онлайн", cls: "badge-on" },
  offline: { text: "Офлайн", cls: "badge-off" },
  possiz: { text: "Без кассы", cls: "badge-role" },
  unknown: { text: "Не подключён", cls: "badge-cur" },
};
