'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Switch, Tabs } from '@lobehub/ui/base-ui';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CfgSliderInput,
  DimensionControlGroup,
  ImageNum,
  QualitySelect,
  ResolutionSelect,
  SeedNumberInput,
  SizeSelect,
  StepsSliderInput,
} from '@/routes/(main)/(create)/image/features/ConfigPanel';
import { useImageStore } from '@/store/image';
import { imageGenerationConfigSelectors } from '@/store/image/selectors';
import {
  useDimensionControl,
  useGenerationConfigParam,
} from '@/store/image/slices/generationConfig/hooks';

import { studioStyles as styles } from './styles';

export const StudioField = ({ children, label }: { children: ReactNode; label: string }) => (
  <Flexbox gap={8} style={{ minWidth: 0 }}>
    <Text fontSize={13} weight={500}>
      {label}
    </Text>
    {children}
  </Flexbox>
);

const BooleanSetting = ({ name }: { name: 'promptExtend' | 'watermark' | 'webSearch' }) => {
  const { t } = useTranslation('image');
  const { value, setValue, enumValues } = useGenerationConfigParam(name);
  const id = useId();

  if (enumValues?.length) {
    return (
      <StudioField label={t(`config.${name}.label`)}>
        <Tabs
          activeKey={String(value)}
          items={enumValues.map((item) => ({ key: item, label: item }))}
          onChange={setValue}
        />
      </StudioField>
    );
  }

  return (
    <Flexbox horizontal align={'center'} justify={'space-between'}>
      <label htmlFor={id}>{t(`config.${name}.label`)}</label>
      <Switch checked={!!value} id={id} onChange={(checked) => setValue(checked)} />
    </Flexbox>
  );
};

export const StudioSettings = ({ disabled }: { disabled: boolean }) => {
  const { t } = useTranslation('image');
  const schema = useImageStore(imageGenerationConfigSelectors.parametersSchema);
  const { showDimensionControl } = useDimensionControl();
  const advanced = ['steps', 'cfg', 'seed', 'promptExtend', 'watermark', 'webSearch'].some(
    (key) => key in schema,
  );

  return (
    <>
      {'size' in schema && (
        <StudioField label={t('studio.size')}>
          <SizeSelect />
        </StudioField>
      )}
      {showDimensionControl && <DimensionControlGroup />}
      {'resolution' in schema && (
        <StudioField label={t('config.resolution.label')}>
          <ResolutionSelect />
        </StudioField>
      )}
      {'quality' in schema && (
        <StudioField label={t('config.quality.label')}>
          <QualitySelect />
        </StudioField>
      )}
      <StudioField label={t('config.imageNum.label')}>
        <ImageNum disabled={disabled} />
      </StudioField>
      {advanced && (
        <details className={styles.details}>
          <summary>{t('studio.advanced')}</summary>
          <Flexbox gap={16}>
            {'steps' in schema && (
              <StudioField label={t('config.steps.label')}>
                <StepsSliderInput />
              </StudioField>
            )}
            {'cfg' in schema && (
              <StudioField label={t('config.cfg.label')}>
                <CfgSliderInput />
              </StudioField>
            )}
            {'seed' in schema && (
              <StudioField label={t('config.seed.label')}>
                <SeedNumberInput />
              </StudioField>
            )}
            {'promptExtend' in schema && <BooleanSetting name={'promptExtend'} />}
            {'watermark' in schema && <BooleanSetting name={'watermark'} />}
            {'webSearch' in schema && <BooleanSetting name={'webSearch'} />}
          </Flexbox>
        </details>
      )}
    </>
  );
};
