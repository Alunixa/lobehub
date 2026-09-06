'use client';

import { ActionIcon, Button, Center, Flexbox, Icon, Text } from '@lobehub/ui';
import { ChevronRight, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

import BrandWatermark from '@/components/BrandWatermark';
import type { CellProps } from '@/components/Cell';
import { useIsDark } from '@/hooks/useIsDark';
import { useCategory } from '@/routes/(mobile)/me/(home)/features/useCategory';
import UserBanner from '@/routes/(mobile)/me/(home)/features/UserBanner';

import { MobilePageHeader } from './Header';
import { mobileStyles as styles } from './styles';

export const MobileMePage = () => {
  const { t } = useTranslation('common');
  const isDark = useIsDark();
  const { setTheme } = useTheme();
  const items = useCategory();
  const groups: CellProps[][] = [[]];
  for (const item of items) {
    if (item.type === 'divider') {
      if (groups.at(-1)?.length) groups.push([]);
    } else {
      groups.at(-1)!.push(item);
    }
  }

  return (
    <Flexbox className={styles.page}>
      <MobilePageHeader
        title={t('tab.me')}
        actions={
          <ActionIcon
            aria-label={t(isDark ? 'mobile.lightTheme' : 'mobile.darkTheme')}
            icon={isDark ? Sun : Moon}
            size={{ blockSize: 44, size: 22 }}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          />
        }
      />
      <Flexbox className={styles.scroll}>
        <Flexbox className={styles.content} gap={20}>
          <Flexbox className={styles.section} padding={12}>
            <UserBanner />
          </Flexbox>
          {groups
            .filter((group) => group.length)
            .map((group, index) => (
              <Flexbox className={styles.section} key={index}>
                {group.map((item, itemIndex) => (
                  <Button
                    className={styles.row}
                    key={item.key ?? itemIndex}
                    type={'text'}
                    onClick={item.onClick}
                  >
                    {item.icon && (
                      <div className={styles.rowIcon}>
                        <Icon icon={item.icon} size={20} />
                      </div>
                    )}
                    <Text style={{ flex: 1, whiteSpace: 'normal' }}>{item.label}</Text>
                    <Icon icon={ChevronRight} size={16} />
                  </Button>
                ))}
              </Flexbox>
            ))}
          <Center padding={12}>
            <BrandWatermark />
          </Center>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};
