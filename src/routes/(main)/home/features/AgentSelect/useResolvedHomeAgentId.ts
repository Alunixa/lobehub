import { resolveHomeAgentId } from '@/features/HomeChat/selection';
import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useHomeStore } from '@/store/home';
import { homeAgentListSelectors } from '@/store/home/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

interface ResolvedHomeAgent {
  agentId: string | undefined;
  isInbox: boolean;
}

/** Resolve the account-synced home preference after the agent list has loaded. */
export const useResolvedHomeAgentId = (): ResolvedHomeAgent => {
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const selectedAgentId = useUserStore(
    (s) => settingsSelectors.currentSettings(s).general.homeDefaultAgentId,
  );
  const isAgentListInit = useHomeStore(homeAgentListSelectors.isAgentListInit);
  const sidebarItem = useHomeStore(homeAgentListSelectors.getAgentById(selectedAgentId ?? ''));
  const agentId = resolveHomeAgentId(
    selectedAgentId,
    inboxAgentId,
    isAgentListInit,
    sidebarItem?.type === 'agent',
  );

  return {
    agentId,
    isInbox: !!agentId && agentId === inboxAgentId,
  };
};
