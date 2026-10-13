// @vitest-environment node
import { createECDH, randomBytes } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import webPush from 'web-push';

import { PushTokenModel } from '@/database/models/pushToken';
import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { getWebPushKeys, WebPushService, WebPushSubscriptionSchema } from './WebPushService';

describe('Web Push registration and delivery', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  const db = {} as LobeChatDatabase;
  const service = new WebPushService(db, 'user-fixture');
  const recipient = createECDH('prime256v1');
  recipient.generateKeys();
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fake-fixture',
    keys: {
      auth: randomBytes(16).toString('base64url'),
      p256dh: recipient.getPublicKey().toString('base64url'),
    },
  };
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubEnv('KEY_VAULTS_SECRET', 'fixture-only-not-production');
    const key = await crypto.subtle.importKey('raw', new Uint8Array(32).fill(7), 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
    vi.spyOn(KeyVaultsGateKeeper, 'initWithEnvKey').mockResolvedValue(new KeyVaultsGateKeeper(key));
  });
  it('derives a stable, purpose-specific valid public key', () => {
    const first = getWebPushKeys('fixture-secret');
    expect(first.publicKey).toBe(getWebPushKeys('fixture-secret').publicKey);
    expect(first.publicKey).not.toBe(getWebPushKeys('other-fixture-secret').publicKey);
    expect(Buffer.from(first.publicKey, 'base64url')).toHaveLength(65);
    expect(Buffer.from(first.privateKey, 'base64url')).toHaveLength(32);
  });
  it.each([
    'https://127.0.0.1/push',
    'https://evil.invalid/push',
    'http://fcm.googleapis.com/push',
    'https://fcm.googleapis.com:3210/push',
  ])('rejects non-provider or unsafe endpoints: %s', (endpoint) => {
    expect(WebPushSubscriptionSchema.safeParse({ ...subscription, endpoint }).success).toBe(false);
  });
  it('stores only an encrypted web registration and keeps mobile device ids separate', async () => {
    const upsert = vi.spyOn(PushTokenModel.prototype, 'upsert').mockResolvedValue({} as never);
    const result = await service.register('device-fixture', subscription);
    expect(result.registrationToken).toMatch(/^webpush:v1:/);
    expect(result.registrationToken).not.toContain(subscription.endpoint);
    expect(result.registrationToken).not.toContain(subscription.keys.auth);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'web:device-fixture', platform: 'web' }),
    );
  });
  it('delivers through the SDK with no plaintext registration logs and removes expired tokens', async () => {
    const upsert = vi.spyOn(PushTokenModel.prototype, 'upsert').mockResolvedValue({} as never);
    await service.register('device-fixture', subscription);
    const record = { ...upsert.mock.calls[0][0], userId: 'user-fixture' };
    vi.spyOn(PushTokenModel.prototype, 'listByUserId').mockResolvedValue([record] as never);
    const unregister = vi
      .spyOn(PushTokenModel.prototype, 'unregister')
      .mockResolvedValue(undefined as never);
    const send = vi.spyOn(webPush, 'sendNotification').mockRejectedValue({ statusCode: 410 });
    await service.send({ id: 'n1', body: 'private answer', title: 'AI', url: '/agent/a/t' });
    expect(send).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledWith('web:device-fixture');
  });
});
