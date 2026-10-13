import { createECDH, createHash } from 'node:crypto';

import webPush from 'web-push';
import { z } from 'zod';

import { PushTokenModel } from '@/database/models/pushToken';
import type { LobeChatDatabase } from '@/database/type';
import { appEnv } from '@/envs/app';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

const TOKEN_PREFIX = 'webpush:v1:';
const PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'web.push.apple.com',
];

export const WebPushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2000)
    .refine((endpoint) => {
      const url = new URL(endpoint);
      return (
        url.protocol === 'https:' &&
        (!url.port || url.port === '443') &&
        !url.username &&
        !url.password &&
        PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
      );
    }),
  keys: z.object({
    auth: z
      .string()
      .regex(/^[\w-]+={0,2}$/)
      .min(20)
      .max(30)
      .refine((value) => Buffer.from(value, 'base64url').length === 16),
    p256dh: z
      .string()
      .regex(/^[\w-]+={0,2}$/)
      .min(80)
      .max(100)
      .refine((value) => {
        const bytes = Buffer.from(value, 'base64url');
        return bytes.length === 65 && bytes[0] === 4;
      }),
  }),
});

/** A purpose-separated, stable key. No new plaintext secret is written to disk. */
export const getWebPushKeys = (secret = process.env.KEY_VAULTS_SECRET) => {
  if (!secret) throw new Error('Web Push requires KEY_VAULTS_SECRET');
  const privateBytes = createHash('sha256').update(`lobehub:web-push:v1:${secret}`).digest();
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(privateBytes);
  return {
    privateKey: privateBytes.toString('base64url'),
    publicKey: ecdh.getPublicKey().toString('base64url'),
  };
};

export class WebPushService {
  constructor(
    private readonly db: LobeChatDatabase,
    private readonly userId: string,
  ) {}

  async register(deviceId: string, subscription: z.infer<typeof WebPushSubscriptionSchema>) {
    const validated = WebPushSubscriptionSchema.parse(subscription);
    const gate = await KeyVaultsGateKeeper.initWithEnvKey();
    const registrationToken = TOKEN_PREFIX + (await gate.encrypt(JSON.stringify(validated)));
    await new PushTokenModel(this.db, this.userId).upsert({
      deviceId: `web:${deviceId}`,
      expoToken: registrationToken,
      platform: 'web',
    });
    return { registrationToken, userId: this.userId };
  }

  async send(payload: { id: string; body: string; title: string; url: string }) {
    const gate = await KeyVaultsGateKeeper.initWithEnvKey();
    const vapid = getWebPushKeys();
    const tokens = (await new PushTokenModel(this.db, this.userId).listByUserId()).filter(
      (token) => token.platform === 'web' && token.expoToken.startsWith(TOKEN_PREFIX),
    );
    for (const token of tokens) {
      try {
        const result = await gate.decrypt(token.expoToken.slice(TOKEN_PREFIX.length));
        if (!result.wasAuthentic) continue;
        const subscription = WebPushSubscriptionSchema.parse(JSON.parse(result.plaintext));
        await webPush.sendNotification(
          subscription,
          JSON.stringify({ ...payload, userId: this.userId }),
          {
            timeout: 15000,
            TTL: 86400,
            vapidDetails: {
              ...vapid,
              subject: new URL(appEnv.APP_URL).origin,
            },
          },
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await new PushTokenModel(this.db, this.userId).unregister(token.deviceId);
        } else {
          // Never print encrypted subscriptions, endpoint capabilities or VAPID headers.
          console.error('[ProactiveWebPush] Delivery failed:', statusCode ?? 'subscription_error');
        }
      }
    }
  }
}
