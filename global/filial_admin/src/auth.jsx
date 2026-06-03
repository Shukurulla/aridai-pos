import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api, getToken, setToken, clearToken, getUser, setUser } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTok] = useState(() => getToken());
  const [user, setUsr] = useState(() => getUser());

  const login = useCallback(async (phone, password) => {
    const res = await api.login(phone, password);
    setToken(res.token);
    setUser(res.data);
    setTok(res.token);
    setUsr(res.data);
    return res;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTok(null);
    setUsr(null);
  }, []);

  useEffect(() => {
    const h = () => {
      clearToken();
      setTok(null);
      setUsr(null);
    };
    window.addEventListener("auth:unauthorized", h);
    return () => window.removeEventListener("auth:unauthorized", h);
  }, []);

  // branchId / restaurantId — filial admin o'z filialini boshqaradi (token'dan)
  const branchId = user?.branch?._id || user?.branch || null;
  const restaurantId = user?.restaurantId?._id || user?.restaurantId || null;

  return (
    <AuthCtx.Provider value={{ token, user, isAuthed: !!token, login, logout, branchId, restaurantId }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return c;
}
