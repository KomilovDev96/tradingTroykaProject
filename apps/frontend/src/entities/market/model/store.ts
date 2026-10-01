import { create } from 'zustand';
import type { Candle, EngineOutput } from '../../strategy/model/types';
import { BROWSER_TIMEZONE } from '../../../shared/lib/time';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

interface MarketState {
  instrument: string | null;
  connectionStatus: ConnectionStatus;
  candles: Candle[];
  output: EngineOutput | null;
  timezone: string;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setTimezone: (tz: string) => void;
  applySnapshot: (payload: { instrument: string; candles: Candle[]; output: EngineOutput | null }) => void;
  applyUpdate: (payload: { output: EngineOutput; candles: Candle[] }) => void;
}

/** Live engine state only. Trade history/statistics are backed by PostgreSQL — see entities/trade. */
export const useMarketStore = create<MarketState>((set) => ({
  instrument: null,
  connectionStatus: 'connecting',
  candles: [],
  output: null,
  timezone: BROWSER_TIMEZONE,

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setTimezone: (tz) => set({ timezone: tz }),
  applySnapshot: ({ instrument, candles, output }) => set({ instrument, candles, output }),
  applyUpdate: ({ output, candles }) => set({ output, candles }),
}));
