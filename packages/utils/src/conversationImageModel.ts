import type { SystemAgentItem } from '@lobechat/types';

/** Missing / legacy settings must never opt a user into a paid image request. */
export const resolveConversationImageModel = (
  config?: Partial<SystemAgentItem> | null,
): Pick<SystemAgentItem, 'model' | 'provider'> | undefined => {
  if (config?.enabled !== true) return;
  const model = config.model?.trim();
  const provider = config.provider?.trim();
  if (!model || !provider) return;
  return { model, provider };
};
