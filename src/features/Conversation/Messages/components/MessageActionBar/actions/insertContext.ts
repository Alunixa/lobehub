import { BetweenHorizontalStart } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useInsertContext } from '@/features/Conversation/hooks/useInsertContext';

import { defineAction } from '../defineAction';

export const insertContextAction = defineAction({
  key: 'insertContext',
  useBuild: (ctx) => {
    const { t } = useTranslation('chat');
    const { disabled, open } = useInsertContext(ctx.id);
    return useMemo(
      () => ({
        disabled,
        handleClick: () => void open(),
        icon: BetweenHorizontalStart,
        key: 'insertContext',
        label: t('messageContent.insertContext'),
      }),
      [disabled, open, t],
    );
  },
});
