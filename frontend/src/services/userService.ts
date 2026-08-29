import { authService } from "@/services/authService";
import type { AuthUser } from "@/types/auth";

export const userService = {
  me: (): Promise<AuthUser> => authService.me(),
};
