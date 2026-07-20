'use client';

import { ActionIcon, type DropdownItem, DropdownMenu, Flexbox, Icon } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { Brain, Settings2, Sparkles } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MOBILE_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import ShareButton from '@/routes/(main)/agent/features/Conversation/Header/ShareButton';
import { useAgentStore } from '@/store/agent';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import ChatHeaderTitle from './ChatHeaderTitle';

const MobileHeader = memo(() => {
  const { t } = useTranslation('setting');
  const navigate = useWorkspaceAwareNavigate();
  const [open, setOpen] = useState(false);
  const agentId = useAgentStore((s) => s.activeAgentId);
  const showProvider = useServerConfigStore(featureFlagsSelectors).showProvider;

  const settingsItems = useMemo(
    (): DropdownItem[] => [
      {
        icon: <Icon icon={Settings2} />,
        key: 'agent-settings',
        label: t('header.session'),
        onClick: () => {
          if (agentId) navigate(`/agent/${agentId}/settings`);
        },
      },
      ...(showProvider
        ? [
            {
              icon: <Icon icon={Brain} />,
              key: 'provider-settings',
              label: t('tab.provider'),
              onClick: () => navigate('/settings/provider/all', { escape: true }),
            },
          ]
        : []),
      {
        icon: <Icon icon={Sparkles} />,
        key: 'service-model-settings',
        label: t('tab.serviceModel'),
        onClick: () => navigate('/settings/service-model', { escape: true }),
      },
    ],
    [agentId, navigate, showProvider, t],
  );

  return (
    <ChatHeader
      showBackButton
      center={<ChatHeaderTitle />}
      style={{ width: '100%' }}
      right={
        <Flexbox horizontal align="center" gap={2}>
          <DropdownMenu items={settingsItems}>
            <ActionIcon
              icon={Settings2}
              size={MOBILE_HEADER_ICON_SIZE}
              title={t('header.session')}
            />
          </DropdownMenu>
          <ShareButton mobile open={open} setOpen={setOpen} />
        </Flexbox>
      }
      onBackClick={() =>
        // `/agent` index redirects to `..` (mobile home / session list), preserving
        // workspace scope; the old `?session=` query was never read by the target.
        navigate('/agent', { replace: true })
      }
    />
  );
});

export default MobileHeader;
