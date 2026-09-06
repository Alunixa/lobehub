'use client';

import { ModelIcon } from '@lobehub/icons';
import { Button, Flexbox, Icon, Text, TextArea } from '@lobehub/ui';
import { ChevronDown, ImagePlus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import PromptTransformAction from '@/features/PromptTransform/PromptTransformAction';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { GenerationVisibilitySelector } from '@/routes/(main)/(create)/features/GenerationInput';
import UploadCard from '@/routes/(main)/(create)/features/GenerationInput/UploadCard';
import ImageModelItem from '@/routes/(main)/(create)/image/features/ConfigPanel/components/ModelSelect/ImageModelItem';
import { useImageReferenceUpload } from '@/routes/(main)/(create)/image/features/PromptInput/useImageReferenceUpload';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useImageStore } from '@/store/image';
import { useGenerationConfigParam } from '@/store/image/slices/generationConfig/hooks';

import { StudioField, StudioSettings } from './Settings';
import { studioStyles as styles } from './styles';

interface StudioComposerProps {
  canCreate: boolean;
  isCreating: boolean;
  isInit: boolean;
  mobile: boolean;
  onGenerate: () => Promise<void>;
}

export const StudioComposer = ({
  canCreate,
  isCreating,
  isInit,
  mobile,
  onGenerate,
}: StudioComposerProps) => {
  const { t } = useTranslation('image');
  const navigate = useWorkspaceAwareNavigate();
  const { value: prompt, setValue: setPrompt } = useGenerationConfigParam('prompt');
  const { model, provider, imageNum, activeGenerationTopicId: topicId } = useImageStore((s) => ({
    activeGenerationTopicId: s.activeGenerationTopicId,
    imageNum: s.imageNum,
    model: s.model,
    provider: s.provider,
  }));
  const enabledModels = useAiInfraStore(aiProviderSelectors.enabledImageModelList);
  const setModel = useImageStore((s) => s.setModelAndProviderOnSelect);
  const visibility = useImageStore((s) =>
    topicId
      ? s.generationTopics.find((topic) => topic.id === topicId)?.visibility
      : s.newGenerationTopicVisibility,
  );
  const setVisibility = useImageStore((s) => s.setNewGenerationTopicVisibility);
  const reference = useImageReferenceUpload();
  const disabled = !canCreate || isCreating || !isInit;
  const uploading = reference.uploadingPreviews.length > 0;
  const modelAvailable = enabledModels.some(
    (group) => group.id === provider && group.children.some((item) => item.id === model),
  );

  return (
    <Flexbox className={styles.composer} data-mobile={mobile} data-testid={'studio-composer'}>
      <Flexbox className={styles.scroll}>
        <Flexbox className={styles.form} gap={20}>
          <Flexbox gap={4}>
            <Text as={'h2'} fontSize={20} style={{ margin: 0 }} weight={600}>
              {t('studio.createTitle')}
            </Text>
            <Text fontSize={13} type={'secondary'}>
              {t('studio.createDescription')}
            </Text>
          </Flexbox>
          <fieldset className={styles.fieldset} disabled={disabled}>
            <StudioField label={t('config.model.label')}>
              <ModelSwitchPanel
                ModelItemComponent={ImageModelItem}
                enabledList={enabledModels}
                model={model}
                openOnHover={false}
                placement={'bottomLeft'}
                pricingMode={'image'}
                provider={provider}
                onModelChange={({ model, provider }) => setModel(model, provider)}
              >
                <Button
                  aria-label={t('config.model.label')}
                  className={styles.modelButton}
                  disabled={disabled}
                  icon={<ModelIcon model={model || ''} size={20} />}
                >
                  <Text ellipsis style={{ flex: 1, textAlign: 'start' }}>
                    {model || t('studio.chooseModel')}
                  </Text>
                  <Icon icon={ChevronDown} size={16} />
                </Button>
              </ModelSwitchPanel>
            </StudioField>
            <Flexbox gap={8}>
              <Flexbox horizontal align={'center'} justify={'space-between'}>
                <label htmlFor={'image-studio-prompt'}>{t('studio.prompt')}</label>
                <PromptTransformAction mode={'image'} prompt={prompt} onPromptChange={setPrompt} />
              </Flexbox>
              <TextArea
                autoSize={{ maxRows: mobile ? 8 : 10, minRows: 4 }}
                className={styles.textarea}
                disabled={disabled}
                id={'image-studio-prompt'}
                value={prompt ?? ''}
                placeholder={
                  reference.imagePreviewUrls.length
                    ? t('config.prompt.placeholderWithRef')
                    : t('config.prompt.placeholder')
                }
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  // Enter always inserts a newline on touch keyboards.
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
                    void onGenerate();
                  }
                }}
              />
            </Flexbox>
            {reference.canDropImage && (
              <StudioField label={t('config.imageUrls.label')}>
                <Text fontSize={12} type={'secondary'}>
                  {t('studio.referenceHint', { count: reference.maxCount })}
                </Text>
                <div className={styles.references}>
                  {reference.imagePreviewUrls.map((url) => (
                    <UploadCard
                      imageUrl={url}
                      key={url}
                      onRemove={() => reference.handleRemoveImage(url)}
                      onUpload={reference.handleAddImage}
                    />
                  ))}
                  {reference.uploadingPreviews.map((url) => (
                    <UploadCard
                      loading
                      imageUrl={url}
                      key={url}
                      onRemove={() => {}}
                      onUpload={() => {}}
                    />
                  ))}
                  {reference.imagePreviewUrls.length + reference.uploadingPreviews.length <
                    reference.maxCount && (
                    <UploadCard
                      multiple
                      maxFileSize={reference.maxFileSize}
                      onRemove={() => {}}
                      onUpload={reference.handleAddImage}
                      onUploadFiles={reference.handleUploadFiles}
                    />
                  )}
                </div>
              </StudioField>
            )}
            <StudioSettings disabled={disabled} />
            <Flexbox horizontal align={'center'} justify={'space-between'}>
              <Text fontSize={13}>{t('studio.visibility')}</Text>
              <GenerationVisibilitySelector
                disabledReason={topicId ? t('topic.visibility.existingLocked') : undefined}
                visibility={visibility === 'public' ? 'public' : 'private'}
                onChange={setVisibility}
              />
            </Flexbox>
          </fieldset>
          {isInit && !modelAvailable && (
            <Flexbox gap={8}>
              <Text type={'secondary'}>{t('studio.noModel')}</Text>
              <Button onClick={() => navigate('/settings/provider', { escape: true })}>
                {t('studio.configureModel')}
              </Button>
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
      <Flexbox className={styles.footer}>
        <Button
          block
          disabled={disabled || uploading || !modelAvailable || !prompt?.trim()}
          icon={isCreating ? undefined : <Icon icon={Sparkles} />}
          loading={isCreating}
          size={'large'}
          type={'primary'}
          onClick={() => void onGenerate()}
        >
          {isCreating
            ? t('studio.submitting')
            : uploading
              ? t('studio.uploading')
              : t('studio.generate', { count: imageNum })}
        </Button>
        {!mobile && (
          <Text align={'center'} fontSize={12} type={'secondary'}>
            {t('studio.shortcut')}
          </Text>
        )}
        {!canCreate && <Text type={'secondary'}>{t('studio.readOnly')}</Text>}
      </Flexbox>
    </Flexbox>
  );
};
