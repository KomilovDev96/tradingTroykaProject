import { useMutation } from '@tanstack/react-query';
import { BACKEND_HTTP_URL } from '../../../shared/api/config';

async function setAnalysisPaused(paused: boolean) {
  const res = await fetch(`${BACKEND_HTTP_URL}/api/analysis/${paused ? 'pause' : 'resume'}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Запрос не выполнен (${res.status})`);
  return res.json() as Promise<{ paused: boolean }>;
}

/** "Остановить / Продолжить анализ". The new phase arrives over the market WebSocket. */
export function useToggleAnalysis() {
  return useMutation({ mutationFn: setAnalysisPaused });
}
