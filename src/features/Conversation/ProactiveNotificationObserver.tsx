import { toast } from '@lobehub/ui/base-ui';
import { memo, useEffect } from 'react';

import { conversationFeatureService } from '@/services/conversationFeatures';
import { useUserStore } from '@/store/user';

const ProactiveNotificationObserver = memo(() => {
  const userId = useUserStore((state) => state.user?.id);
  const signedIn = useUserStore((state) => state.isSignedIn);
  useEffect(() => {
    void conversationFeatureService.clearPreviousPushOwner(userId, signedIn).catch((error) => {
      console.error(
        '[ProactiveNotification] Old registration was not cleared:',
        (error as Error).name,
      );
    });
  }, [signedIn, userId]);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const seen = new Set<string>();
    const receive = (event: MessageEvent) => {
      const { type, payload } = event.data ?? {};
      if (type !== 'proactive-notification' || payload?.userId !== userId || seen.has(payload?.id))
        return;
      seen.add(payload.id);
      if (seen.size > 256) seen.delete(seen.values().next().value!);
      toast.info({ title: payload.title, description: payload.body });
    };
    navigator.serviceWorker.addEventListener('message', receive);
    return () => navigator.serviceWorker.removeEventListener('message', receive);
  }, [userId]);
  return null;
});
export default ProactiveNotificationObserver;
