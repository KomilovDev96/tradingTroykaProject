import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postJson } from '../../../shared/api/httpClient';

/**
 * Section 10: «Закрыть позицию» closes only this account's position (never a real order).
 * Other accounts keep theirs, so no shared WebSocket event fires — refresh our own lists here.
 */
export function useClosePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson('/api/close-position'),
    onSettled: () =>
      queryClient.invalidateQueries({ predicate: (q) => ['open-trades', 'trades', 'stats'].includes(q.queryKey[0] as string) }),
  });
}
