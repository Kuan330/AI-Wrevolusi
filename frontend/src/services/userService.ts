import { mockUser } from "@/data/user";
import { api } from "@/services/api";
import type { UserProfile } from "@/types/user";

export const userService = {
  me: () => api.get<UserProfile>(mockUser),
};
