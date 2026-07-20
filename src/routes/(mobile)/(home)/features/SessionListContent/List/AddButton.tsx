import { AGENT_CHAT_URL } from '@lobechat/const';
import { Button, Flexbox } from '@lobehub/ui';
import { Plus } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useActionSWR } from '@/libs/swr';
import { sessionKeys } from '@/libs/swr/keys';
import { useHomeStore } from '@/store/home';
import { useServerConfigStore } from '@/store/serverConfig';
import { useSessionStore } from '@/store/session';

const AddButton = memo<{ groupId?: string }>(({ groupId }) => {
  const { t } = useTranslation('chat');
  const createSession = useSessionStore((s) => s.createSession);
  const refreshAgentList = useHomeStore((s) => s.refreshAgentList);
  const mobile = useServerConfigStore((s) => s.isMobile);
  const navigate = useWorkspaceAwareNavigate();
  const { mutate, isValidating } = useActionSWR(sessionKeys.createSession(groupId), async () => {
    const id = await createSession({ group: groupId }, false);
    await refreshAgentList();
    navigate(AGENT_CHAT_URL(id, false));
    return id;
  });

  return (
    <Flexbox flex={1} padding={mobile ? 16 : 0}>
      <Button
        block
        icon={Plus}
        loading={isValidating}
        variant={'filled'}
        style={{
          marginTop: 8,
        }}
        onClick={() => mutate()}
      >
        {t('newAgent')}
      </Button>
    </Flexbox>
  );
});

export default AddButton;
