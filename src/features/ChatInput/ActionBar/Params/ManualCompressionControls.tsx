import type { ConversationContext } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useManualCompression } from './useManualCompression';

const ManualCompressionControls = memo<{ context?: ConversationContext; disabled?: boolean }>(
  ({ context, disabled }) => {
    const { t } = useTranslation('setting');
    const { busy, canCompress, cancel, compress, generating, hasSummary, state, undo } =
      useManualCompression(context);
    return (
      <Flexbox data-testid="manual-compression-controls" gap={6}>
        <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
          <span>{t('manualCompression.title')}</span>
          <Button
            disabled={disabled || !canCompress || busy || generating}
            size={'small'}
            onClick={() => void compress()}
          >
            {t('manualCompression.action')}
          </Button>
        </Flexbox>
        <span style={{ color: cssVar.colorTextTertiary, fontSize: 12 }}>
          {t('manualCompression.desc')}
        </span>
        <Flexbox horizontal align={'center'} gap={8}>
          {state !== 'idle' && (
            <span role={'status'}>{t(`manualCompression.status.${state}`)}</span>
          )}
          {busy && state === 'compressing' && (
            <Button size={'small'} onClick={cancel}>
              {t('manualCompression.cancel')}
            </Button>
          )}
          {hasSummary && (
            <Button
              disabled={disabled || busy || generating}
              size={'small'}
              onClick={() => void undo()}
            >
              {t('manualCompression.undo')}
            </Button>
          )}
        </Flexbox>
      </Flexbox>
    );
  },
);
export default ManualCompressionControls;
