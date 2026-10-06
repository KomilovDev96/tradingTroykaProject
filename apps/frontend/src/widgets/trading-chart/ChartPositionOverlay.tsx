import { Space, Tag } from 'antd';
import { useMarketStore } from '../../entities/market/model/store';
import { useOpenTradesQuery } from '../../entities/trade/api/queries';
import { LONG_TERM, type StrategyId } from '../../entities/strategy/model/types';
import { ClosePositionButton } from '../../features/close-position/ui/ClosePositionButton';
import { useT } from '../../shared/i18n';

/** On top of the chart: «Закрыть позицию» for everyone, plus direction and live P&L while this account holds a position. */
export function ChartPositionOverlay({ strategy }: { strategy: StrategyId }) {
  const t = useT();
  const myPosition = useOpenTradesQuery(strategy).data?.[0] ?? null;
  const currentPrice = useMarketStore((s) => (strategy === LONG_TERM ? s.longTermOutput : s.output)?.currentPrice ?? null);

  const pnl =
    !myPosition || currentPrice === null
      ? null
      : myPosition.direction === 'BUY'
        ? currentPrice - myPosition.entryPrice
        : myPosition.entryPrice - currentPrice;

  return (
    <Space size={8} wrap style={{ background: 'rgba(13, 17, 23, 0.85)', border: '1px solid #30363d', borderRadius: 6, padding: '6px 8px' }}>
      {myPosition && (
        <>
          <Tag color={myPosition.direction === 'BUY' ? 'success' : 'error'} style={{ margin: 0 }}>
            {myPosition.direction}
          </Tag>
          <span style={{ color: '#c9d1d9' }}>
            {t('signal.pnlPoints')}:{' '}
            <b style={{ color: pnl !== null && pnl < 0 ? '#f85149' : '#3fb950' }}>{pnl === null ? '—' : pnl.toFixed(2)}</b>
          </span>
        </>
      )}
      <ClosePositionButton strategy={strategy} type="primary" size="small" />
    </Space>
  );
}
