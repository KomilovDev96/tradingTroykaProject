import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY, type Account } from '../../../entities/session/api/session';
import { postJson } from '../../../shared/api/httpClient';

/** «Остановить / Продолжить анализ» for the signed-in account only. */
export function useToggleAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paused: boolean) => postJson<{ account: Account }>(`/api/me/${paused ? 'pause' : 'resume'}`),
    onSuccess: ({ account }) => queryClient.setQueryData(ME_QUERY_KEY, account),
  });
}
