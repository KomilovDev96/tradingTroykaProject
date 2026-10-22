import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../../shared/api/httpClient';

export interface AiAnalysis {
  id: number;
  time: number;
  decision: 'BUY' | 'SELL' | 'SKIP';
  analysis: string;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  rejected: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

export interface AiPosition {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  initialStopLoss: number;
  stopLoss: number;
  takeProfit: number;
  stage: number;
  pnlPoints: number;
  openedAt: number;
}

export interface AiStatus {
  configured: boolean;
  enabled: boolean;
  analyzing: boolean;
  model: string;
  intervalSec: number;
  nextAnalysisAt: number | null;
  price: number | null;
  position: AiPosition | null;
  last: AiAnalysis | null;
  history: AiAnalysis[];
  lastError: string | null;
  usage: { requests: number; inputTokens: number; outputTokens: number; since: number; costUsd: number; priceKnown: boolean; inputPerMTok: number | null; outputPerMTok: number | null };
  rateLimit: {
    requestsRemaining: number | null;
    requestsLimit: number | null;
    inputTokensRemaining: number | null;
    inputTokensLimit: number | null;
    outputTokensRemaining: number | null;
    outputTokensLimit: number | null;
  } | null;
}

const KEY = ['ai-status'] as const;

export function useAiStatus() {
  return useQuery({ queryKey: KEY, queryFn: () => getJson<AiStatus>('/api/ai/status'), refetchInterval: 3000 });
}

export function useAiToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => postJson<AiStatus>(enabled ? '/api/ai/enable' : '/api/ai/disable'),
    onSuccess: (status) => queryClient.setQueryData(KEY, status),
  });
}

export function useAiClosePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson('/api/ai/close-position'),
    onSettled: () =>
      queryClient.invalidateQueries({ predicate: (q) => ['ai-status', 'open-trades', 'trades', 'stats'].includes(q.queryKey[0] as string) }),
  });
}
