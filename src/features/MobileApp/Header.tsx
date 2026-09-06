'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { mobileStyles as styles } from './styles';

interface MobilePageHeaderProps {
  actions?: ReactNode;
  onBack?: () => void;
  subtitle?: ReactNode;
  title: ReactNode;
}

export const MobilePageHeader = ({ actions, onBack, subtitle, title }: MobilePageHeaderProps) => {
  const { t } = useTranslation('common');
  return (
    <Flexbox horizontal align={'center'} className={styles.header}>
      {onBack && (
        <ActionIcon
          aria-label={t('back')}
          icon={ArrowLeft}
          size={{ blockSize: 44, size: 22 }}
          onClick={onBack}
        />
      )}
      <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
        <h1 className={styles.headerTitle}>{title}</h1>
        {subtitle && (
          <Text ellipsis fontSize={12} type={'secondary'}>
            {subtitle}
          </Text>
        )}
      </Flexbox>
      {actions && (
        <Flexbox horizontal align={'center'} flex={'none'} gap={4}>
          {actions}
        </Flexbox>
      )}
    </Flexbox>
  );
};
