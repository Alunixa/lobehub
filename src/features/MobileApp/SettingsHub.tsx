'use client';

import { Button, Center, Flexbox, Icon, SearchBar, Text } from '@lobehub/ui';
import { ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCategory } from '@/routes/(mobile)/me/settings/features/useCategory';

import { mobileStyles as styles } from './styles';

export const MobileSettingsHub = () => {
  const { t } = useTranslation('common');
  const [search, setSearch] = useState('');
  const groups = useCategory();
  const keyword = search.trim().toLocaleLowerCase();
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => String(item.label).toLocaleLowerCase().includes(keyword)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Flexbox className={styles.content} data-testid={'mobile-settings-hub'} gap={24}>
      <Flexbox gap={12}>
        <Text fontSize={13} type={'secondary'}>
          {t('mobile.settingsDescription')}
        </Text>
        <SearchBar
          allowClear
          aria-label={t('mobile.searchSettings')}
          placeholder={t('mobile.searchSettings')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Flexbox>
      {filteredGroups.map((group) => (
        <Flexbox gap={10} key={group.key}>
          <h2 className={styles.sectionTitle}>{group.title}</h2>
          <Flexbox className={styles.section}>
            {group.items.map((item) => (
              <Button className={styles.row} key={item.key} type={'text'} onClick={item.onClick}>
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
        </Flexbox>
      ))}
      {!filteredGroups.length && (
        <Center gap={12} padding={32}>
          <Search size={28} />
          <Text type={'secondary'}>{t('mobile.noSettingsFound')}</Text>
          <Button onClick={() => setSearch('')}>{t('mobile.clearSearch')}</Button>
        </Center>
      )}
    </Flexbox>
  );
};
