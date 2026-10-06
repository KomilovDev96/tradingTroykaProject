import { useEffect, useRef, type ReactNode } from 'react';
import { Grid } from 'antd';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '../../entities/strategy/model/types';

export interface ChartLevel {
  price: number | null;
  color: string;
  title: string;
  /** lightweight-charts LineStyle: 0 solid, 2 dashed (default). */
  lineStyle?: number;
}

interface TradingChartProps {
  candles: Candle[];
  /** Horizontal price lines; null prices are skipped. */
  levels: ChartLevel[];
  /** Rendered on top of the chart's top-left corner, e.g. the open position with its close button. */
  overlay?: ReactNode;
}

export function TradingChart(props: TradingChartProps) {
  const screens = Grid.useBreakpoint();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0d1117' }, textColor: '#c9d1d9' },
      grid: { vertLines: { color: '#161b22' }, horzLines: { color: '#161b22' } },
      timeScale: { timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.setData(
      props.candles.map((c) => ({
        time: Math.floor(c.time / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
  }, [props.candles]);

  // Keyed by content: the levels array is rebuilt on every tick, the lines only when a price/title changes.
  const levelsKey = JSON.stringify(props.levels);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];

    for (const level of JSON.parse(levelsKey) as ChartLevel[]) {
      if (level.price === null) continue;
      const line = series.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: level.lineStyle ?? 2,
        axisLabelVisible: true,
        title: level.title,
      });
      priceLinesRef.current.push(line);
    }
  }, [levelsKey]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: screens.md ? 420 : 300 }} />
      {props.overlay && <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 3 }}>{props.overlay}</div>}
    </div>
  );
}
