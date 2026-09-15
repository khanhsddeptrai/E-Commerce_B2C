import * as path from 'path';
import { Observable } from 'rxjs';

export const AUTH_PROTO_PATH = path.resolve(__dirname, '../src/auth.proto');
export const AUTH_PACKAGE_NAME = 'auth';

export interface UserDto {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: string;
  status: string;
  created_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_info?: string;
}

export interface AuthResponse {
  user: UserDto;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ValidateTokenRequest {
  access_token: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  user_id: string;
  email: string;
  role: string;
  error?: string;
}

export interface GetProfileRequest {
  user_id: string;
}

export interface UserProfileResponse {
  user: UserDto;
}

export interface AuthServiceClient {
  register(request: RegisterRequest): Observable<AuthResponse>;
  login(request: LoginRequest): Observable<AuthResponse>;
  refreshToken(request: RefreshTokenRequest): Observable<TokenResponse>;
  validateToken(request: ValidateTokenRequest): Observable<ValidateTokenResponse>;
  getProfile(request: GetProfileRequest): Observable<UserProfileResponse>;
}
