import { create } from 'zustand';
import type { Candle, EngineOutput, LongTermOutput } from '../../strategy/model/types';
import { BROWSER_TIMEZONE } from '../../../shared/lib/time';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

interface MarketState {
  instrument: string | null;
  connectionStatus: ConnectionStatus;
  candles: Candle[];
  output: EngineOutput | null;
  /** The long-term (H1) engine: its own candles and output. */
  longTermCandles: Candle[];
  longTermOutput: LongTermOutput | null;
  timezone: string;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setTimezone: (tz: string) => void;
  applySnapshot: (payload: {
    instrument: string;
    candles: Candle[];
    output: EngineOutput | null;
    longTerm?: { candles: Candle[]; output: LongTermOutput | null };
  }) => void;
  applyUpdate: (payload: { output: EngineOutput; candles: Candle[] }) => void;
  applyLongTermUpdate: (payload: { output: LongTermOutput; candles: Candle[] }) => void;
}

/** Live engine state only. Trade history/statistics are backed by PostgreSQL — see entities/trade. */
export const useMarketStore = create<MarketState>((set) => ({
  instrument: null,
  connectionStatus: 'connecting',
  candles: [],
  output: null,
  longTermCandles: [],
  longTermOutput: null,
  timezone: BROWSER_TIMEZONE,

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setTimezone: (tz) => set({ timezone: tz }),
  applySnapshot: ({ instrument, candles, output, longTerm }) =>
    set({ instrument, candles, output, longTermCandles: longTerm?.candles ?? [], longTermOutput: longTerm?.output ?? null }),
  applyUpdate: ({ output, candles }) => set({ output, candles }),
  applyLongTermUpdate: ({ output, candles }) => set({ longTermOutput: output, longTermCandles: candles }),
}));
