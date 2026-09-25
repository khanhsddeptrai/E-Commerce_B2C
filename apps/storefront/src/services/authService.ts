const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface AuthResponseData {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  device_info?: string;
}

const TOKEN_KEY = 'novatech_access_token';
const USER_KEY = 'novatech_user_profile';

export const authService = {
  // Lấy access token từ localStorage
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  // Lấy thông tin user đã lưu
  getSavedUser(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  },

  // Lưu thông tin đăng nhập
  saveAuth(data: { accessToken: string; user: UserProfile }): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    // Lưu cookie nhẹ để middleware nếu cần SSR
    document.cookie = `novatech_auth_token=${data.accessToken}; path=/; max-age=604800; SameSite=Lax`;
  },

  // Xóa thông tin đăng nhập
  clearAuth(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    document.cookie = 'novatech_auth_token=; path=/; max-age=0; SameSite=Lax';
  },

  // Đăng ký tài khoản
  async register(payload: RegisterPayload): Promise<{ success: boolean; data?: AuthResponseData; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: Array.isArray(body.message) ? body.message.join(', ') : body.message || 'Đăng ký thất bại',
        };
      }

      const formattedUser: UserProfile = {
        id: body.user.id,
        email: body.user.email,
        fullName: body.user.full_name || body.user.fullName,
        phone: body.user.phone,
        avatarUrl: body.user.avatar_url || body.user.avatarUrl,
        role: body.user.role,
        status: body.user.status,
        createdAt: body.user.created_at || body.user.createdAt,
      };

      const result: AuthResponseData = {
        user: formattedUser,
        accessToken: body.access_token || body.accessToken,
        refreshToken: body.refresh_token || body.refreshToken,
        expiresIn: body.expires_in || body.expiresIn || 604800,
      };

      this.saveAuth({ accessToken: result.accessToken, user: formattedUser });
      return { success: true, data: result };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ xác thực';
      return { success: false, message: msg };
    }
  },

  // Đăng nhập
  async login(payload: LoginPayload): Promise<{ success: boolean; data?: AuthResponseData; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: Array.isArray(body.message) ? body.message.join(', ') : body.message || 'Đăng nhập thất bại',
        };
      }

      const formattedUser: UserProfile = {
        id: body.user.id,
        email: body.user.email,
        fullName: body.user.full_name || body.user.fullName,
        phone: body.user.phone,
        avatarUrl: body.user.avatar_url || body.user.avatarUrl,
        role: body.user.role,
        status: body.user.status,
        createdAt: body.user.created_at || body.user.createdAt,
      };

      const result: AuthResponseData = {
        user: formattedUser,
        accessToken: body.access_token || body.accessToken,
        refreshToken: body.refresh_token || body.refreshToken,
        expiresIn: body.expires_in || body.expiresIn || 604800,
      };

      this.saveAuth({ accessToken: result.accessToken, user: formattedUser });
      return { success: true, data: result };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ xác thực';
      return { success: false, message: msg };
    }
  },

  // Lấy thông tin tài khoản hiện tại từ Token
  async getProfile(): Promise<UserProfile | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.clearAuth();
        }
        return null;
      }

      const body = await res.json();
      const u = body.user || body;
      const formattedUser: UserProfile = {
        id: u.id,
        email: u.email,
        fullName: u.full_name || u.fullName,
        phone: u.phone,
        avatarUrl: u.avatar_url || u.avatarUrl,
        role: u.role,
        status: u.status,
        createdAt: u.created_at || u.createdAt,
      };

      // Cập nhật lại localStorage với thông tin mới nhất
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_KEY, JSON.stringify(formattedUser));
      }
      return formattedUser;
    } catch {
      return this.getSavedUser();
    }
  },
};
