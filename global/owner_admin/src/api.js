// API-клиент — панель владельца ресторана (owner).
// Owner token в localStorage, добавляется к каждому запросу как Bearer.
// Backend: /api/restaurants/*, /api/branches/*, /api/users/* (vite proxy → http://localhost:4560)

const TOKEN_KEY = "aridai_owner_token";

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
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* пустой ответ */
  }

  if (res.status === 401 || res.status === 403) {
    const revoked = ["TOKEN_REVOKED", "TOKEN_INVALID", "AUTH_REQUIRED", "WRONG_TOKEN_TYPE"];
    if (revoked.includes(data.code)) {
      clearToken();
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
  }

  if (!res.ok || data.status === "error") {
    const err = new Error(data.message || data.code || `HTTP ${res.status}`);
    err.code = data.code;
    err.cascade = data.cascade;
    err.httpStatus = res.status;
    throw err;
  }

  return data;
}

export const api = {
  // ===== Авторизация =====
  login: (phone, password) =>
    request("POST", "/restaurants/login", { body: { phone, password } }),

  getRestaurant: (id) => request("GET", `/restaurants/${id}`),

  // ===== Переключение функций =====
  toggleFeature: (id, key, payload) =>
    request("PATCH", `/restaurants/${id}/features/${key}`, { body: payload }),

  // ===== Филиалы =====
  listBranches: () => request("GET", "/branches/all"),
  getBranch: (id) => request("GET", `/branches/${id}`),
  createBranch: (body) => request("POST", "/branches/create", { body }),
  updateBranch: (id, body) => request("PUT", `/branches/${id}`, { body }),
  deleteBranch: (id) => request("DELETE", `/branches/${id}`),
  issueBranchToken: (id) => request("POST", `/branches/${id}/token`),

  // ===== Сотрудники (owner) =====
  listStaff: (branchId) => request("GET", `/users/owner/branch/${branchId}`),
  createStaff: (formData) => request("POST", "/users/register", { body: formData, isForm: true }),
  updateStaff: (id, formData) => request("PUT", `/users/owner/${id}`, { body: formData, isForm: true }),
  deleteStaff: (id) => request("DELETE", `/users/owner/${id}`),
};

const ERROR_MESSAGES = {
  CREDENTIALS_REQUIRED: "Введите телефон и пароль",
  INVALID_CREDENTIALS: "Неверный телефон или пароль",
  AUTH_REQUIRED: "Требуется авторизация",
  WRONG_TOKEN_TYPE: "Неверный тип токена",
  TOKEN_INVALID: "Сессия недействительна, войдите снова",
  TOKEN_REVOKED: "Сессия отозвана, войдите снова",
  RESTAURANT_NOT_FOUND: "Ресторан не найден или неактивен",
  TENANT_BOUNDARY_VIOLATION: "Нет доступа к этому действию",
  NAME_REQUIRED: "Введите название филиала",
  ALREADY_EXISTS: "Запись с такими данными уже существует",
  BRANCH_NOT_FOUND: "Филиал не найден",
  UNKNOWN_FEATURE: "Неизвестная функция",
  REQUIRES_UNMET: "Сначала включите зависимую функцию",
  EXCLUDES_CONFLICT: "Функция конфликтует с другой",
  CASCADE: "От этой функции зависят другие",
  FIELDS_REQUIRED: "Заполните все поля",
  INVALID_ROLE: "Недопустимая роль",
  PHONE_TAKEN: "Этот телефон уже зарегистрирован",
  NOT_FOUND: "Не найдено",
};

export function translateError(err) {
  if (err?.code && ERROR_MESSAGES[err.code]) return ERROR_MESSAGES[err.code];
  if (err?.message) return err.message;
  return "Произошла неизвестная ошибка";
}
