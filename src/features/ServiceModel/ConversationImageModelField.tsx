'use client';

import type { SystemAgentItem } from '@lobechat/types';
import { Alert, Flexbox, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import ModelSelect from '@/features/ModelSelect';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

import { useConversationImageModelField } from './useConversationImageModelField';

interface ConversationImageModelFieldProps {
  disabled?: boolean;
  onChange: (value: Partial<SystemAgentItem>) => Promise<void>;
  value: SystemAgentItem;
}

export const ConversationImageModelField = memo<ConversationImageModelFieldProps>(
  ({ disabled, onChange, value }) => {
    const { t } = useTranslation('setting');
    const navigate = useWorkspaceAwareNavigate();
    const { empty, error, retry, save, selection, status, unavailable } =
      useConversationImageModelField({ disabled, onChange, value });

    return (
      <Flexbox gap={8} style={{ width: 'min(100%, 448px)' }}>
        <ModelSelect
          disabled={disabled || status === 'saving'}
          loading={status === 'saving'}
          modelType={'image'}
          noneLabel={t('systemAgent.conversationImage.none')}
          showAbility={false}
          style={{ minWidth: 0, width: '100%' }}
          value={selection ?? { model: '', provider: '' }}
          onChange={({ model, provider }) =>
            save({ enabled: !!model && !!provider, model, provider })
          }
        />
        {unavailable && (
          <Alert title={t('systemAgent.conversationImage.unavailable')} type={'warning'} />
        )}
        {empty && (
          <Text fontSize={12} type={'secondary'}>
            {t('systemAgent.conversationImage.empty')}
          </Text>
        )}
        {status === 'saved' && (
          <Text fontSize={12} type={'secondary'}>
            {t('systemAgent.conversationImage.saved')}
          </Text>
        )}
        {status === 'failed' && <AsyncError error={error} onRetry={disabled ? undefined : retry} />}
        <Button
          size={'small'}
          style={{ alignSelf: 'flex-start' }}
          type={'text'}
          onClick={() => navigate('/settings/provider/all')}
        >
          {t('systemAgent.conversationImage.manageModels')}
        </Button>
      </Flexbox>
    );
  },
);

ConversationImageModelField.displayName = 'ConversationImageModelField';
