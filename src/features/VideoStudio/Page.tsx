'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Tabs } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import DragUploadZone from '@/components/DragUploadZone';
import { studioStyles as styles } from '@/features/ImageStudio/styles';
import { MediaStudioHeader } from '@/features/MediaStudio';
import { NavPanelPortal } from '@/features/NavPanel';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useVideoReferenceUpload } from '@/routes/(main)/(create)/video/features/PromptInput/useVideoReferenceUpload';

import { VideoStudioComposer } from './Composer';
import { VideoStudioHistory } from './History';
import { VideoStudioResults } from './Results';
import { useVideoStudio } from './useVideoStudio';

export const VideoStudioPage = ({ mobile: forceMobile = false }: { mobile?: boolean }) => {
  const responsiveMobile = useIsMobile();
  const mobile = forceMobile || responsiveMobile;
  const { t } = useTranslation('image');
  const studio = useVideoStudio();
  const reference = useVideoReferenceUpload();
  const history = <VideoStudioHistory studio={studio} />;
  const action = (
    <Button
      disabled={studio.isCreating}
      icon={<Plus size={18} />}
      size={mobile ? 'middle' : 'small'}
      onClick={studio.openNew}
    >
      {t('studio.new')}
    </Button>
  );
  return (
    <Flexbox className={styles.page} data-testid={'video-studio'}>
      {!mobile && <NavPanelPortal navKey={'video'}>{history}</NavPanelPortal>}
      <MediaStudioHeader action={action} mobile={mobile} mode={'video'} />
      {mobile && (
        <Flexbox className={styles.viewTabs}>
          <Tabs
            activeKey={studio.view}
            styles={{ list: { width: '100%' }, tab: { flex: 1, minHeight: 44 } }}
            items={[
              { key: 'create', label: t('studio.create') },
              {
                key: 'results',
                label: `${t('studio.results')}${studio.counts.total ? ` · ${studio.counts.total}` : ''}`,
              },
              { key: 'history', label: t('studio.history') },
            ]}
            onChange={(view) => {
              if (view === 'create' || view === 'results' || view === 'history')
                studio.setView(view);
            }}
          />
        </Flexbox>
      )}
      <DragUploadZone
        disabled={!reference.canDropImage || studio.isCreating}
        enabledFiles={false}
        style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}
        onUploadFiles={async (files) => {
          studio.setView('create');
          await reference.handleUploadFiles(files);
        }}
      >
        <div className={cx(styles.body, mobile && styles.mobileBody)}>
          <Flexbox
            style={{
              display: mobile && studio.view !== 'create' ? 'none' : 'flex',
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <VideoStudioComposer mobile={mobile} studio={studio} />
          </Flexbox>
          <Flexbox
            style={{
              display: mobile && studio.view !== 'results' ? 'none' : 'flex',
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <VideoStudioResults studio={studio} />
          </Flexbox>
          {mobile && (
            <Flexbox
              style={{
                display: studio.view === 'history' ? 'flex' : 'none',
                minHeight: 0,
                minWidth: 0,
              }}
            >
              {history}
            </Flexbox>
          )}
        </div>
      </DragUploadZone>
    </Flexbox>
  );
};
