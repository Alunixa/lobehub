import { describe, expect, it } from 'vitest';

import { resolveConversationImageModel } from './conversationImageModel';

describe('resolveConversationImageModel', () => {
  it('keeps missing, incomplete, and explicitly disabled settings off', () => {
    expect(resolveConversationImageModel()).toBeUndefined();
    expect(
      resolveConversationImageModel({ enabled: true, model: '', provider: 'provider' }),
    ).toBeUndefined();
    expect(
      resolveConversationImageModel({ enabled: true, model: 'image', provider: ' ' }),
    ).toBeUndefined();
    expect(
      resolveConversationImageModel({ enabled: false, model: 'image', provider: 'provider' }),
    ).toBeUndefined();
  });

  it('returns only a complete explicitly enabled image-model selection', () => {
    expect(
      resolveConversationImageModel({ enabled: true, model: ' image-v1 ', provider: ' provider ' }),
    ).toEqual({ model: 'image-v1', provider: 'provider' });
  });
});
