import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, getToken, setToken, clearToken } from "./api";

const AuthContext = createContext(null);

const ADMIN_KEY = "aridai_system_admin";

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ADMIN_KEY)) || null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (phone, password) => {
    const res = await api.login(phone, password);
    setToken(res.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(res.data));
    setTokenState(res.token);
    setAdmin(res.data);
    return res;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(ADMIN_KEY);
    setTokenState(null);
    setAdmin(null);
  }, []);

  // 401 — token bekor bo'lsa avtomatik logout
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(ADMIN_KEY);
      setTokenState(null);
      setAdmin(null);
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  return (
    <AuthContext.Provider value={{ token, admin, isAuthed: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}
