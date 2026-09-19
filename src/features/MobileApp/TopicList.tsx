import { Flexbox, SearchBar } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Plus } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useFetchChatTopics } from '@/hooks/useFetchChatTopics';
import AllTopicsContent from '@/routes/(main)/agent/_layout/Sidebar/Topic/AllTopicsDrawer/Content';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useGlobalStore } from '@/store/global';

export const MobileTopicList = () => {
  const { t } = useTranslation(['common', 'topic']);
  const [keyword, setKeyword] = useState('');
  const searchKeyword = useDeferredValue(keyword);
  const [openNewTopic, unloaded] = useChatStore((s) => [
    s.openNewTopicOrSaveTopic,
    topicSelectors.isUndefinedTopics(s),
  ]);
  const toggleTopics = useGlobalStore((s) => s.toggleMobileTopic);
  useFetchChatTopics();
  useEffect(
    () => () => {
      useChatStore.setState({ inSearchingMode: false, isSearchingTopic: false, searchTopics: [] });
    },
    [],
  );

  return (
    <Flexbox gap={8} height={'100%'} padding={8} style={{ minHeight: 0, overflow: 'hidden' }}>
      <Button
        block
        icon={<Plus size={18} />}
        style={{ flex: 'none', minHeight: 44 }}
        onClick={async () => {
          await openNewTopic();
          toggleTopics(false);
        }}
      >
        {t('mobile.newConversation')}
      </Button>
      <SearchBar
        autoFocus={false}
        placeholder={t('searchPlaceholder', { ns: 'topic' })}
        spotlight={false}
        value={keyword}
        variant={'filled'}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <Flexbox flex={1} style={{ minHeight: 0, overflow: 'hidden' }}>
        {unloaded && !keyword ? (
          <SkeletonList />
        ) : (
          <AllTopicsContent open searchKeyword={searchKeyword} />
        )}
      </Flexbox>
    </Flexbox>
  );
};
