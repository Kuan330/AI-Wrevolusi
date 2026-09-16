import { ApiError, api } from "@/services/api";
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

const DEMO_CREDENTIAL_KEY = "aiwrevolusi.demo.credential";

const getDemoCredential = (): DemoCredential => {
  const rawValue = window.localStorage.getItem(DEMO_CREDENTIAL_KEY);
  if (rawValue) {
    try {
      return JSON.parse(rawValue) as DemoCredential;
    } catch {
      window.localStorage.removeItem(DEMO_CREDENTIAL_KEY);
    }
  }

  const credential: DemoCredential = {
    email: `demo-${crypto.randomUUID().slice(0, 8)}@aiwrevolusi.local`,
    password: "DemoPass123!",
    full_name: "Christine Demo",
  };
  window.localStorage.setItem(DEMO_CREDENTIAL_KEY, JSON.stringify(credential));
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
