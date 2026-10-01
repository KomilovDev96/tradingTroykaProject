import { useMutation } from '@tanstack/react-query';
import { BACKEND_HTTP_URL } from '../../../shared/api/config';

const ERROR_TRANSLATIONS: Record<string, string> = {
  'Engine has no data yet': 'Движок ещё не получил данные',
  'No active position to close': 'Нет активной позиции для закрытия',
};

async function closePosition() {
  const res = await fetch(`${BACKEND_HTTP_URL}/api/close-position`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const raw: string | undefined = body.error;
    throw new Error((raw && ERROR_TRANSLATIONS[raw]) ?? raw ?? `Запрос не выполнен (${res.status})`);
  }
  return res.json();
}

/** Section 10: manual "Закрыть анализ / Позиция закрыта" action. Never sends a real order. */
export function useClosePosition() {
  return useMutation({ mutationFn: closePosition });
}
