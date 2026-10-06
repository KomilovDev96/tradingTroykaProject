import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postJson } from '../../../shared/api/httpClient';
import type { StrategyId } from '../../../entities/strategy/model/types';

/**
 * Section 10: «Закрыть позицию» closes only this account's position (never a real order).
 * Other accounts keep theirs, so no shared WebSocket event fires — refresh our own lists here.
 */
export function useClosePosition(strategy: StrategyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson('/api/close-position', { strategy }),
    onSettled: () =>
      queryClient.invalidateQueries({ predicate: (q) => ['open-trades', 'trades', 'stats'].includes(q.queryKey[0] as string) }),
  });
}
