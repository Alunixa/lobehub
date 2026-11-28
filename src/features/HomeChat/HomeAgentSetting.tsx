import type { FormGroupItemType } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import { Avatar, Button, Select, toast } from '@lobehub/ui/base-ui';
import { useTranslation } from 'react-i18next';

import { DEFAULT_AVATAR } from '@/const/meta';
import { useFetchAgentList } from '@/hooks/useFetchAgentList';
import { useHomeStore } from '@/store/home';
import { homeAgentListSelectors } from '@/store/home/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

export const useHomeAgentSetting = (): FormGroupItemType => {
  const { t } = useTranslation('setting');
  const { error, mutate } = useFetchAgentList();
  const agents = useHomeStore(homeAgentListSelectors.allAgents);
  const initialized = useHomeStore(homeAgentListSelectors.isAgentListInit);
  const selected = useUserStore(
    (s) => settingsSelectors.currentSettings(s).general.homeDefaultAgentId,
  );
  const setSettings = useUserStore((s) => s.setSettings);
  const available = [
    ...new Map(agents.filter((a) => a.type === 'agent').map((a) => [a.id, a])).values(),
  ];
  const value = available.some((a) => a.id === selected) ? selected : '';
  return {
    title: t('tab.advanced.homeAgent.title'),
    children: [
      {
        label: t('tab.advanced.homeAgent.title'),
        desc: t('tab.advanced.homeAgent.desc'),
        children: error ? (
          <Button onClick={() => void mutate()}>{t('tab.advanced.homeAgent.retry')}</Button>
        ) : (
          <Select
            disabled={!initialized}
            value={value}
            options={[
              { label: t('tab.advanced.homeAgent.default'), value: '' },
              ...available.map((a) => ({
                value: a.id,
                label: (
                  <Flexbox horizontal align="center" gap={8}>
                    <Avatar
                      avatar={typeof a.avatar === 'string' ? a.avatar : DEFAULT_AVATAR}
                      size={24}
                    />
                    {a.title || t('tab.advanced.homeAgent.untitled')}
                  </Flexbox>
                ),
              })),
            ]}
            onChange={(id: string) => {
              void setSettings({ general: { homeDefaultAgentId: id } }).catch((error) => {
                console.error('[home-agent] Failed to save selection', error);
                toast.error(t('tab.advanced.homeAgent.saveError'));
              });
            }}
          />
        ),
      },
    ],
  };
};
