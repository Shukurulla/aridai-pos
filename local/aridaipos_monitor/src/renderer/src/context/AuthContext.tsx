'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Restaurant, Branch } from '@/types';
import { api } from '@/services/api';

interface AuthContextType {
  user: User | null;
  restaurant: Restaurant | null;
  branch: Branch | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Electron main'dagi doimiy sessiya (userData) — Electron qayta ochilsa ham
  // saqlanadi. Renderer localStorage'ga tayanmaymiz.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SESS = (typeof window !== 'undefined' ? (window as any).pos?.session : null) || null;

  useEffect(() => {
    (async () => {
      try {
        let storedUser = api.getStoredUser();
        let storedRestaurant = api.getStoredRestaurant();
        let token = api.getToken();
        let b: Branch | null = null;
        try {
          const bs = typeof window !== 'undefined' ? localStorage.getItem('branch') : null;
          if (bs) b = JSON.parse(bs);
        } catch {}

        if (storedUser && storedRestaurant && token) {
          // localStorage'da bor — main'ga ham nusxalab qo'yamiz (kelgusi uchun)
          SESS?.set({ token, user: storedUser, restaurant: storedRestaurant, branch: b });
        } else if (SESS) {
          // localStorage bo'sh — main'dagi doimiy sessiyadan tiklaymiz
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s: any = await SESS.get();
          if (s && s.token && s.user) {
            api.setToken(s.token);
            if (typeof window !== 'undefined') {
              localStorage.setItem('user', JSON.stringify(s.user));
              if (s.restaurant) localStorage.setItem('restaurant', JSON.stringify(s.restaurant));
              if (s.branch) localStorage.setItem('branch', JSON.stringify(s.branch));
            }
            storedUser = s.user;
            storedRestaurant = s.restaurant || null;
            token = s.token;
            b = s.branch || null;
          }
        }

        if (storedUser && token) {
          setUser(storedUser);
          setRestaurant(storedRestaurant);
          setBranch(b);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (phone: string, password: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await api.login(phone, password) as any;
    setUser(data.user);
    setRestaurant(data.restaurant);
    setBranch(data.branch || null);
    // Doimiy saqlash — bir marta login, keyin har doim avto-kirish
    SESS?.set({
      token: data.token,
      user: data.user,
      restaurant: data.restaurant,
      branch: data.branch || null,
    });
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
    setRestaurant(null);
    setBranch(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('branch');
    }
    SESS?.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        restaurant,
        branch,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
