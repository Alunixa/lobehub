import type { ConversationFeatures } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { Button, Switch } from '@lobehub/ui/base-ui';
import { cssVar } from 'antd-style';
import { memo, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { useConversationFeatureControls } from './useConversationFeatureControls';

const OPTIONS = [
  'typingAwareness',
  'inputTimestamps',
  'outputTimestamps',
  'modelIdentity',
  'proactiveMessages',
  'proactiveNotifications',
  'proactiveRepeats',
  'compressImages',
  'compressRequests',
] as const satisfies Array<keyof ConversationFeatures>;

const ConversationFeaturesControls = memo<{ disabled?: boolean }>(({ disabled }) => {
  const fieldId = useId();
  const { t } = useTranslation('setting');
  const {
    capabilities,
    context,
    current,
    detail,
    isCli,
    plan,
    pushUnavailable,
    retry,
    save,
    saveState,
  } = useConversationFeatureControls();
  const failedRead = detail.error || capabilities.error;
  return (
    <Flexbox data-testid="conversation-feature-controls" gap={12} paddingBlock={12}>
      <Flexbox style={{ color: cssVar.colorTextSecondary, fontSize: 12 }}>
        {t(
          context?.topicId
            ? 'conversationFeatures.scope.current'
            : 'conversationFeatures.scope.defaults',
        )}
      </Flexbox>
      {OPTIONS.map((key) => (
        <Flexbox gap={4} key={key}>
          <Flexbox horizontal align={'center'} gap={12} justify={'space-between'}>
            <label htmlFor={`${fieldId}-${key}`}>{t(`conversationFeatures.${key}.title`)}</label>
            <Switch
              checked={Boolean(current[key])}
              id={`${fieldId}-${key}`}
              size={'small'}
              title={t(`conversationFeatures.${key}.title`)}
              disabled={
                disabled ||
                (isCli && !current[key]) ||
                Boolean(failedRead) ||
                detail.isLoading ||
                saveState === 'saving' ||
                (key === 'compressRequests' &&
                  !current[key] &&
                  capabilities.data?.requestCompressionAvailable !== true) ||
                (key === 'proactiveMessages' &&
                  !current[key] &&
                  (Boolean(context?.groupId) || capabilities.data?.backgroundAvailable !== true))
              }
              onChange={(checked) => {
                void save(key, checked);
              }}
            />
          </Flexbox>
          <Flexbox style={{ color: cssVar.colorTextTertiary, fontSize: 12 }}>
            {t(`conversationFeatures.${key}.desc`)}
          </Flexbox>
        </Flexbox>
      ))}
      {current.proactiveMessages && plan?.status === 'scheduled' && (
        <span>
          {t('conversationFeatures.nextPlan', { time: new Date(plan.dueAt).toLocaleString() })}
        </span>
      )}
      {isCli && <span>{t('conversationFeatures.cliUnavailable')}</span>}
      {context?.groupId && <span>{t('conversationFeatures.groupUnavailable')}</span>}
      {failedRead && (
        <Flexbox gap={4}>
          <span>{t('conversationFeatures.readFailed')}</span>
          <Button
            size={'small'}
            onClick={() => {
              void capabilities.mutate();
              void detail.mutate();
            }}
          >
            {t('conversationFeatures.retry')}
          </Button>
        </Flexbox>
      )}
      {pushUnavailable && <span>{t('conversationFeatures.pushUnavailable')}</span>}
      {current.proactiveNotifications && capabilities.data?.webPushPublicKey && (
        <Button
          disabled={saveState === 'saving'}
          size={'small'}
          onClick={() => {
            void save('proactiveNotifications', true);
          }}
        >
          {t('conversationFeatures.enrollPush')}
        </Button>
      )}
      {saveState !== 'idle' && (
        <Flexbox horizontal align={'center'} gap={8}>
          <span>{t(`conversationFeatures.save.${saveState}`)}</span>
          {saveState === 'failed' && (
            <Button size={'small'} onClick={retry}>
              {t('conversationFeatures.retry')}
            </Button>
          )}
        </Flexbox>
      )}
    </Flexbox>
  );
});
export default ConversationFeaturesControls;
