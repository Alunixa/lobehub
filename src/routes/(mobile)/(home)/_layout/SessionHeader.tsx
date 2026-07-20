'use client';

import { AGENT_CHAT_URL } from '@lobechat/const';
import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { MessageSquarePlus } from 'lucide-react';
import { memo, useCallback } from 'react';

import { ProductLogo } from '@/components/Branding';
import { MOBILE_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import UserAvatar from '@/features/User/UserAvatar';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useHomeStore } from '@/store/home';
import { useSessionStore } from '@/store/session';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import { styles } from './SessionHeader/style';

const Header = memo(() => {
  const createSession = useSessionStore((s) => s.createSession);
  const refreshAgentList = useHomeStore((s) => s.refreshAgentList);
  const navigate = useWorkspaceAwareNavigate();

  const handleCreateAgent = useCallback(async () => {
    const id = await createSession(undefined, false);
    await refreshAgentList();
    navigate(AGENT_CHAT_URL(id, false));
  }, [createSession, navigate, refreshAgentList]);

  return (
    <ChatHeader
      style={mobileHeaderSticky}
      left={
        <Flexbox horizontal align={'center'} className={styles.leftContainer} gap={8}>
          <UserAvatar size={32} onClick={() => navigate('/me')} />
          <ProductLogo type={'text'} />
        </Flexbox>
      }
      right={
        <ActionIcon
          icon={MessageSquarePlus}
          size={MOBILE_HEADER_ICON_SIZE}
          onClick={handleCreateAgent}
        />
      }
    />
  );
});

export default Header;
