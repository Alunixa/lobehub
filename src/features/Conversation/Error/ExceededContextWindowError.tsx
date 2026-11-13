import { Flexbox, Icon, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Minimize2, RotateCw } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { usePermission } from '@/hooks/usePermission';
import { useChatStore } from '@/store/chat';

import { useConversationStore } from '../store';
import { useRetryParentMessage } from './useRetryParentMessage';

interface ExceededContextWindowErrorProps {
  id: string;
  parentMessageId?: string;
}

const ExceededContextWindowError = memo<ExceededContextWindowErrorProps>(
  ({ id, parentMessageId }) => {
    const { t } = useTranslation('error');
    const { allowed: canCreate } = usePermission('create_content');

    const context = useConversationStore((s) => s.context);
    const { disabled, loading, retryParentMessage } = useRetryParentMessage(id, parentMessageId);

    const handleCompact = useCallback(async () => {
      if (!canCreate || !context.topicId) return;

      await retryParentMessage(() => useChatStore.getState().executeCompression(context, ''));
    }, [canCreate, context, retryParentMessage]);

    return (
      <Flexbox gap={4} paddingBlock={4} role={'status'}>
        <Text fontSize={12} type={'secondary'}>
          {t('exceededContext.desc')}
        </Text>
        <Flexbox horizontal gap={4} wrap={'wrap'}>
          <Button
            disabled={!canCreate || disabled}
            icon={<Icon icon={RotateCw} size={12} />}
            loading={loading}
            size={'small'}
            type={'text'}
            onClick={() => retryParentMessage()}
          >
            {t('exceededContext.retry')}
          </Button>
          <Button
            disabled={!canCreate || !context.topicId || disabled}
            icon={<Icon icon={Minimize2} size={12} />}
            loading={loading}
            size={'small'}
            type={'text'}
            onClick={handleCompact}
          >
            {t('exceededContext.compact')}
          </Button>
        </Flexbox>
      </Flexbox>
    );
  },
);

export default ExceededContextWindowError;
