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

const USER_KEY = 'novatech_user_profile';

export const authService = {
  // Kiểm tra trạng thái đăng nhập (dựa trên thông tin user cache)
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(localStorage.getItem(USER_KEY));
  },

  // Giữ lại để tương thích ngược nếu có component gọi getToken
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return this.isAuthenticated() ? 'cookie_authenticated' : null;
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

  // Lưu thông tin đăng nhập (Token được trình duyệt tự lưu vào HttpOnly Cookie)
  saveAuth(data: { user: UserProfile }): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  },

  // Đăng xuất an toàn: Xóa cookie từ server và xóa cache user
  async clearAuth(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_KEY);
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err: unknown) {
      console.warn('[authService.clearAuth] Failed to call logout endpoint:', err);
    }
  },

  // Đăng ký tài khoản
  async register(payload: RegisterPayload): Promise<{ success: boolean; data?: AuthResponseData; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        credentials: 'include',
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
        accessToken: body.access_token || body.accessToken || '',
        refreshToken: body.refresh_token || body.refreshToken || '',
        expiresIn: body.expires_in || body.expiresIn || 604800,
      };

      this.saveAuth({ user: formattedUser });
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
        credentials: 'include',
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
        accessToken: body.access_token || body.accessToken || '',
        refreshToken: body.refresh_token || body.refreshToken || '',
        expiresIn: body.expires_in || body.expiresIn || 604800,
      };

      this.saveAuth({ user: formattedUser });
      return { success: true, data: result };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ xác thực';
      return { success: false, message: msg };
    }
  },

  // Lấy thông tin tài khoản hiện tại từ HttpOnly Cookie phiên làm việc
  async getProfile(): Promise<UserProfile | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(USER_KEY);
          }
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

      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_KEY, JSON.stringify(formattedUser));
      }
      return formattedUser;
    } catch {
      return this.getSavedUser();
    }
  },
};
