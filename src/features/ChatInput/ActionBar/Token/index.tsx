import { type PropsWithChildren } from 'react';
import { memo } from 'react';

import { useModelContextWindowTokens } from '@/hooks/useModelContextWindowTokens';
import dynamic from '@/libs/next/dynamic';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';

import { useAgentId } from '../../hooks/useAgentId';

const LargeTokenContent = dynamic(() => import('./TokenTag'), { ssr: false });

const Token = memo<PropsWithChildren>(({ children }) => {
  const agentId = useAgentId();
  const [model, provider] = useAgentStore((state) => [
    agentByIdSelectors.getAgentModelById(agentId)(state),
    agentByIdSelectors.getAgentModelProviderById(agentId)(state),
  ]);
  const maximum = useModelContextWindowTokens(model, provider);
  const showTag = Number.isFinite(maximum) && maximum > 0;

  return showTag && children;
});

const ContextWindow = memo(() => {
  return (
    <Token>
      <LargeTokenContent />
    </Token>
  );
});

ContextWindow.displayName = 'ContextWindow';

export default ContextWindow;
