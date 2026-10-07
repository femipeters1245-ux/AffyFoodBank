// frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Wallet } from '../types';
import { authApi, walletApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  wallet: Wallet | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('affy_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('affy_token');
  });
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchWallet = async () => {
    if (!token) return;
    try {
      const data = await walletApi.getWallet();
      setWallet(data);
    } catch {
      // Wallet may not exist or request failed
    }
  };

  useEffect(() => {
    if (token) {
      fetchWallet().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
      setWallet(null);
    };

    window.addEventListener('affy_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('affy_auth_expired', handleAuthExpired);
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem('affy_token', res.token);
    localStorage.setItem('affy_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    try {
      const w = await walletApi.getWallet();
      setWallet(w);
    } catch {
      // Wallet fetch can follow
    }
  };

  const register = async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    await authApi.register(data);
    // Auto-login after registration
    await login(data.email, data.password);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setToken(null);
    setWallet(null);
  };

  const refreshWallet = async () => {
    await fetchWallet();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        wallet,
        isLoading,
        isAuthenticated: !!token,
        login,
        register,
        logout,
        refreshWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
