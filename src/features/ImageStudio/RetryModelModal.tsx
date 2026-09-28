'use client';

import { ModelIcon } from '@lobehub/icons';
import { Flexbox, Icon } from '@lobehub/ui';
import type { ModalInstance } from '@lobehub/ui/base-ui';
import { Button, createModal, Text, useModalContext } from '@lobehub/ui/base-ui';
import { cssVar } from 'antd-style';
import { t } from 'i18next';
import { ChevronDown } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import ImageModelItem from '@/routes/(main)/(create)/image/features/ConfigPanel/components/ModelSelect/ImageModelItem';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useImageStore } from '@/store/image';

export interface ImageRetryModelSelection {
  model: string;
  provider: string;
}

interface ImageRetryModelContentProps {
  mode: 'adjust' | 'regenerate';
  onConfirm: (selection: ImageRetryModelSelection) => Promise<void>;
  originalModel: string;
  originalProvider: string;
}

const ImageRetryModelContent = memo<ImageRetryModelContentProps>(
  ({ mode, originalModel, originalProvider, onConfirm }) => {
    const { t: tImage } = useTranslation('image');
    const { t: tCommon } = useTranslation('common');
    const { close, setCanDismissByClickOutside } = useModalContext();
    const enabledModels = useAiInfraStore(aiProviderSelectors.enabledImageModelList);
    const currentModel = useImageStore((state) => state.model);
    const currentProvider = useImageStore((state) => state.provider);
    const [selection, setSelection] = useState<ImageRetryModelSelection>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const preferredSelection = useMemo<ImageRetryModelSelection | undefined>(() => {
      const currentProviderGroup = enabledModels.find((group) => group.id === currentProvider);
      if (currentProviderGroup?.children.some((model) => model.id === currentModel)) {
        return { model: currentModel, provider: currentProvider };
      }

      const firstProvider = enabledModels[0];
      const firstModel = firstProvider?.children[0];
      if (!firstProvider || !firstModel) return;

      return { model: firstModel.id, provider: firstProvider.id };
    }, [currentModel, currentProvider, enabledModels]);

    useEffect(() => {
      if (!selection && preferredSelection) setSelection(preferredSelection);
    }, [preferredSelection, selection]);

    useEffect(() => {
      setCanDismissByClickOutside(!loading);
    }, [loading, setCanDismissByClickOutside]);

    const selectedModel = useMemo(() => {
      if (!selection) return;
      return enabledModels
        .find((group) => group.id === selection.provider)
        ?.children.find((model) => model.id === selection.model);
    }, [enabledModels, selection]);

    const handleConfirm = async () => {
      if (!selection || loading) return;

      setLoading(true);
      setError(undefined);
      try {
        await onConfirm(selection);
        close();
      } catch (cause) {
        console.error('Failed to continue image generation with replacement model:', cause);
        setError(tImage('studio.retryModel.failed'));
      } finally {
        setLoading(false);
      }
    };

    return (
      <Flexbox gap={16}>
        <Text type={'secondary'}>
          {tImage('studio.retryModel.description', {
            model: originalModel,
            provider: originalProvider,
          })}
        </Text>
        {selection ? (
          <Flexbox gap={8}>
            <Text fontSize={13} weight={500}>
              {tImage('studio.retryModel.selectLabel')}
            </Text>
            <ModelSwitchPanel
              ModelItemComponent={ImageModelItem}
              enabledList={enabledModels}
              model={selection.model}
              openOnHover={false}
              placement={'bottomLeft'}
              pricingMode={'image'}
              provider={selection.provider}
              onModelChange={async ({ model, provider }) => {
                setSelection({ model, provider });
                setError(undefined);
              }}
            >
              <Button
                block
                disabled={loading}
                icon={<ModelIcon model={selection.model} size={20} />}
              >
                <Text ellipsis style={{ flex: 1, textAlign: 'start' }}>
                  {selectedModel?.displayName || selection.model}
                </Text>
                <Icon icon={ChevronDown} size={16} />
              </Button>
            </ModelSwitchPanel>
          </Flexbox>
        ) : (
          <Text type={'secondary'}>{tImage('studio.retryModel.empty')}</Text>
        )}
        {error && <Text style={{ color: cssVar.colorError }}>{error}</Text>}
        <Flexbox horizontal gap={8} justify={'flex-end'}>
          <Button disabled={loading} onClick={close}>
            {tCommon('cancel')}
          </Button>
          <Button disabled={!selection} loading={loading} type={'primary'} onClick={handleConfirm}>
            {mode === 'adjust'
              ? tImage('studio.retryModel.adjust')
              : tImage('studio.retryModel.regenerate')}
          </Button>
        </Flexbox>
      </Flexbox>
    );
  },
);

ImageRetryModelContent.displayName = 'ImageRetryModelContent';

export const openImageRetryModelModal = (options: ImageRetryModelContentProps): ModalInstance =>
  createModal({
    content: <ImageRetryModelContent {...options} />,
    footer: null,
    maskClosable: true,
    title: t('studio.retryModel.title', { ns: 'image' }),
    width: 'min(92vw, 520px)',
  });
