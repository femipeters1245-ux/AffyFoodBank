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
  login: (email: string, password: string) => Promise<User>;
  sendOtp: (data: { email: string; purpose?: 'LOGIN' | 'SIGNUP'; firstName?: string; lastName?: string; password?: string }) => Promise<{ message: string; email: string; expiresInMinutes: number; verificationTicket?: string }>;
  verifyOtp: (payload: { email: string; otp: string; purpose?: 'LOGIN' | 'SIGNUP'; verificationTicket?: string; firstName?: string; lastName?: string; password?: string }) => Promise<User>;
  sendLoginOtp: (email: string, password?: string) => Promise<{ message: string; email: string; expiresInMinutes: number; verificationTicket?: string }>;
  verifyLoginOtp: (email: string, otp: string, verificationTicket?: string) => Promise<User>;
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>;
  sendSignupOtp: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<{ message: string; email: string; expiresInMinutes: number; verificationTicket?: string }>;
  verifySignupOtp: (
    email: string,
    otp: string,
    verificationTicket?: string,
    extra?: { password?: string; firstName?: string; lastName?: string }
  ) => Promise<User>;
  // Backward compatibility helpers
  supabaseSendOtp: (email: string) => Promise<{ message: string }>;
  supabaseVerifyOtp: (params: { email: string; otp: string; firstName?: string; lastName?: string; password?: string }) => Promise<User>;
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
    try {
      const data = await walletApi.getWallet();
      setWallet(data);
    } catch {
      // Wallet may not exist yet or request failed
    }
  };

  // Check HttpOnly session or localStorage on mount
  useEffect(() => {
    let isMounted = true;

    authApi
      .getSession()
      .then((res) => {
        if (!isMounted) return;
        if (res.authenticated && res.user) {
          setUser(res.user);
          localStorage.setItem('affy_user', JSON.stringify(res.user));
          fetchWallet().catch(() => {});
        } else if (!token) {
          setUser(null);
          setWallet(null);
        }
      })
      .catch(() => {
        // Fallback to local token if session endpoint fails
        if (token) {
          fetchWallet().catch(() => {});
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch wallet when token or user is updated
  useEffect(() => {
    if (token || user) {
      fetchWallet().finally(() => setIsLoading(false));
    }
  }, [token]);

  // Auth expiry listener
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
      setWallet(null);
    };

    window.addEventListener('affy_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('affy_auth_expired', handleAuthExpired);
  }, []);

  const applyAuthSuccess = (res: { token: string; user: User }): User => {
    localStorage.setItem('affy_token', res.token);
    localStorage.setItem('affy_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    walletApi.getWallet().then(setWallet).catch(() => {});
    return res.user;
  };

  /**
   * Direct email + password authentication
   */
  const login = async (email: string, password: string): Promise<User> => {
    const res = await authApi.login({ email: email.trim().toLowerCase(), password });
    return applyAuthSuccess(res);
  };

  /**
   * Unified 6-digit OTP request via Resend
   */
  const sendOtp = async (data: { email: string; purpose?: 'LOGIN' | 'SIGNUP'; firstName?: string; lastName?: string; password?: string }) => {
    return await authApi.sendOtp(data);
  };

  /**
   * Unified 6-digit OTP verification establishing session
   */
  const verifyOtp = async (payload: { email: string; otp: string; purpose?: 'LOGIN' | 'SIGNUP'; verificationTicket?: string; firstName?: string; lastName?: string; password?: string }): Promise<User> => {
    const res = await authApi.verifyOtp(payload);
    return applyAuthSuccess(res);
  };

  /**
   * Send login OTP via Resend directly
   */
  const sendLoginOtp = async (email: string, password?: string) => {
    return await authApi.sendLoginOtp({ email: email.trim().toLowerCase(), password: password || '' });
  };

  /**
   * Verify login OTP using native backend OTP verification
   */
  const verifyLoginOtp = async (email: string, otp: string, verificationTicket?: string): Promise<User> => {
    const res = await authApi.verifyLoginOtp({ email: email.trim().toLowerCase(), otp, verificationTicket });
    return applyAuthSuccess(res);
  };

  const register = async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    await authApi.register(data);
    await login(data.email, data.password);
  };

  /**
   * Send signup OTP via Resend directly
   */
  const sendSignupOtp = async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    return await authApi.sendSignupOtp({
      ...data,
      email: data.email.trim().toLowerCase(),
    });
  };

  /**
   * Verify signup OTP and establish session
   */
  const verifySignupOtp = async (
    email: string,
    otp: string,
    verificationTicket?: string,
    extra?: { password?: string; firstName?: string; lastName?: string }
  ): Promise<User> => {
    const res = await authApi.verifySignupOtp({
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
      verificationTicket,
      password: extra?.password,
      firstName: extra?.firstName,
      lastName: extra?.lastName,
    });
    return applyAuthSuccess(res);
  };

  /**
   * Compatibility wrapper routed directly to native OTP
   */
  const supabaseSendOtp = async (email: string): Promise<{ message: string }> => {
    const res = await authApi.sendLoginOtp({ email: email.trim().toLowerCase(), password: '' });
    return { message: res.message };
  };

  /**
   * Compatibility wrapper routed directly to native OTP
   */
  const supabaseVerifyOtp = async (params: {
    email: string;
    otp: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  }): Promise<User> => {
    return await verifySignupOtp(params.email, params.otp, undefined, {
      password: params.password,
      firstName: params.firstName,
      lastName: params.lastName,
    });
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
        isAuthenticated: !!user || !!token,
        login,
        sendOtp,
        verifyOtp,
        sendLoginOtp,
        verifyLoginOtp,
        register,
        sendSignupOtp,
        verifySignupOtp,
        supabaseSendOtp,
        supabaseVerifyOtp,
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
