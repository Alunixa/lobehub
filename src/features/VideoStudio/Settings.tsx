'use client';

import { Flexbox, InputNumber } from '@lobehub/ui';
import { Select, Switch, Text } from '@lobehub/ui/base-ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { StudioField } from '@/features/ImageStudio/Settings';
import { studioStyles as styles } from '@/features/ImageStudio/styles';
import { useVideoStore } from '@/store/video';
import { useVideoGenerationConfigParam } from '@/store/video/slices/generationConfig/hooks';

const ChoiceSetting = ({ name }: { name: 'aspectRatio' | 'duration' | 'resolution' | 'size' }) => {
  const { t } = useTranslation('video');
  const { value, setValue, enumValues, min, max, step } = useVideoGenerationConfigParam(name);
  return (
    <StudioField label={t(`config.${name}.label`)}>
      {enumValues?.length ? (
        <Select
          options={enumValues.map((item) => ({ label: String(item), value: String(item) }))}
          value={value === null || value === undefined ? undefined : String(value)}
          onChange={(next) => setValue((name === 'duration' ? Number(next) : next) as typeof value)}
        />
      ) : (
        <InputNumber
          max={max}
          min={min}
          step={step ?? 1}
          style={{ width: '100%' }}
          value={typeof value === 'number' ? value : min}
          onChange={(next) => setValue(next as typeof value)}
        />
      )}
    </StudioField>
  );
};

const BooleanSetting = ({
  name,
}: {
  name: 'cameraFixed' | 'generateAudio' | 'promptExtend' | 'watermark' | 'webSearch';
}) => {
  const { t } = useTranslation('video');
  const id = useId();
  const { value, setValue, enumValues } = useVideoGenerationConfigParam(name);
  return (
    <Flexbox horizontal align={'center'} gap={12} justify={'space-between'}>
      <label htmlFor={id}>{t(`config.${name}.label`)}</label>
      {enumValues?.length ? (
        <Select
          options={enumValues.map((item) => ({ label: String(item), value: String(item) }))}
          value={String(value)}
          onChange={(next) => setValue(next as typeof value)}
        />
      ) : (
        <Switch checked={!!value} id={id} onChange={(next) => setValue(next as typeof value)} />
      )}
    </Flexbox>
  );
};

const SeedSetting = () => {
  const { t } = useTranslation('video');
  const { value, setValue, min, max } = useVideoGenerationConfigParam('seed');
  return (
    <StudioField label={t('config.seed.label')}>
      <InputNumber
        max={max}
        min={min}
        placeholder={t('config.seed.random')}
        style={{ width: '100%' }}
        value={value}
        onChange={(next) => setValue(next === null ? null : Number(next))}
      />
    </StudioField>
  );
};

export const VideoStudioSettings = () => {
  const { t } = useTranslation(['video', 'image']);
  const schema = useVideoStore((s) => s.parametersSchema);
  const primary = ['aspectRatio', 'resolution', 'size', 'duration'] as const;
  const optional = [
    'generateAudio',
    'cameraFixed',
    'watermark',
    'promptExtend',
    'webSearch',
  ] as const;
  return (
    <Flexbox gap={18}>
      <Text className={styles.sectionLabel}>{t('studio.parameters', { ns: 'image' })}</Text>
      <div className={styles.parameterGrid}>
        {primary
          .filter((name) => name in schema)
          .map((name) => (
            <ChoiceSetting key={name} name={name} />
          ))}
      </div>
      {optional
        .filter((name) => name in schema)
        .map((name) => (
          <BooleanSetting key={name} name={name} />
        ))}
      {'seed' in schema && (
        <details className={styles.details}>
          <summary>{t('studio.advanced', { ns: 'image' })}</summary>
          <SeedSetting />
        </details>
      )}
    </Flexbox>
  );
};
