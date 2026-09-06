import { Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import TopicListContent from '@/routes/(main)/agent/_layout/Sidebar/Topic/TopicListContent';
import TopicSearchBar from '@/routes/(main)/agent/_layout/Sidebar/Topic/TopicSearchBar';
import { useChatStore } from '@/store/chat';
import { useGlobalStore } from '@/store/global';

import TopicModal from './features/TopicModal';

const Topic = () => {
  const { t } = useTranslation('common');
  const openNewTopic = useChatStore((s) => s.openNewTopicOrSaveTopic);
  const toggleTopics = useGlobalStore((s) => s.toggleMobileTopic);
  return (
    <TopicModal>
      <Flexbox gap={8} height={'100%'} padding={'8px 8px 0'} style={{ overflow: 'hidden' }}>
        <Button
          block
          icon={<Plus size={18} />}
          style={{ minHeight: 44, flex: 'none' }}
          onClick={async () => {
            await openNewTopic();
            toggleTopics(false);
          }}
        >
          {t('mobile.newConversation')}
        </Button>
        <TopicSearchBar />
        <Flexbox
          flex={1}
          width={'calc(100% + 16px)'}
          style={{
            minHeight: 0,
            marginInline: -8,
            overflowX: 'hidden',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          <TopicListContent />
        </Flexbox>
      </Flexbox>
    </TopicModal>
  );
};

export default Topic;
