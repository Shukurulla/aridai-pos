// API client — tizim admin paneli uchun.
// Token localStorage'da saqlanadi, har so'rovga Bearer sifatida qo'shiladi.
// Backend: /api/system/* (vite proxy → http://localhost:4560)

const TOKEN_KEY = "aridai_system_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, { body, isForm } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (isForm) {
    payload = body; // FormData — Content-Type'ni brauzer o'zi qo'yadi (boundary bilan)
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* bo'sh javob */
  }

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("auth:unauthorized"));
  }

  if (!res.ok || data.status === "error") {
    const err = new Error(data.message || data.code || `HTTP ${res.status}`);
    err.code = data.code;
    err.httpStatus = res.status;
    throw err;
  }

  return data;
}

export const api = {
  login: (phone, password) =>
    request("POST", "/system/login", { body: { phone, password } }),

  listRestaurants: ({ search = "", page = 1, limit = 20 } = {}) => {
    const qs = new URLSearchParams({ search, page: String(page), limit: String(limit) });
    return request("GET", `/system/restaurants?${qs.toString()}`);
  },

  getRestaurant: (id) => request("GET", `/system/restaurants/${id}`),

  createRestaurant: (formData) =>
    request("POST", "/system/restaurants", { body: formData, isForm: true }),

  updateRestaurant: (id, formData) =>
    request("PUT", `/system/restaurants/${id}`, { body: formData, isForm: true }),

  deleteRestaurant: (id) => request("DELETE", `/system/restaurants/${id}`),
};

// Преобразование кодов ошибок в текст на русском
const ERROR_MESSAGES = {
  CREDENTIALS_REQUIRED: "Введите логин и пароль",
  INVALID_CREDENTIALS: "Неверный логин или пароль",
  BRAND_LOGO_REQUIRED: "Название ресторана и логотип обязательны",
  OWNER_REQUIRED: "Данные владельца (имя, телефон, пароль) заполнены не полностью",
  ALREADY_EXISTS: "Ресторан с таким телефоном уже существует",
  NOT_FOUND: "Не найдено",
  AUTH_REQUIRED: "Требуется авторизация",
  TOKEN_INVALID: "Сессия недействительна, войдите снова",
  TOKEN_REVOKED: "Сессия отозвана, войдите снова",
  INACTIVE: "Учётная запись неактивна",
  WRONG_TOKEN_TYPE: "Неверный тип токена",
};

export function translateError(err) {
  if (err?.code && ERROR_MESSAGES[err.code]) return ERROR_MESSAGES[err.code];
  if (err?.message) return err.message;
  return "Произошла неизвестная ошибка";
}
