'use client';

import { ActionIcon, Alert, Flexbox, FormGroup, Icon, SliderWithInput, Text } from '@lobehub/ui';
import { Button, Segmented, Select, Switch } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
  BACKGROUND_IMAGE_TYPES,
  DEFAULT_BACKGROUND_CONFIG,
  MAX_BACKGROUND_IMAGES,
} from '@/features/GlobalBackground/config';

import { useBackgroundSetting } from './useBackgroundSetting';

const styles = createStaticStyles(({ css }) => ({
  body: css`
    padding: 16px;
  `,
  image: css`
    width: 100%;
    height: 76px;
    border-radius: ${cssVar.borderRadius};
    object-fit: cover;
  `,
  images: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  `,
  preview: css`
    position: relative;

    overflow: hidden;

    width: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgLayout};
  `,
}));

export const GlobalBackgroundSetting = memo(() => {
  const { t } = useTranslation('setting');
  const input = useRef<HTMLInputElement>(null);
  const state = useBackgroundSetting();
  const { config } = state;
  const disabled = !state.ready || state.uploading || state.status === 'saving';
  const selected =
    config.images.find((image) => image.id === config.activeImageId) ?? config.images[0];

  return (
    <FormGroup collapsible={false} title={t('globalBackground.title')} variant={'filled'}>
      <Flexbox className={styles.body} gap={16}>
        <Text type={'secondary'}>{t('globalBackground.description')}</Text>
        <Segmented
          block
          disabled={disabled}
          value={state.device}
          options={[
            { label: t('globalBackground.desktop'), value: 'desktop' },
            { label: t('globalBackground.mobile'), value: 'mobile' },
          ]}
          onChange={(device) => state.setDevice(device as 'desktop' | 'mobile')}
        />
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text>{t('globalBackground.enabled')}</Text>
          <Switch
            checked={config.enabled}
            disabled={disabled || config.images.length === 0}
            title={t('globalBackground.enabled')}
            onChange={(enabled) => state.update({ enabled })}
          />
        </Flexbox>
        <input
          hidden
          multiple
          accept={BACKGROUND_IMAGE_TYPES.join(',')}
          ref={input}
          type={'file'}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length) void state.upload(files);
          }}
        />
        <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
          <Button
            disabled={disabled || config.images.length >= MAX_BACKGROUND_IMAGES}
            icon={<Icon icon={ImagePlus} />}
            loading={state.uploading}
            onClick={() => input.current?.click()}
          >
            {t('globalBackground.upload')}
          </Button>
          {state.uploading && (
            <Button onClick={state.cancelUpload}>{t('globalBackground.cancel')}</Button>
          )}
          <Text type={'secondary'}>
            {t('globalBackground.count', {
              count: config.images.length,
              max: MAX_BACKGROUND_IMAGES,
            })}
          </Text>
        </Flexbox>
        {state.notice && (
          <Alert
            title={t(`globalBackground.notice.${state.notice}`)}
            type={state.notice === 'limit' ? 'warning' : 'error'}
            extra={
              state.canRetry && (
                <Button disabled={disabled} onClick={state.retryUpload}>
                  {t('globalBackground.retry')}
                </Button>
              )
            }
          />
        )}
        {config.images.length > 0 && (
          <div className={styles.images}>
            {config.images.map((image, index) => (
              <Flexbox gap={4} key={image.id}>
                <Button
                  aria-pressed={image.id === selected?.id}
                  disabled={disabled}
                  style={{ height: 'auto', padding: 2 }}
                  title={t('globalBackground.selectImage', { number: index + 1 })}
                  type={image.id === selected?.id ? 'primary' : 'default'}
                  onClick={() => state.update({ activeImageId: image.id })}
                >
                  <img alt={image.name} className={styles.image} src={image.url} />
                </Button>
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <Text>{index + 1}</Text>
                  <ActionIcon
                    disabled={disabled}
                    icon={Trash2}
                    size={'small'}
                    title={t('globalBackground.remove')}
                    onClick={() =>
                      state.update({ images: config.images.filter((item) => item.id !== image.id) })
                    }
                  />
                </Flexbox>
              </Flexbox>
            ))}
          </div>
        )}
        {selected && (
          <div
            aria-label={t('globalBackground.preview')}
            className={styles.preview}
            style={{
              alignSelf: 'center',
              aspectRatio: state.device === 'mobile' ? '9 / 16' : '16 / 9',
              maxHeight: 260,
              width: `min(100%, ${260 * (state.device === 'mobile' ? 9 / 16 : 16 / 9)}px)`,
            }}
          >
            <img
              alt=""
              src={selected.url}
              style={{
                filter: `blur(${config.blur}px)`,
                height: '100%',
                objectFit: 'cover',
                opacity: config.opacity,
                width: '100%',
              }}
            />
            <div
              style={{
                background:
                  config.overlayColor === 'auto' ? cssVar.colorBgContainer : config.overlayColor,
                inset: 0,
                opacity: config.overlayOpacity,
                position: 'absolute',
              }}
            />
          </div>
        )}
        {(['opacity', 'overlayOpacity', 'blur'] as const).map((key) => (
          <Flexbox gap={4} key={key}>
            <Text>{t(`globalBackground.${key}`)}</Text>
            <SliderWithInput
              aria-label={t(`globalBackground.${key}`)}
              disabled={disabled}
              max={key === 'blur' ? 30 : 100}
              min={0}
              step={1}
              value={key === 'blur' ? config[key] : Math.round(config[key] * 100)}
              onChange={(value) => state.update({ [key]: key === 'blur' ? value : value / 100 })}
            />
          </Flexbox>
        ))}
        <Flexbox gap={8}>
          <Text>{t('globalBackground.overlayColor')}</Text>
          <Select
            disabled={disabled}
            value={config.overlayColor}
            options={(['auto', 'black', 'white'] as const).map((value) => ({
              label: t(`globalBackground.color.${value}`),
              value,
            }))}
            onChange={(overlayColor) =>
              state.update({ overlayColor: overlayColor as 'auto' | 'black' | 'white' })
            }
          />
        </Flexbox>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text>{t('globalBackground.slideshow')}</Text>
          <Switch
            checked={config.slideshow}
            disabled={disabled || config.images.length < 2}
            title={t('globalBackground.slideshow')}
            onChange={(slideshow) => state.update({ slideshow })}
          />
        </Flexbox>
        {config.slideshow && (
          <Flexbox gap={4}>
            <Text>{t('globalBackground.intervalSeconds')}</Text>
            <SliderWithInput
              aria-label={t('globalBackground.intervalSeconds')}
              disabled={disabled}
              max={300}
              min={10}
              step={5}
              value={config.intervalSeconds}
              onChange={(intervalSeconds) => state.update({ intervalSeconds })}
            />
          </Flexbox>
        )}
        <Text type={'secondary'}>{t('globalBackground.previewIsolated')}</Text>
        {state.status === 'failed' && (
          <Alert title={t('globalBackground.saveFailed')} type={'error'} />
        )}
        {state.status === 'saved' && <Text type={'success'}>{t('globalBackground.saved')}</Text>}
        <Flexbox horizontal gap={8} justify={'flex-end'}>
          <Button
            disabled={disabled}
            icon={<Icon icon={RotateCcw} />}
            onClick={() => state.update(DEFAULT_BACKGROUND_CONFIG)}
          >
            {t('globalBackground.reset')}
          </Button>
          <Button
            disabled={disabled}
            loading={state.status === 'saving'}
            type={'primary'}
            onClick={state.save}
          >
            {t('globalBackground.save')}
          </Button>
        </Flexbox>
      </Flexbox>
    </FormGroup>
  );
});

GlobalBackgroundSetting.displayName = 'GlobalBackgroundSetting';
