import { lambdaClient } from '@/libs/trpc/client';

const PUSH_DEVICE_KEY = 'lobehub:conversation-push-device:v1';
const PUSH_TOKEN_KEY = 'lobehub:conversation-push-registration:v1';
const PUSH_OWNER_KEY = 'lobehub:conversation-push-owner:v1';

class ConversationFeatureService {
  getCapabilities = (providerId?: string) =>
    lambdaClient.notification.conversationCapabilities.query({ providerId });
  noteActivity = (id: string) => lambdaClient.topic.noteConversationActivity.mutate({ id });

  async clearPreviousPushOwner(userId: string | undefined, signedIn: boolean | undefined) {
    const owner = localStorage.getItem(PUSH_OWNER_KEY);
    if (!owner || (signedIn !== false && (!userId || owner === userId))) return;
    const registrationToken = localStorage.getItem(PUSH_TOKEN_KEY);
    const deviceId = localStorage.getItem(PUSH_DEVICE_KEY);
    const worker = await navigator.serviceWorker?.getRegistration('/proactive-notifications/');
    await (await worker?.pushManager.getSubscription())?.unsubscribe();
    if (registrationToken && deviceId) {
      await lambdaClient.notification.unregisterWebPush.mutate({ deviceId, registrationToken });
    }
    localStorage.removeItem(PUSH_TOKEN_KEY);
    localStorage.removeItem(PUSH_OWNER_KEY);
  }

  async enableBrowserPush() {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    )
      throw new Error('Browser Push is unavailable');
    if ((await Notification.requestPermission()) !== 'granted')
      throw new Error('Browser notification permission was not granted');
    const { webPushPublicKey } = await this.getCapabilities();
    if (!webPushPublicKey) throw new Error('Web Push is not configured');
    const registration = await navigator.serviceWorker.register('/proactive-push-sw.js', {
      scope: '/proactive-notifications/',
    });
    if (!registration.active) {
      await new Promise<void>((resolve, reject) => {
        const worker = registration.installing || registration.waiting;
        if (!worker) return reject(new Error('Push worker is not available'));
        const timeout = setTimeout(() => {
          worker.removeEventListener('statechange', changed);
          reject(new Error('Push worker activation timed out'));
        }, 10000);
        const changed = () => {
          if (worker.state !== 'activated') return;
          clearTimeout(timeout);
          worker.removeEventListener('statechange', changed);
          resolve();
        };
        worker.addEventListener('statechange', changed);
        changed();
      });
    }
    const publicKey = Uint8Array.from(
      atob(webPushPublicKey.replaceAll('-', '+').replaceAll('_', '/')),
      (character) => character.charCodeAt(0),
    );
    let subscription = await registration.pushManager.getSubscription();
    const oldKey = subscription?.options?.applicationServerKey;
    if (oldKey) {
      const oldBytes = new Uint8Array(oldKey);
      if (
        oldBytes.length !== publicKey.length ||
        oldBytes.some((value, index) => value !== publicKey[index])
      ) {
        await subscription!.unsubscribe();
        subscription = null;
      }
    }
    subscription ??= await registration.pushManager.subscribe({
      applicationServerKey: publicKey,
      userVisibleOnly: true,
    });
    const previous = localStorage.getItem(PUSH_TOKEN_KEY);
    const deviceId = localStorage.getItem(PUSH_DEVICE_KEY) || crypto.randomUUID();
    localStorage.setItem(PUSH_DEVICE_KEY, deviceId);
    if (previous) {
      await lambdaClient.notification.unregisterWebPush.mutate({
        deviceId,
        registrationToken: previous,
      });
    }
    const result = await lambdaClient.notification.registerWebPush.mutate({
      deviceId,
      subscription: subscription.toJSON() as {
        endpoint: string;
        keys: { auth: string; p256dh: string };
      },
    });
    localStorage.setItem(PUSH_TOKEN_KEY, result.registrationToken);
    localStorage.setItem(PUSH_OWNER_KEY, result.userId);
  }
}

export const conversationFeatureService = new ConversationFeatureService();
