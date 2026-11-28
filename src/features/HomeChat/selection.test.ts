import { describe, expect, it } from 'vitest';

import type { EnabledProviderWithModels } from '@/types/aiProvider';

import { resolveHomeAgentId, resolveHomeModel } from './selection';

const providers = [
  { id: 'custom-gemini', children: [{ id: 'gemini-3.1-flash' }] },
] as EnabledProviderWithModels[];
const current = { model: 'gemini-3.0-flash', provider: 'custom-gemini' };
const available = { model: 'gemini-3.1-flash', provider: 'custom-gemini' };

describe('home chat selection', () => {
  it('waits for hydration and preserves enabled custom-provider models', () => {
    expect(resolveHomeModel(false, providers, current, available)).toBeUndefined();
    expect(resolveHomeModel(true, providers, available, current)).toEqual(available);
  });
  it('replaces a retired model with the available user default or first enabled model', () => {
    expect(resolveHomeModel(true, providers, current, available)).toEqual(available);
    expect(resolveHomeModel(true, providers, current, current)).toEqual(available);
    expect(resolveHomeModel(true, [], current, available)).toBeUndefined();
  });
  it('uses the saved agent and falls back safely only after a deletion is confirmed', () => {
    expect(resolveHomeAgentId('custom', 'inbox', true, true)).toBe('custom');
    expect(resolveHomeAgentId('custom', 'inbox', false, false)).toBe('custom');
    expect(resolveHomeAgentId('deleted', 'inbox', true, false)).toBe('inbox');
    expect(resolveHomeAgentId('', 'inbox', true, false)).toBe('inbox');
    expect(resolveHomeAgentId('inbox', 'inbox', true, false)).toBe('inbox');
  });
});
