import { useLayoutEffect } from 'react';

import { useAgentStore } from '@/store/agent';

import { useResolvedHomeAgentId } from '../features/AgentSelect/useResolvedHomeAgentId';

const HomeAgentIdSync = () => {
  const { agentId } = useResolvedHomeAgentId();

  // Sync the selected home agent before paint. Layout effect (not
  // passive) so it stays ordered with AgentIdSync's layout-effect clear/backfill:
  // in a single route-switch commit, removed-tree layout cleanups always run
  // before new-tree layout effects.
  useLayoutEffect(() => {
    if (!agentId) return;

    if (useAgentStore.getState().activeAgentId !== agentId)
      useAgentStore.setState({ activeAgentId: agentId }, false, 'HomeAgentIdSync/syncAgentId');
  }, [agentId]);

  // Clear activeAgentId when unmounting (leaving home page) — layout cleanup
  // for the same ordering reason as above.
  useLayoutEffect(
    () => () => {
      useAgentStore.setState({ activeAgentId: undefined }, false, 'HomeAgentIdSync/unmountAgentId');
    },
    [],
  );

  return null;
};

export default HomeAgentIdSync;
