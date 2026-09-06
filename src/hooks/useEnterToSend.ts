import { isCommandPressed } from '@lobechat/utils';
import { useCallback } from 'react';

import { useUserStore } from '@/store/user';
import { preferenceSelectors } from '@/store/user/selectors';

type EnterEvent = Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>;

/**
 * Returns a predicate that decides whether a chat-input key event should
 * fire send, based on the global `useCmdEnterToSend` preference.
 */
export const useEnterToSend = (mobile = false) => {
  const useCmdEnterToSend = useUserStore(preferenceSelectors.useCmdEnterToSend);

  return useCallback(
    (event: EnterEvent): boolean => {
      if (event.shiftKey) return false;
      const commandKey = isCommandPressed(event);
      // Touch keyboards use Enter for a newline; an external keyboard may still
      // explicitly send with Cmd/Ctrl+Enter.
      if (mobile) return commandKey;
      return useCmdEnterToSend ? commandKey : !commandKey;
    },
    [mobile, useCmdEnterToSend],
  );
};
