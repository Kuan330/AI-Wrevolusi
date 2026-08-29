export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  occupation_id: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  full_name: string;
  password: string;
}
