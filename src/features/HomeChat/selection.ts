import type { EnabledProviderWithModels } from '@/types/aiProvider';

export const resolveHomeAgentId = (
  selected: string | undefined,
  fallback: string | undefined,
  initialized: boolean,
  exists: boolean,
) => (selected && (selected === fallback || !initialized || exists) ? selected : fallback);

interface ModelSelection {
  model: string;
  provider: string;
}

export const resolveHomeModel = (
  ready: boolean,
  providers: EnabledProviderWithModels[],
  current: ModelSelection,
  preferred: ModelSelection,
): ModelSelection | undefined => {
  if (!ready) return;
  const enabled = (selection: ModelSelection) =>
    providers.some(
      (p) => p.id === selection.provider && p.children.some((m) => m.id === selection.model),
    );
  if (enabled(current)) return current;
  if (enabled(preferred)) return preferred;
  const provider = providers.find((p) => p.children.length > 0);
  return provider ? { model: provider.children[0].id, provider: provider.id } : undefined;
};
