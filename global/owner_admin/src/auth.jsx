import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, getToken, setToken, clearToken } from "./api";

const AuthContext = createContext(null);
const REST_KEY = "aridai_owner_restaurant";

function loadRestaurant() {
  try {
    return JSON.parse(localStorage.getItem(REST_KEY)) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [restaurant, setRestaurant] = useState(loadRestaurant);

  const login = useCallback(async (phone, password) => {
    const res = await api.login(phone, password);
    setToken(res.ownerToken);
    localStorage.setItem(REST_KEY, JSON.stringify(res.data));
    setTokenState(res.ownerToken);
    setRestaurant(res.data);
    return res;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(REST_KEY);
    setTokenState(null);
    setRestaurant(null);
  }, []);

  // Restoran ma'lumotini yangilash (feature toggle'dan keyin)
  const refreshRestaurant = useCallback(async () => {
    const current = loadRestaurant();
    if (!current?._id) return null;
    const res = await api.getRestaurant(current._id);
    localStorage.setItem(REST_KEY, JSON.stringify(res.data));
    setRestaurant(res.data);
    return res.data;
  }, []);

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(REST_KEY);
      setTokenState(null);
      setRestaurant(null);
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, restaurant, isAuthed: !!token, login, logout, refreshRestaurant, setRestaurant }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}
