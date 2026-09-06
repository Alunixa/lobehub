'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Button, Tabs } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import DragUploadZone from '@/components/DragUploadZone';
import NavHeader from '@/features/NavHeader';
import { NavPanelPortal } from '@/features/NavPanel';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useImageReferenceUpload } from '@/routes/(main)/(create)/image/features/PromptInput/useImageReferenceUpload';

import { StudioComposer } from './Composer';
import { StudioHistory } from './History';
import { StudioResults } from './Results';
import { studioStyles as styles } from './styles';
import { useImageStudio } from './useImageStudio';

export const ImageStudioPage = ({ mobile: forceMobile = false }: { mobile?: boolean }) => {
  const responsiveMobile = useIsMobile();
  const mobile = forceMobile || responsiveMobile;
  const { t } = useTranslation('image');
  const studio = useImageStudio();
  const reference = useImageReferenceUpload();
  const showCreate = () => studio.setView('create');
  const history = (
    <StudioHistory
      disabled={studio.isCreating}
      query={studio.topicsQuery}
      onNew={studio.openNew}
      onSelect={studio.selectTopic}
    />
  );
  const createButton = (
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
    <Flexbox className={styles.page} data-testid={'image-studio'}>
      {!mobile && <NavPanelPortal navKey={'image'}>{history}</NavPanelPortal>}
      {mobile ? (
        <Flexbox className={styles.mobileHeader}>
          <Flexbox horizontal align={'center'} justify={'space-between'}>
            <Text fontSize={20} weight={600}>
              {t('studio.title')}
            </Text>
            {createButton}
          </Flexbox>
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
      ) : (
        <NavHeader
          className={styles.header}
          right={createButton}
          left={
            <Text fontSize={20} weight={600}>
              {t('studio.title')}
            </Text>
          }
        />
      )}
      <DragUploadZone
        disabled={!reference.canDropImage || studio.isCreating}
        enabledFiles={false}
        style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}
        onUploadFiles={async (files) => {
          showCreate();
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
            <StudioComposer
              canCreate={studio.canCreate}
              isCreating={studio.isCreating}
              isInit={studio.isInit}
              mobile={mobile}
              onGenerate={studio.generate}
            />
          </Flexbox>
          <Flexbox
            style={{
              display: mobile && studio.view !== 'results' ? 'none' : 'flex',
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <StudioResults studio={studio} onCreate={showCreate} />
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
