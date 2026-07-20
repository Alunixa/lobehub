'use client';

import { Tabs } from '@lobehub/ui/base-ui';
import { cssVar } from 'antd-style';
import { memo, useState } from 'react';
import { useParams } from 'react-router';

import MobileContentLayout from '@/components/server/MobileNavLayout';
import { useCategory } from '@/features/AgentSetting/AgentCategory/useCategory';
import AgentSettings from '@/features/AgentSetting/AgentSettings';
import Footer from '@/features/Setting/Footer';
import { usePermission } from '@/hooks/usePermission';
import MobileHeader from '@/routes/(mobile)/chat/settings/_layout/Header';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors, agentSelectors } from '@/store/agent/selectors';
import { ChatSettingsTabs } from '@/store/global/initialState';

export default memo(() => {
  const [tab, setTab] = useState(ChatSettingsTabs.Prompt);
  const cateItems = useCategory();
  const { aid = '' } = useParams<{ aid: string }>();
  const { allowed: canEdit } = usePermission('edit_own_content');

  const [updateAgentConfigById, optimisticUpdateAgentMeta, config, meta, isLoading] = useAgentStore(
    (s) => [
      s.updateAgentConfigById,
      s.optimisticUpdateAgentMeta,
      agentByIdSelectors.getAgentConfigById(aid)(s),
      agentSelectors.getAgentMetaById(aid)(s),
      agentByIdSelectors.isAgentConfigLoadingById(aid)(s),
    ],
  );

  const handleConfigChange = (nextConfig: Parameters<typeof updateAgentConfigById>[1]) =>
    updateAgentConfigById(aid, nextConfig);
  const handleMetaChange = (nextMeta: Parameters<typeof optimisticUpdateAgentMeta>[1]) =>
    optimisticUpdateAgentMeta(aid, nextMeta);

  return (
    <MobileContentLayout header={<MobileHeader />}>
      <Tabs
        activeKey={tab}
        items={cateItems as any}
        style={{
          borderBottom: `1px solid ${cssVar.colorBorderSecondary}`,
        }}
        onChange={(value) => setTab(value as ChatSettingsTabs)}
      />
      <AgentSettings
        config={config}
        disabled={!canEdit}
        id={aid}
        loading={isLoading}
        meta={meta}
        tab={tab}
        onConfigChange={handleConfigChange}
        onMetaChange={handleMetaChange}
      />
      <Footer />
    </MobileContentLayout>
  );
});
