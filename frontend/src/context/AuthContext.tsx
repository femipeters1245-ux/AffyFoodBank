// frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Wallet } from '../types';
import { authApi, walletApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  wallet: Wallet | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User | void>;
  sendLoginOtp: (email: string, password: string) => Promise<{ message: string; email: string; expiresInMinutes: number; verificationTicket?: string }>;
  verifyLoginOtp: (email: string, otp: string, verificationTicket?: string) => Promise<User>;
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>;
  sendSignupOtp: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<{ message: string; email: string; expiresInMinutes: number; verificationTicket?: string }>;
  verifySignupOtp: (
    email: string,
    otp: string,
    verificationTicket?: string,
    extraData?: { password?: string; firstName?: string; lastName?: string }
  ) => Promise<User>;
  // Supabase-powered OTP (works without domain verification)
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
    if (!token) return;
    try {
      const data = await walletApi.getWallet();
      setWallet(data);
    } catch {
      // Wallet may not exist or request failed
    }
  };

  // Fetch wallet when token is available
  useEffect(() => {
    if (token) {
      fetchWallet().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  // Auth expiry listener — runs once
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
      setWallet(null);
    };

    window.addEventListener('affy_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('affy_auth_expired', handleAuthExpired);
  }, []);

  // Supabase auth state listener — runs once, avoids re-subscribing on token change
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        const sessionEmail = session.user.email || '';
        const isAdmin = sessionEmail === 'affybrand@gmail.com' || sessionEmail.endsWith('@affyfoodbank.ng');
        const loggedUser: User = {
          id: session.user.id,
          email: sessionEmail,
          firstName: session.user.user_metadata?.first_name || sessionEmail.split('@')[0],
          lastName: session.user.user_metadata?.last_name || '',
          role: isAdmin ? 'Admin' : 'Customer',
          isActive: true,
          createdAt: session.user.created_at || new Date().toISOString(),
        };
        applyAuthSuccess({
          token: session.access_token,
          user: loggedUser,
        });
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const applyAuthSuccess = (res: { token: string; user: User }) => {
    localStorage.setItem('affy_token', res.token);
    localStorage.setItem('affy_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    walletApi.getWallet().then(setWallet).catch(() => {});
    return res.user;
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await authApi.login({ email: email.trim().toLowerCase(), password });
      return applyAuthSuccess(res);
    } catch (apiErr: any) {
      // If backend login failed or backend is offline, check Supabase Auth password login
      if (isSupabaseConfigured) {
        try {
          const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });

          if (!supaErr && supaData?.session) {
            const accessToken = supaData.session.access_token;
            try {
              const res = await authApi.supabaseExchange({ access_token: accessToken });
              return applyAuthSuccess(res);
            } catch {
              const supaUser = supaData.user!;
              const fallbackEmail = supaUser.email || email.trim().toLowerCase();
              const isAdmin = fallbackEmail === 'affybrand@gmail.com' || fallbackEmail.endsWith('@affyfoodbank.ng');
              const fallbackRes = {
                token: accessToken,
                user: {
                  id: supaUser.id,
                  email: fallbackEmail,
                  firstName: supaUser.user_metadata?.first_name || fallbackEmail.split('@')[0],
                  lastName: supaUser.user_metadata?.last_name || '',
                  role: isAdmin ? 'Admin' : 'Customer',
                  isActive: true,
                  createdAt: supaUser.created_at || new Date().toISOString(),
                },
              };
              return applyAuthSuccess(fallbackRes);
            }
          }
        } catch (supaErr) {
          console.warn('[Supabase password login note]:', supaErr);
        }
      }
      throw apiErr;
    }
  };

  const sendLoginOtp = async (email: string, password: string) => {
    return await authApi.sendLoginOtp({ email, password });
  };

  const verifyLoginOtp = async (email: string, otp: string, verificationTicket?: string) => {
    const res = await authApi.verifyLoginOtp({ email, otp, verificationTicket });
    return applyAuthSuccess(res);
  };

  const register = async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    await authApi.register(data);
    await login(data.email, data.password);
  };

  const sendSignupOtp = async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    try {
      return await authApi.sendSignupOtp(data);
    } catch (err: any) {
      // If backend is unavailable, fallback to Supabase OTP
      if (isSupabaseConfigured) {
        console.warn('[Signup OTP] Backend unavailable, using Supabase OTP:', err.message);
        const supaRes = await supabaseSendOtp(data.email);
        return {
          message: supaRes.message,
          email: data.email,
          expiresInMinutes: 10,
        };
      }
      throw err;
    }
  };

  const verifySignupOtp = async (
    email: string,
    otp: string,
    verificationTicket?: string,
    extraData?: { password?: string; firstName?: string; lastName?: string }
  ) => {
    try {
      const res = await authApi.verifySignupOtp({ email, otp, verificationTicket });
      return applyAuthSuccess(res);
    } catch (err: any) {
      if (isSupabaseConfigured) {
        console.warn('[Signup OTP] Backend verify error, attempting Supabase verify:', err.message);
        return await supabaseVerifyOtp({
          email,
          otp,
          password: extraData?.password,
          firstName: extraData?.firstName,
          lastName: extraData?.lastName,
        });
      }
      throw err;
    }
  };

  /**
   * Supabase OTP — Step 1: Send magic link / email OTP via Supabase Auth
   */
  const supabaseSendOtp = async (email: string): Promise<{ message: string }> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('[Supabase OTP] Send error:', error.message);
      throw new Error(error.message || 'Failed to send verification code.');
    }

    return { message: `A 6-digit verification code has been sent to ${email.trim().toLowerCase()}` };
  };

  /**
   * Supabase OTP — Step 2: Verify the OTP, set desired password, exchange Supabase session for backend JWT
   */
  const supabaseVerifyOtp = async (params: {
    email: string;
    otp: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  }): Promise<User> => {
    const { email, otp, firstName, lastName, password } = params;

    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    // Verify OTP with Supabase Auth
    const { data: sessionData, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email',
    });

    if (error || !sessionData?.session) {
      console.error('[Supabase OTP] Verify error:', error?.message);
      throw new Error(
        error?.message === 'Token has expired or is invalid'
          ? 'Incorrect or expired verification code. Please check your inbox and try again.'
          : error?.message || 'Verification failed. Please try again.'
      );
    }

    // If a desired password was provided at signup, set it in Supabase Auth now!
    if (password) {
      try {
        await supabase.auth.updateUser({ password });
        console.log('[Supabase OTP] User password successfully set on Supabase account.');
      } catch (pwdErr: any) {
        console.warn('[Supabase OTP] Could not update password in Supabase:', pwdErr?.message);
      }
    }

    // Extract the Supabase access token from the verified session
    const accessToken = sessionData.session.access_token;

    // Exchange Supabase token for our backend JWT with seamless fallback
    let res: any;
    try {
      res = await authApi.supabaseExchange({ access_token: accessToken, firstName, lastName, password });
    } catch (exchangeErr: any) {
      console.warn('[Supabase OTP] Backend exchange error, activating direct verified session:', exchangeErr?.message);
      const supaUser = sessionData.user!;
      const fallbackEmail = supaUser.email || params.email;
      const isAdmin = fallbackEmail === 'affybrand@gmail.com' || fallbackEmail.endsWith('@affyfoodbank.ng');
      res = {
        token: accessToken,
        user: {
          id: supaUser.id,
          email: fallbackEmail,
          firstName: firstName || supaUser.user_metadata?.first_name || fallbackEmail.split('@')[0],
          lastName: lastName || supaUser.user_metadata?.last_name || '',
          role: isAdmin ? 'Admin' : 'Customer',
          isActive: true,
          createdAt: supaUser.created_at || new Date().toISOString(),
        },
      };
    }
    return applyAuthSuccess(res);
  };

  const logout = async () => {
    // Sign out from Supabase Auth as well
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch(() => {});
    }
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
