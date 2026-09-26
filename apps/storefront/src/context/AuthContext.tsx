'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService, UserProfile, LoginPayload, RegisterPayload } from '@/services/authService';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<{ success: boolean; message?: string }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Khởi tạo trạng thái phiên từ HttpOnly Cookie & cache user
  const initAuth = useCallback(async () => {
    setIsLoading(true);
    const savedUser = authService.getSavedUser();

    if (savedUser) {
      setUser(savedUser);
      setToken('authenticated');
    }

    try {
      const freshUser = await authService.getProfile();
      if (freshUser) {
        setUser(freshUser);
        setToken('authenticated');
      } else {
        // Phiên làm việc không hợp lệ hoặc đã hết hạn
        setUser(null);
        setToken(null);
      }
    } catch {
      // Giữ thông tin đã lưu nếu mất mạng tạm thời
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  const login = async (payload: LoginPayload) => {
    const res = await authService.login(payload);
    if (res.success && res.data) {
      setUser(res.data.user);
      setToken(res.data.accessToken);
      return { success: true };
    }
    return { success: false, message: res.message || 'Đăng nhập không thành công' };
  };

  const register = async (payload: RegisterPayload) => {
    const res = await authService.register(payload);
    if (res.success && res.data) {
      setUser(res.data.user);
      setToken(res.data.accessToken);
      return { success: true };
    }
    return { success: false, message: res.message || 'Đăng ký không thành công' };
  };

  const logout = () => {
    void authService.clearAuth();
    setUser(null);
    setToken(null);
  };

  const refreshProfile = async () => {
    const freshUser = await authService.getProfile();
    if (freshUser) {
      setUser(freshUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
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
