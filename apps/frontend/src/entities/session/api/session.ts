import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson, postJson } from '../../../shared/api/httpClient';

export interface Account {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'USER' | 'SUPERADMIN';
  /** «Остановить анализ» is per account: while paused it gets no new positions. */
  analysisPaused: boolean;
}

/** Where an account lands after signing in: the super admin gets its own panel. */
export function homePathFor(account: Account): string {
  return account.role === 'SUPERADMIN' ? '/admin' : '/';
}

export const ME_QUERY_KEY = ['me'] as const;

/** `null` = not signed in (401), never an error state. */
export function useMeQuery() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        return (await getJson<{ account: Account }>('/api/auth/me')).account;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => postJson<{ account: Account }>('/api/auth/login', input),
    onSuccess: ({ account }) => queryClient.setQueryData(ME_QUERY_KEY, account),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; phone: string; password: string }) =>
      postJson<{ account: Account }>('/api/auth/register', input),
    onSuccess: ({ account }) => queryClient.setQueryData(ME_QUERY_KEY, account),
  });
}

/** Change your own password (current one required). Other browsers are signed out, this one stays. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => postJson<{ ok: true }>('/api/me/password', input),
  });
}

/** «Забыли пароль»: leaves the phone number for the administration. */
export function useForgotPassword() {
  return useMutation({ mutationFn: (phone: string) => postJson<{ ok: true }>('/api/auth/forgot', { phone }) });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson('/api/auth/logout'),
    // Drop every cached trade/stat so the next account never sees the previous one's screen.
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, null);
    },
  });
}
