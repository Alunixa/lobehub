'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Button, Tabs, Text } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { Film, ImagePlus, Images } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import NavHeader from '@/features/NavHeader';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

import { mediaStudioStyles as styles } from './styles';

export type StudioMediaMode = 'image' | 'video';

export const MediaModeTabs = ({ mode }: { mode: StudioMediaMode }) => {
  const { t } = useTranslation('common');
  const navigate = useWorkspaceAwareNavigate();
  return (
    <Tabs
      activeKey={mode}
      className={styles.modeTabs}
      items={[
        {
          key: 'image',
          label: (
            <Flexbox horizontal align={'center'} gap={8}>
              <Icon icon={Images} size={17} />
              {t('tab.image')}
            </Flexbox>
          ),
        },
        {
          key: 'video',
          label: (
            <Flexbox horizontal align={'center'} gap={8}>
              <Icon icon={Film} size={17} />
              {t('tab.video')}
            </Flexbox>
          ),
        },
      ]}
      onChange={(next) => {
        if ((next === 'image' || next === 'video') && next !== mode) navigate(`/${next}`);
      }}
    />
  );
};

export const MediaStudioHeader = ({
  action,
  mobile,
  mode,
}: {
  action: ReactNode;
  mobile: boolean;
  mode: StudioMediaMode;
}) => {
  const { t } = useTranslation('common');
  const identity = (
    <Flexbox horizontal align={'center'} className={styles.identity} gap={12}>
      <div className={cx(styles.studioMark, mode === 'video' && styles.videoMark)}>
        <Icon icon={mode === 'video' ? Film : ImagePlus} size={23} />
      </div>
      <Flexbox gap={4} style={{ minWidth: 0 }}>
        <Text as={'h1'} className={styles.title} style={{ margin: 0 }} weight={600}>
          {t('mediaStudio.title')}
        </Text>
        <Text className={styles.subtitle} fontSize={12} type={'secondary'}>
          {t(mode === 'video' ? 'mediaStudio.videoDescription' : 'mediaStudio.imageDescription')}
        </Text>
      </Flexbox>
    </Flexbox>
  );
  if (mobile) {
    return (
      <Flexbox className={styles.mobileHeader}>
        <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
          {identity}
          {action}
        </Flexbox>
        <MediaModeTabs mode={mode} />
      </Flexbox>
    );
  }
  return (
    <NavHeader
      className={styles.header}
      left={identity}
      right={
        <Flexbox horizontal align={'center'} gap={16}>
          <MediaModeTabs mode={mode} />
          {action}
        </Flexbox>
      }
    />
  );
};

export const MediaStudioEmpty = ({
  mode,
  onCreate,
}: {
  mode: StudioMediaMode;
  onCreate: () => void;
}) => {
  const { t } = useTranslation('common');
  return (
    <Flexbox align={'center'} className={styles.empty} gap={20}>
      <div aria-hidden className={cx(styles.contactSheet, mode === 'video' && styles.filmSheet)}>
        <div className={styles.contactFrame}>
          <span className={styles.frameHorizon} />
        </div>
        <div className={styles.contactFrame}>
          <Icon icon={mode === 'video' ? Film : Images} size={30} />
        </div>
        <div className={styles.contactFrame}>
          <span className={styles.framePortrait} />
        </div>
        <div className={styles.sheetCaption}>
          {mode === 'video' ? 'MOTION / FRAME' : 'IMAGE / FRAME'}
        </div>
      </div>
      <Flexbox align={'center'} gap={8}>
        <Text as={'h2'} className={styles.emptyTitle} style={{ margin: 0 }} weight={600}>
          {t(mode === 'video' ? 'mediaStudio.videoEmptyTitle' : 'mediaStudio.imageEmptyTitle')}
        </Text>
        <Text align={'center'} className={styles.emptyDescription} type={'secondary'}>
          {t(
            mode === 'video'
              ? 'mediaStudio.videoEmptyDescription'
              : 'mediaStudio.imageEmptyDescription',
          )}
        </Text>
      </Flexbox>
      <Button
        icon={<Icon icon={mode === 'video' ? Film : ImagePlus} size={16} />}
        onClick={onCreate}
      >
        {t('mediaStudio.startCreating')}
      </Button>
    </Flexbox>
  );
};
