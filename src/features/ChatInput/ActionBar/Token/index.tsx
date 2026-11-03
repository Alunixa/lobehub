import { type PropsWithChildren } from 'react';
import { memo } from 'react';

import { useModelContextWindowTokens } from '@/hooks/useModelContextWindowTokens';
import dynamic from '@/libs/next/dynamic';

import { useAgentId } from '../../hooks/useAgentId';
import { useEffectiveModel } from '../../hooks/useEffectiveModel';

const LargeTokenContent = dynamic(() => import('./TokenTag'), { ssr: false });

const Token = memo<PropsWithChildren>(({ children }) => {
  const agentId = useAgentId();
  const { model, provider } = useEffectiveModel(agentId);
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
