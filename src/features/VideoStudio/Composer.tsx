'use client';

import { ModelIcon } from '@lobehub/icons';
import { Flexbox, Icon, TextArea } from '@lobehub/ui';
import { Button, Text } from '@lobehub/ui/base-ui';
import { ChevronDown, Film } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StudioField } from '@/features/ImageStudio/Settings';
import { studioStyles as styles } from '@/features/ImageStudio/styles';
import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import PromptTransformAction from '@/features/PromptTransform/PromptTransformAction';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { GenerationVisibilitySelector } from '@/routes/(main)/(create)/features/GenerationInput';
import UploadCard from '@/routes/(main)/(create)/features/GenerationInput/UploadCard';
import FrameUpload from '@/routes/(main)/(create)/video/features/ConfigPanel/components/FrameUpload';
import VideoModelItem from '@/routes/(main)/(create)/video/features/ConfigPanel/components/ModelSelect/VideoModelItem';
import { useVideoReferenceUpload } from '@/routes/(main)/(create)/video/features/PromptInput/useVideoReferenceUpload';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useVideoStore } from '@/store/video';
import {
  useVideoGenerationConfigParam,
  useVideoUploadingPreview,
} from '@/store/video/slices/generationConfig/hooks';

import { VideoStudioSettings } from './Settings';
import type { useVideoStudio } from './useVideoStudio';

export const VideoStudioComposer = ({
  mobile,
  studio,
}: {
  mobile: boolean;
  studio: ReturnType<typeof useVideoStudio>;
}) => {
  const { t } = useTranslation(['video', 'image', 'common']);
  const navigate = useWorkspaceAwareNavigate();
  const { value: prompt, setValue: setPrompt } = useVideoGenerationConfigParam('prompt');
  const {
    value: imageUrls,
    setValue: setImageUrls,
    maxCount,
    maxFileSize,
  } = useVideoGenerationConfigParam('imageUrls');
  const trackUpload = useVideoUploadingPreview();
  const model = useVideoStore((s) => s.model);
  const provider = useVideoStore((s) => s.provider);
  const schema = useVideoStore((s) => s.parametersSchema);
  const setModel = useVideoStore((s) => s.setModelAndProviderOnSelect);
  const models = useAiInfraStore(aiProviderSelectors.enabledVideoModelList);
  const visibility = useVideoStore((s) =>
    studio.activeTopicId
      ? s.generationTopics.find((topic) => topic.id === studio.activeTopicId)?.visibility
      : s.newGenerationTopicVisibility,
  );
  const setVisibility = useVideoStore((s) => s.setNewGenerationTopicVisibility);
  const reference = useVideoReferenceUpload();
  const disabled = !studio.canCreate || studio.isCreating || !studio.isInit;
  const modelAvailable = models.some(
    (group) => group.id === provider && group.children.some((item) => item.id === model),
  );
  const uploading = reference.uploadingPreviews.length > 0;
  return (
    <Flexbox className={styles.composer} data-mobile={mobile} data-testid={'video-studio-composer'}>
      <Flexbox className={styles.scroll}>
        <Flexbox className={styles.form} gap={24}>
          <Flexbox gap={8}>
            <Text as={'h2'} fontSize={20} style={{ margin: 0 }} weight={600}>
              {t('mediaStudio.videoCreateTitle', { ns: 'common' })}
            </Text>
            <Text fontSize={14} type={'secondary'}>
              {t('mediaStudio.videoCreateDescription', { ns: 'common' })}
            </Text>
          </Flexbox>
          <fieldset className={styles.fieldset} disabled={disabled}>
            <StudioField label={t('config.model.label', { ns: 'image' })}>
              <ModelSwitchPanel
                ModelItemComponent={VideoModelItem}
                enabledList={models}
                model={model}
                openOnHover={false}
                placement={'bottomLeft'}
                pricingMode={'video'}
                provider={provider}
                onModelChange={async (next) => setModel(next.model, next.provider)}
              >
                <Button
                  aria-label={t('mediaStudio.videoModel', { ns: 'common' })}
                  className={styles.modelButton}
                  disabled={disabled || uploading}
                  icon={<ModelIcon model={model || ''} size={20} />}
                >
                  <Text ellipsis style={{ flex: 1, textAlign: 'start' }}>
                    {model || t('mediaStudio.videoModel', { ns: 'common' })}
                  </Text>
                  <Icon icon={ChevronDown} size={16} />
                </Button>
              </ModelSwitchPanel>
            </StudioField>
            <Flexbox gap={8}>
              <Flexbox horizontal align={'center'} justify={'space-between'}>
                <label htmlFor={'video-studio-prompt'}>{t('studio.prompt', { ns: 'image' })}</label>
                <PromptTransformAction mode={'video'} prompt={prompt} onPromptChange={setPrompt} />
              </Flexbox>
              <TextArea
                autoSize={{ maxRows: mobile ? 8 : 10, minRows: 5 }}
                className={styles.textarea}
                disabled={disabled}
                id={'video-studio-prompt'}
                placeholder={t('config.prompt.placeholder')}
                value={prompt ?? ''}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    (event.ctrlKey || event.metaKey) &&
                    !event.nativeEvent.isComposing &&
                    !disabled &&
                    !uploading &&
                    modelAvailable &&
                    prompt?.trim()
                  ) {
                    event.preventDefault();
                    void studio.generate();
                  }
                }}
              />
            </Flexbox>
            {('imageUrl' in schema || 'endImageUrl' in schema) && (
              <div className={styles.parameterGrid}>
                {'imageUrl' in schema && (
                  <StudioField label={t('config.imageUrl.label')}>
                    <FrameUpload paramName={'imageUrl'} />
                  </StudioField>
                )}
                {'endImageUrl' in schema && (
                  <StudioField label={t('config.endImageUrl.label')}>
                    <FrameUpload paramName={'endImageUrl'} />
                  </StudioField>
                )}
              </div>
            )}
            {'imageUrls' in schema && (
              <StudioField label={t('config.referenceImage.label')}>
                <div className={styles.references}>
                  {(imageUrls ?? []).map((url) => (
                    <UploadCard
                      imageUrl={url}
                      key={url}
                      maxFileSize={maxFileSize}
                      onUploadingChange={trackUpload}
                      onRemove={() =>
                        setImageUrls(
                          (useVideoStore.getState().parameters.imageUrls ?? []).filter(
                            (item) => item !== url,
                          ),
                        )
                      }
                      onUpload={(data) => {
                        const next = typeof data === 'string' ? data : data.url;
                        setImageUrls(
                          (useVideoStore.getState().parameters.imageUrls ?? []).map((item) =>
                            item === url ? next : item,
                          ),
                        );
                      }}
                    />
                  ))}
                  {(imageUrls?.length ?? 0) < (maxCount ?? 4) && (
                    <UploadCard
                      loading={uploading}
                      maxFileSize={maxFileSize}
                      onRemove={() => {}}
                      onUploadingChange={trackUpload}
                      onUpload={(data) => {
                        const next = typeof data === 'string' ? data : data.url;
                        const current = useVideoStore.getState().parameters.imageUrls ?? [];
                        if (current.length < (maxCount ?? 4)) setImageUrls([...current, next]);
                      }}
                    />
                  )}
                </div>
              </StudioField>
            )}
            <VideoStudioSettings />
            <Flexbox horizontal align={'center'} justify={'space-between'}>
              <Text fontSize={14}>{t('studio.visibility', { ns: 'image' })}</Text>
              <GenerationVisibilitySelector
                visibility={visibility === 'public' ? 'public' : 'private'}
                disabledReason={
                  studio.activeTopicId ? t('topic.visibility.existingLocked') : undefined
                }
                onChange={setVisibility}
              />
            </Flexbox>
          </fieldset>
          {studio.isInit && !modelAvailable && (
            <Flexbox gap={10}>
              <Text type={'secondary'}>{t('mediaStudio.noVideoModel', { ns: 'common' })}</Text>
              <Button onClick={() => navigate('/settings/provider/all', { escape: true })}>
                {t('studio.configureModel', { ns: 'image' })}
              </Button>
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
      <Flexbox className={styles.footer}>
        <Button
          block
          disabled={disabled || uploading || !modelAvailable || !prompt?.trim()}
          icon={studio.isCreating ? undefined : <Icon icon={Film} />}
          loading={studio.isCreating}
          size={'large'}
          type={'primary'}
          onClick={() => void studio.generate()}
        >
          {studio.isCreating
            ? t('studio.submitting', { ns: 'image' })
            : uploading
              ? t('studio.uploading', { ns: 'image' })
              : t('mediaStudio.generateVideo', { ns: 'common' })}
        </Button>
        {!mobile && (
          <Text align={'center'} fontSize={12} type={'secondary'}>
            {t('studio.shortcut', { ns: 'image' })}
          </Text>
        )}
      </Flexbox>
    </Flexbox>
  );
};
