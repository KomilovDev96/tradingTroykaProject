import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { BACKEND_WS_URL } from '../../../shared/api/config';
import { useMarketStore } from '../../../entities/market/model/store';

const RECONNECT_DELAY_MS = 2000;

/** Owns the single WebSocket connection to the backend engine and feeds the market store. */
export function useMarketSocket() {
  const applySnapshot = useMarketStore((s) => s.applySnapshot);
  const applyUpdate = useMarketStore((s) => s.applyUpdate);
  const applyLongTermUpdate = useMarketStore((s) => s.applyLongTermUpdate);
  const setConnectionStatus = useMarketStore((s) => s.setConnectionStatus);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setConnectionStatus('connecting');
      socket = new WebSocket(BACKEND_WS_URL);

      socket.onopen = () => setConnectionStatus('open');

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'snapshot') {
          applySnapshot({
            instrument: message.instrument,
            candles: message.candles ?? [],
            output: message.output ?? null,
            longTerm: message.longTerm,
          });
        } else if (message.type === 'update') {
          applyUpdate({ output: message.output, candles: message.candles ?? [] });
        } else if (message.type === 'update-long-term') {
          applyLongTermUpdate({ output: message.output, candles: message.candles ?? [] });
        } else if (message.type === 'trades-changed') {
          // Section 41: dashboard/trade journal refresh automatically, no manual reload.
          queryClient.invalidateQueries({ predicate: (q) => ['open-trades', 'trades', 'stats'].includes(q.queryKey[0] as string) });
        }
      };

      socket.onclose = () => {
        setConnectionStatus('closed');
        if (!cancelled) reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socket?.close();
    };
  }, [applySnapshot, applyUpdate, applyLongTermUpdate, setConnectionStatus, queryClient]);
}
