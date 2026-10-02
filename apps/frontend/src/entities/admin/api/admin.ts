import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson, sendJson } from '../../../shared/api/httpClient';
import type { ByDirectionStats, SummaryStats, TradeDTO } from '../../trade/model/types';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'USER' | 'SUPERADMIN';
  analysisPaused: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  stats: SummaryStats;
  openPositions: number;
}

export interface AdminOverview {
  users: number;
  activeUsers: number;
  pausedUsers: number;
  inProfit: number;
  inLoss: number;
  openPositions: number;
  totalTrades: number;
  totalNet: number;
  openResetRequests: number;
}

export interface AdminUserDetail {
  account: Omit<AdminUser, 'stats' | 'openPositions'>;
  trades: TradeDTO[];
  summary: SummaryStats;
  byDirection: ByDirectionStats;
}

export interface ResetRequest {
  id: string;
  phone: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: number;
  resolvedAt: number | null;
  account: { id: string; name: string; email: string } | null;
}

export interface UserInput {
  name: string;
  email: string;
  phone: string;
  password?: string;
  analysisPaused?: boolean;
}

const ADMIN_KEY = 'admin';

export function useAdminDashboard() {
  return useQuery({
    queryKey: [ADMIN_KEY, 'dashboard'],
    queryFn: () => getJson<{ overview: AdminOverview; users: AdminUser[] }>('/api/admin/dashboard'),
    refetchInterval: 15_000,
  });
}

export function useAdminUser(id: string | null) {
  return useQuery({
    queryKey: [ADMIN_KEY, 'user', id],
    queryFn: () => getJson<AdminUserDetail>(`/api/admin/users/${id}`),
    enabled: id !== null,
  });
}

export function useResetRequests() {
  return useQuery({
    queryKey: [ADMIN_KEY, 'reset-requests'],
    queryFn: () => getJson<ResetRequest[]>('/api/admin/reset-requests'),
    refetchInterval: 30_000,
  });
}

function useAdminMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] }),
  });
}

export const useCreateUser = () => useAdminMutation((input: UserInput) => postJson('/api/admin/users', input));
export const useUpdateUser = () =>
  useAdminMutation(({ id, ...input }: Partial<UserInput> & { id: string }) => sendJson('PATCH', `/api/admin/users/${id}`, input));
export const useDeleteUser = () => useAdminMutation((id: string) => sendJson('DELETE', `/api/admin/users/${id}`));
export const useResolveResetRequest = () => useAdminMutation((id: string) => postJson(`/api/admin/reset-requests/${id}/resolve`));
