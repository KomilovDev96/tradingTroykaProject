import { useEffect, useRef } from 'react';
import { Grid } from 'antd';
import { useT } from '../../shared/i18n';
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

interface Level {
  price: number | null;
  color: string;
  title: string;
}

interface TradingChartProps {
  candles: Candle[];
  highDemand: number | null;
  lowDemand: number | null;
  upperLevel: number | null;
  lowerLevel: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  currentPrice: number | null;
}

export function TradingChart(props: TradingChartProps) {
  const screens = Grid.useBreakpoint();
  const t = useT();
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

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];

    const levels: Level[] = [
      { price: props.highDemand, color: '#e0a800', title: t('chart.highDemand') },
      { price: props.lowDemand, color: '#e0a800', title: t('chart.lowDemand') },
      { price: props.upperLevel, color: '#58a6ff', title: t('chart.upperLevel') },
      { price: props.lowerLevel, color: '#58a6ff', title: t('chart.lowerLevel') },
      { price: props.entryPrice, color: '#3fb950', title: t('chart.entry') },
      { price: props.stopLoss, color: '#f85149', title: 'STOP LOSS' },
    ];

    for (const level of levels) {
      if (level.price === null) continue;
      const line = series.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.title,
      });
      priceLinesRef.current.push(line);
    }
  }, [props.highDemand, props.lowDemand, props.upperLevel, props.lowerLevel, props.entryPrice, props.stopLoss, t]);

  return <div ref={containerRef} style={{ width: '100%', height: screens.md ? 420 : 300 }} />;
}
