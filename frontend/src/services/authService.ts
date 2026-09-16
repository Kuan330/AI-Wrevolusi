import { ApiError, api } from "@/services/api";
import { browserStorage } from "@/infrastructure/storage/browserStorage";
import { STORAGE_KEYS } from "@/infrastructure/storage/keys";
import type { AuthUser, LoginPayload, RegisterPayload } from "@/types/auth";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface DemoCredential {
  email: string;
  password: string;
  full_name: string;
}

const getDemoCredential = (): DemoCredential => {
  const rawValue = browserStorage.getItem(STORAGE_KEYS.demoCredential);
  if (rawValue) {
    try {
      return JSON.parse(rawValue) as DemoCredential;
    } catch {
      browserStorage.removeItem(STORAGE_KEYS.demoCredential);
    }
  }

  const credential: DemoCredential = {
    email: `demo-${crypto.randomUUID().slice(0, 8)}@aiwrevolusi.local`,
    password: "DemoPass123!",
    full_name: "Christine Demo",
  };
  browserStorage.setItem(
    STORAGE_KEYS.demoCredential,
    JSON.stringify(credential),
  );
  return credential;
};

export const authService = {
  me: () => api.get<AuthUser>("/users/me"),
  login: (payload: LoginPayload) => api.post<TokenResponse, LoginPayload>("/auth/login", payload),
  register: (payload: RegisterPayload) =>
    api.post<AuthUser, RegisterPayload>("/auth/register", payload),
  refresh: () => api.post<TokenResponse>("/auth/refresh"),
  logout: () => api.post<null>("/auth/logout"),
  ensureDemoSession: async (): Promise<AuthUser> => {
    try {
      return await authService.me();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
    }

    const credential = getDemoCredential();

    try {
      await authService.login({
        email: credential.email,
        password: credential.password,
      });
      return await authService.me();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
    }

    await authService.register(credential);
    await authService.login({
      email: credential.email,
      password: credential.password,
    });
    return authService.me();
  },
};
