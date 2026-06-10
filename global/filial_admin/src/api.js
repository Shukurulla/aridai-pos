// Global backend (4560) bilan ishlash. Vite /api → 4560 proksi.
// Global format: { status: "success"|"error", data, token, message, code }.
const TOKEN_KEY = "filial_admin_token";
const USER_KEY = "filial_admin_user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
};
export const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));

async function request(method, path, body) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;

  // FormData (rasm yuklash) — Content-Type'ni brauzer o'zi qo'yadi (boundary bilan)
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch("/api" + path, { method, headers, body: payload });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* bo'sh */
  }
  if (res.status === 401) window.dispatchEvent(new Event("auth:unauthorized"));
  if (!res.ok || json.status === "error") {
    const e = new Error(json.message || json.code || `Ошибка ${res.status}`);
    e.code = json.code;
    throw e;
  }
  return json;
}

export const api = {
  login: (phone, password) => request("POST", "/users/login", { phone, password }),

  categories: (branchId) => request("GET", `/categories/all/${branchId}`),
  categoryCreate: (body) => request("POST", "/categories/create", body),
  categoryUpdate: (id, body) => request("PUT", `/categories/${id}`, body),
  categoryDelete: (id) => request("DELETE", `/categories/${id}`),

  foods: (branchId) => request("GET", `/foods/all/${branchId}`),
  foodCreate: (body) => request("POST", "/foods/create", body),
  foodUpdate: (id, body) => request("PUT", `/foods/${id}`, body),
  foodDelete: (id) => request("DELETE", `/foods/${id}`),

  tables: (branchId) => request("GET", `/tables/tables/${branchId}`),
  tableCreate: (body) => request("POST", "/tables/create", body),
  tableUpdate: (id, body) => request("PUT", `/tables/${id}`, body),
  tableDelete: (id) => request("DELETE", `/tables/${id}`),

  // POS orderlari (local→global sync push orqali) + filial ma'lumoti
  orders: (branchId, shift) =>
    request("GET", `/orders/all/${branchId}${shift ? `?shift=${encodeURIComponent(shift)}` : ""}`),
  orderCancel: (id, body) => request("PATCH", `/orders/${id}/cancel`, body),
  orderItemCancel: (orderId, itemId, body) => request("PATCH", `/orders/${orderId}/items/${itemId}/cancel`, body),
  orderItemQty: (orderId, itemId, quantity) => request("PATCH", `/orders/${orderId}/items/${itemId}/quantity`, { quantity }),
  branch: (branchId) => request("GET", `/branches/${branchId}`),

  // Расходы / Авансы (sync orqali POS'dan kelgan — read-only hisobot)
  expenses: (branchId) => request("GET", `/finance/expenses/${branchId}`),
  advances: (branchId) => request("GET", `/finance/advances/${branchId}`),

  // Smena (ochish / yopish / ro'yxat)
  shifts: (branchId) => request("GET", `/shifts/all/${branchId}`),
  shiftCreate: (body) => request("POST", "/shifts/create", body),
  shiftClose: (id, body) => request("PUT", `/shifts/${id}/close`, body),

  // SKLAD (inventory) — toggle o'chiq bo'lsa 404 FEATURE_DISABLED (err.code)
  skladStock: () => request("GET", "/sklad/stock"),
  skladIngredients: () => request("GET", "/sklad/ingredients"),
  skladIngredientCreate: (body) => request("POST", "/sklad/ingredients", body),
  skladIngredientUpdate: (id, body) => request("PUT", `/sklad/ingredients/${id}`, body),
  skladStockIn: (body) => request("POST", "/sklad/stock/in", body),
  skladAdjust: (body) => request("POST", "/sklad/stock/adjustment", body),
  skladMovements: (limit = 50) => request("GET", `/sklad/movements?limit=${limit}`),
  skladThreshold: (ingredientId, lowAlertThreshold) =>
    request("PUT", `/sklad/stock/${ingredientId}/threshold`, { lowAlertThreshold }),

  // KESHBEK — balanslar + harakatlar (toggle o'chiq → 404 FEATURE_DISABLED)
  keshbekBalances: () => request("GET", "/keshbek/balances"),
  keshbekMovements: (phone) => request("GET", `/keshbek/movements/${encodeURIComponent(phone)}`),
};

export function translateError(err) {
  const m = err?.message || "";
  if (/INVALID_CREDENTIALS|noto|parol/i.test(m)) return "Неверный телефон или пароль";
  if (/CREDENTIALS_REQUIRED/i.test(m)) return "Введите телефон и пароль";
  return m || "Ошибка";
}
