'use client';

import type { BackgroundDevice } from '@lobechat/types';
import { Alert, Flexbox, SliderWithInput, Text } from '@lobehub/ui';
import { Button, createModal, Segmented, useModalContext } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { t } from 'i18next';
import { useTranslation } from 'react-i18next';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';

import { useCropImage } from './useCropImage';

const styles = createStaticStyles(({ css }) => ({
  content: css`
    overflow-y: auto;
    max-height: 84dvh;
    padding: 24px;
  `,
  viewport: css`
    touch-action: none;
    cursor: grab;

    position: relative;

    overflow: hidden;
    flex-shrink: 0;
    align-self: center;

    width: min(100%, 480px);
    max-height: 42dvh;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgLayout};

    &:active {
      cursor: grabbing;
    }
  `,
}));

const CropImageContent = ({
  file,
  device,
  onComplete,
}: {
  device: BackgroundDevice;
  file: File;
  onComplete: (file: File | null) => void;
}) => {
  const { t } = useTranslation('setting');
  const { close } = useModalContext();
  const state = useCropImage(file, device);
  return (
    <Flexbox className={styles.content} gap={16}>
      <Text type={'secondary'}>{t('globalBackground.cropHelp')}</Text>
      {state.error && <Alert title={t('globalBackground.cropFailed')} type={'error'} />}
      {!state.loaded && !state.error && <NeuralNetworkLoading />}
      {state.loaded && state.crop && (
        <div
          aria-label={t('globalBackground.cropPreview')}
          className={styles.viewport}
          ref={state.viewport}
          style={{
            aspectRatio: state.options.aspect,
            // Bound width as well as height so portrait crops are not stretched.
            width: `min(100%, 480px, ${42 * state.options.aspect}dvh)`,
          }}
          onPointerCancel={state.onPointerUp}
          onPointerDown={state.onPointerDown}
          onPointerMove={state.onPointerMove}
          onPointerUp={state.onPointerUp}
        >
          <img
            alt=""
            draggable={false}
            src={state.loaded.url}
            style={{
              height: `${(state.loaded.image.naturalHeight / state.crop.height) * 100}%`,
              left: `${(-state.crop.left / state.crop.width) * 100}%`,
              maxWidth: 'none',
              pointerEvents: 'none',
              position: 'absolute',
              top: `${(-state.crop.top / state.crop.height) * 100}%`,
              width: `${(state.loaded.image.naturalWidth / state.crop.width) * 100}%`,
            }}
          />
        </div>
      )}
      <Segmented
        block
        disabled={state.busy}
        value={String(state.options.aspect)}
        options={[
          { label: '16:9', value: String(16 / 9) },
          { label: '9:16', value: String(9 / 16) },
          { label: '1:1', value: '1' },
        ]}
        onChange={(aspect) =>
          state.setOptions((options) => ({ ...options, aspect: Number(aspect) }))
        }
      />
      {(['zoom', 'x', 'y'] as const).map((key) => (
        <Flexbox gap={4} key={key}>
          <Text>{t(`globalBackground.crop.${key}`)}</Text>
          <SliderWithInput
            aria-label={t(`globalBackground.crop.${key}`)}
            disabled={!state.loaded || state.busy}
            max={key === 'zoom' ? 4 : 100}
            min={key === 'zoom' ? 1 : 0}
            step={key === 'zoom' ? 0.01 : 1}
            value={state.options[key]}
            onChange={(value) => state.setOptions((options) => ({ ...options, [key]: value }))}
          />
        </Flexbox>
      ))}
      <Flexbox horizontal gap={8} justify={'flex-end'}>
        <Button
          disabled={state.busy}
          onClick={() => {
            onComplete(null);
            close();
          }}
        >
          {t('globalBackground.cancel')}
        </Button>
        <Button
          disabled={!state.loaded}
          loading={state.busy}
          type={'primary'}
          onClick={async () => {
            const cropped = await state.createFile();
            if (cropped) {
              onComplete(cropped);
              close();
            }
          }}
        >
          {t('globalBackground.cropApply')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export const cropUploadedBackground = (
  file: File,
  device: BackgroundDevice,
  signal?: AbortSignal,
) =>
  new Promise<File | null>((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }
    let completed = false;
    const onComplete = (result: File | null) => {
      if (completed) return;
      completed = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = () => {
      onComplete(null);
      modal.close();
    };
    const modal = createModal({
      content: <CropImageContent device={device} file={file} onComplete={onComplete} />,
      footer: null,
      onOpenChange: (open) => {
        if (!open) onComplete(null);
      },
      styles: { content: { padding: 0 } },
      title: t('globalBackground.cropTitle', { name: file.name, ns: 'setting' }),
      width: 'min(94vw, 640px)',
    });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
