'use client';

import { Flexbox } from '@lobehub/ui';
import type { TabsItem } from '@lobehub/ui/base-ui';
import { Alert, Button, Tabs, Text } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import AsyncError from '@/components/AsyncError';
import { useCategory } from '@/features/AgentSetting/AgentCategory/useCategory';
import AgentSettings from '@/features/AgentSetting/AgentSettings';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { usePermission } from '@/hooks/usePermission';
import { useQueryState } from '@/hooks/useQueryParam';
import ParamsSection from '@/routes/(main)/agent/features/Conversation/WorkingSidebar/ParamsSection';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors, agentSelectors } from '@/store/agent/selectors';
import { ChatSettingsTabs } from '@/store/global/initialState';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';
import { useSaveFeedback } from './useSaveFeedback';

export const MobileAgentSettings = () => {
  const { t } = useTranslation(['common', 'setting']);
  const navigate = useWorkspaceAwareNavigate();
  const { aid = '' } = useParams<{ aid: string }>();
  const [section, setSection] = useQueryState('section', { history: 'replace' });
  const categories = useCategory({ mobile: true });
  const { allowed: canEdit } = usePermission('edit_own_content');
  const { save, retry, status } = useSaveFeedback();
  const error = useAgentStore(agentSelectors.currentAgentConfigError);
  const retryConfig = useAgentStore((s) => s.retryAgentConfigFetch);
  const [updateConfig, updateMeta, config, meta, isLoading, isHeterogeneous] = useAgentStore(
    (s) => [
      s.updateAgentConfigById,
      s.optimisticUpdateAgentMeta,
      agentByIdSelectors.getAgentConfigById(aid)(s),
      agentSelectors.getAgentMetaById(aid)(s),
      agentByIdSelectors.isAgentConfigLoadingById(aid)(s),
      agentByIdSelectors.isAgentHeterogeneousById(aid)(s),
    ],
  );
  const items: TabsItem[] = [
    ...((categories ?? []) as TabsItem[]),
    ...(!isHeterogeneous
      ? [{ key: 'params', label: t('settingModel.params.title', { ns: 'setting' }) }]
      : []),
  ];
  const activeTab = items.some((item) => item.key === section) ? section! : ChatSettingsTabs.Prompt;

  return (
    <Flexbox className={styles.page}>
      <MobilePageHeader
        subtitle={meta?.title}
        title={t('header.session', { ns: 'setting' })}
        onBack={() => navigate(`/agent/${aid}`)}
      />
      <div className={styles.tabs}>
        <Tabs
          activeKey={activeTab}
          items={items}
          styles={{ list: { width: 'max-content', minWidth: '100%' }, tab: { minHeight: 44 } }}
          onChange={setSection}
        />
      </div>
      <Flexbox className={styles.scroll}>
        <Flexbox className={cx(styles.content, styles.settings)} gap={16}>
          <Button onClick={() => navigate(`/agent/${aid}/profile`)}>
            {t('mobile.agentProfile')}
          </Button>
          {error && <AsyncError error={error} onRetry={retryConfig} />}
          {status === 'error' && (
            <Alert
              action={<Button onClick={() => void retry()}>{t('retry')}</Button>}
              title={t('mobile.saveFailed')}
              type={'error'}
            />
          )}
          {error ? null : activeTab === 'params' ? (
            <ParamsSection />
          ) : (
            <>
              <Text aria-live={'polite'} fontSize={12} type={'secondary'}>
                {status === 'saving'
                  ? t('mobile.saving')
                  : status === 'saved'
                    ? t('mobile.saved')
                    : t('mobile.autoSave')}
              </Text>
              <AgentSettings
                config={config}
                disabled={!canEdit}
                id={aid}
                loading={isLoading}
                meta={meta}
                tab={activeTab as ChatSettingsTabs}
                onConfigChange={(next) => save(() => updateConfig(aid, next))}
                onMetaChange={(next) => save(() => updateMeta(aid, next))}
              />
            </>
          )}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
