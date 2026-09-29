import { api } from '../../shared/lib/api';
import type { Role } from '../../shared/types';

export interface StaffUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  phone: string;
  active: boolean;
  mustChange: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  passwordChangedAt: number;
  /** Equipos con la sesión abierta. */
  sessions: number;
  lastSeen: number | null;
  online: boolean;
}

export interface OpenSession {
  id: string;
  userId: number;
  userName: string;
  username: string;
  role: Role;
  device: string;
  browser: string;
  ip: string;
  createdAt: number;
  lastSeen: number;
  expiresAt: number;
  online: boolean;
  current: boolean;
}

export interface UserForm {
  name: string;
  username: string;
  role: Role;
  phone: string;
  active: boolean;
  password?: string;
  mustChange?: boolean;
}

export const usersApi = {
  list: () => api.get<{ users: StaffUser[]; sessions: OpenSession[] }>('/users'),
  create: (f: UserForm) => api.post<{ id: number }>('/users', f),
  update: (id: number, f: Partial<UserForm>) => api.put<{ id: number }>(`/users/${id}`, f),
  resetPassword: (id: number, password: string, mustChange: boolean) => api.post(`/users/${id}/password`, { password, mustChange }),
  logoutEverywhere: (id: number) => api.post<{ closed: number }>(`/users/${id}/logout`),
  closeSession: (id: string) => api.del(`/sessions/${id}`),
};
