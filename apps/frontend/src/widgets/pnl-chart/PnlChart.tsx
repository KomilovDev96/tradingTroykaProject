import { Card, Empty } from 'antd';
import type { PnlCurvePoint } from '../../entities/trade/model/types';
import { useT } from '../../shared/i18n';

interface PnlChartProps {
  data: PnlCurvePoint[] | undefined;
  loading?: boolean;
  height?: number;
}

/** Section 36 — cumulative P&L curve, built strictly from real closed trades (never synthetic). */
export function PnlChart({ data, loading, height = 220 }: PnlChartProps) {
  const points = data ?? [];
  const t = useT();

  if (!loading && points.length === 0) {
    return (
      <Card title={t('pnl.title')}>
        <Empty description={t('pnl.empty')} />
      </Card>
    );
  }

  const width = 800;
  const padding = 32;
  const values = points.map((p) => p.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const xFor = (i: number) => padding + (i / Math.max(1, points.length - 1)) * (width - padding * 2);
  const yFor = (v: number) => height - padding - ((v - min) / range) * (height - padding * 2);
  const zeroY = yFor(0);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.cumulative)}`).join(' ');
  const last = points[points.length - 1];
  const lineColor = last && last.cumulative >= 0 ? '#3fb950' : '#f85149';

  return (
    <Card title={t('pnl.title')} loading={loading}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={t('pnl.aria')}>
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#30363d" strokeDasharray="4 4" />
        <path d={path} fill="none" stroke={lineColor} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(p.cumulative)} r={2.5} fill={lineColor}>
            <title>{t('pnl.point', { n: p.tradeIndex, pnl: `${p.pnlPoints >= 0 ? '+' : ''}${p.pnlPoints.toFixed(2)}`, total: p.cumulative.toFixed(2) })}</title>
          </circle>
        ))}
      </svg>
    </Card>
  );
}
