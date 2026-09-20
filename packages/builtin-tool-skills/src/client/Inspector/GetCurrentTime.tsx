'use client';

import type { BuiltinInspectorProps } from '@lobechat/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { inspectorTextStyles } from '@/styles';

export const GetCurrentTimeInspector = memo<BuiltinInspectorProps>(() => {
  const { t } = useTranslation('plugin');
  return (
    <span className={inspectorTextStyles.root}>
      {t('builtins.lobe-skills.apiName.getCurrentTime')}
    </span>
  );
});
