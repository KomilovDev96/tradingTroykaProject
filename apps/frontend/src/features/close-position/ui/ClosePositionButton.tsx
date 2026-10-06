import { App, Button, Popconfirm, Tooltip, type ButtonProps } from 'antd';
import { ApiError } from '../../../shared/api/httpClient';
import { translateError, useT } from '../../../shared/i18n';
import type { StrategyId } from '../../../entities/strategy/model/types';
import { useOpenTradesQuery } from '../../../entities/trade/api/queries';
import { useClosePosition } from '../model/useClosePosition';

/**
 * «Закрыть позицию» with a confirm step, shared by the chart overlay, the signal panel and the open trades table.
 * Always visible to everyone: inactive (with a hint) while the account holds no position of this strategy.
 */
export function ClosePositionButton({ strategy, children, ...buttonProps }: ButtonProps & { strategy: StrategyId }) {
  const t = useT();
  const { message } = App.useApp();
  const closePosition = useClosePosition(strategy);
  const hasPosition = (useOpenTradesQuery(strategy).data?.length ?? 0) > 0;
  const hint = hasPosition ? null : t('signal.closeNoPosition');

  const handleClose = async () => {
    try {
      await closePosition.mutateAsync();
      message.success(t('signal.closedOk'));
    } catch (err) {
      message.error(err instanceof ApiError ? translateError(t, err.code, err.status) : t('signal.closeFailed'));
    }
  };

  if (hint) {
    // A disabled button swallows hover events, so the tooltip sits on a wrapper.
    return (
      <Tooltip title={hint}>
        <span style={{ display: 'inline-block' }}>
          <Button danger disabled {...buttonProps}>
            {children ?? t('signal.closePosition')}
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <Popconfirm
      title={t('signal.closeConfirm')}
      okText={t('signal.closeConfirmOk')}
      cancelText={t('signal.closeConfirmCancel')}
      okButtonProps={{ danger: true }}
      placement="bottom" // opening upwards, the chart overlay's confirm hides under the sticky header
      onConfirm={handleClose}
    >
      <Button danger loading={closePosition.isPending} {...buttonProps}>
        {children ?? t('signal.closePosition')}
      </Button>
    </Popconfirm>
  );
}
