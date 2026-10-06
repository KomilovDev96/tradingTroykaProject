import type { Candle, EngineOutput, LongTermOutput, LongTermPhase, LongTermPosition, Speedometer, StrategyPhase } from '@troyka/strategy-engine';

export type { Candle, EngineOutput, LongTermOutput, LongTermPhase, LongTermPosition, Speedometer, StrategyPhase };

/** `Trade.strategy`: the 5M scalping Troika and the H1 long-term Troika. */
export type StrategyId = 'TROYKA' | 'TROYKA_H1';
export const SCALPING: StrategyId = 'TROYKA';
export const LONG_TERM: StrategyId = 'TROYKA_H1';
