'use client';

import { type GridProps } from '@lobehub/ui';
import { ActionIcon, Block, Center, Flexbox, Grid, InputNumber, Text } from '@lobehub/ui';
import { Button, Select } from '@lobehub/ui/base-ui';
import { cssVar } from 'antd-style';
import { Check, Plus, X } from 'lucide-react';
import { type ReactNode } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMergeState from 'use-merge-value';

import { isCustomDimensionValid, parseSizeValue } from './utils';

export interface SizeSelectProps extends Omit<GridProps, 'children' | 'onChange'> {
  allowCustom?: boolean;
  defaultValue?: 'auto' | string;
  max?: number;
  min?: number;
  onChange?: (value: string) => void;
  options?: { label?: string; value: 'auto' | string }[];
  step?: number;
  value?: 'auto' | string;
}

const CUSTOM_VALUE = '__custom__';

/**
 * Check if a size value can be parsed as valid aspect ratio
 */
const canParseAsRatio = (value: string): boolean => {
  if (value === 'auto') return true;
  return Boolean(parseSizeValue(value));
};

const SizeSelect = memo<SizeSelectProps>(
  ({ options, onChange, value, defaultValue, allowCustom, min, max, step, ...rest }) => {
    const { t } = useTranslation('image');
    const [active, setActive] = useMergeState('auto', {
      defaultValue,
      onChange,
      value,
    });
    const [isEditing, setIsEditing] = useState(false);
    const [customWidth, setCustomWidth] = useState<number | null>(null);
    const [customHeight, setCustomHeight] = useState<number | null>(null);
    const customWidthRef = useRef<number | null>(null);
    const customHeightRef = useRef<number | null>(null);

    const isCustomValue = useMemo(
      () => Boolean(parseSizeValue(active)) && !options?.some((item) => item.value === active),
      [active, options],
    );

    const displayOptions = useMemo(() => {
      const items = [...(options ?? [])];
      if (!allowCustom) return items;

      items.push(
        isCustomValue
          ? { label: active, value: active }
          : {
              label: t('config.size.custom', { defaultValue: 'Custom' }),
              value: CUSTOM_VALUE,
            },
      );
      return items;
    }, [active, allowCustom, isCustomValue, options, t]);

    const startCustomEditing = useCallback(() => {
      const current = parseSizeValue(active);
      const fallback = options?.map((item) => parseSizeValue(item.value)).find(Boolean) ?? {
        height: 1024,
        width: 1024,
      };
      const initialWidth = current?.width ?? fallback.width;
      const initialHeight = current?.height ?? fallback.height;

      customWidthRef.current = initialWidth;
      customHeightRef.current = initialHeight;
      setCustomWidth(initialWidth);
      setCustomHeight(initialHeight);
      setIsEditing(true);
    }, [active, options]);

    const handleCustomConfirm = useCallback(() => {
      const width = customWidthRef.current;
      const height = customHeightRef.current;
      if (!isCustomDimensionValid(width, min, max) || !isCustomDimensionValid(height, min, max)) {
        return;
      }

      const customSize = `${width}x${height}`;
      setActive(customSize);
      onChange?.(customSize);
      setIsEditing(false);
    }, [max, min, onChange, setActive]);

    const handleCustomCancel = useCallback(() => {
      setIsEditing(false);
    }, []);

    const updateCustomWidth = useCallback((nextValue: number | string | null) => {
      const nextWidth = nextValue === null ? null : Number(nextValue);
      const normalized = nextWidth && Number.isInteger(nextWidth) ? nextWidth : null;
      customWidthRef.current = normalized;
      setCustomWidth(normalized);
    }, []);

    const updateCustomHeight = useCallback((nextValue: number | string | null) => {
      const nextHeight = nextValue === null ? null : Number(nextValue);
      const normalized = nextHeight && Number.isInteger(nextHeight) ? nextHeight : null;
      customHeightRef.current = normalized;
      setCustomHeight(normalized);
    }, []);

    const isValidCustomSize =
      isCustomDimensionValid(customWidth, min, max) &&
      isCustomDimensionValid(customHeight, min, max);

    // Check if all options can be parsed as valid ratios
    const hasInvalidRatio = options?.some((item) => !canParseAsRatio(item.value));

    // If any option cannot be parsed as ratio, fallback to regular Select
    if (hasInvalidRatio) {
      return (
        <Select
          options={options?.map((option) => ({ ...option, label: option.label || option.value }))}
          style={{ width: '100%' }}
          value={active}
          onChange={onChange}
        />
      );
    }

    if (isEditing) {
      return (
        <Flexbox gap={6}>
          <Flexbox horizontal align={'center'} gap={6} style={{ flexWrap: 'wrap' }}>
            <InputNumber
              aria-label={t('config.width.label')}
              max={max}
              min={min ?? 1}
              placeholder={t('config.width.label')}
              size={'large'}
              step={step}
              style={{ flex: '1 1 80px', minWidth: 0 }}
              value={customWidth}
              onChange={updateCustomWidth}
              onPressEnter={handleCustomConfirm}
            />
            <Text type={'secondary'}>×</Text>
            <InputNumber
              aria-label={t('config.height.label')}
              max={max}
              min={min ?? 1}
              placeholder={t('config.height.label')}
              size={'large'}
              step={step}
              style={{ flex: '1 1 80px', minWidth: 0 }}
              value={customHeight}
              onChange={updateCustomHeight}
              onPressEnter={handleCustomConfirm}
            />
            <ActionIcon
              aria-label={t('confirm', { ns: 'common' })}
              disabled={!isValidCustomSize}
              icon={Check}
              size={{ blockSize: 44, size: 20 }}
              variant={'filled'}
              onClick={handleCustomConfirm}
            />
            <ActionIcon
              aria-label={t('cancel', { ns: 'common' })}
              icon={X}
              size={{ blockSize: 44, size: 20 }}
              variant={'filled'}
              onClick={handleCustomCancel}
            />
          </Flexbox>
          <Text fontSize={12} type={'secondary'}>
            {t('config.size.customHint', {
              defaultValue: 'Enter width and height to create a custom aspect ratio',
            })}
          </Text>
        </Flexbox>
      );
    }

    return (
      <Block padding={4} variant={'filled'} {...rest}>
        <Grid gap={4} maxItemWidth={72} rows={16}>
          {displayOptions.map((item) => {
            const isActive = active === item.value;
            let content: ReactNode;

            if (item.value === CUSTOM_VALUE) {
              content = <Plus size={16} />;
            } else if (item.value === 'auto') {
              content = (
                <div
                  style={{
                    border: `2px dashed ${isActive ? cssVar.colorText : cssVar.colorTextDescription}`,
                    borderRadius: 3,
                    height: 16,
                    width: 16,
                  }}
                />
              );
            } else {
              const [width, height] = item.value.split('x').map(Number);
              const isWidthGreater = width > height;
              content = (
                <div
                  style={{
                    aspectRatio: `${width} / ${height}`,
                    border: `2px solid ${isActive ? cssVar.colorText : cssVar.colorTextDescription}`,
                    borderRadius: 3,
                    height: isWidthGreater ? undefined : 16,
                    width: isWidthGreater ? 16 : undefined,
                  }}
                />
              );
            }

            return (
              <Button
                aria-pressed={isActive}
                key={item.value}
                type={'text'}
                style={{
                  alignItems: 'center',
                  backgroundColor: isActive ? cssVar.colorBgElevated : 'transparent',
                  flexDirection: 'column',
                  gap: 4,
                  height: 'auto',
                  minHeight: 64,
                  minWidth: 0,
                  padding: '8px 4px',
                  whiteSpace: 'normal',
                }}
                onClick={() => {
                  if (item.value === CUSTOM_VALUE || (allowCustom && isCustomValue && isActive)) {
                    startCustomEditing();
                    return;
                  }
                  setActive(item.value);
                  onChange?.(item.value);
                }}
              >
                <Center height={16} style={{ marginTop: 4 }} width={16}>
                  {content}
                </Center>
                <Text
                  fontSize={12}
                  style={{ overflowWrap: 'anywhere' }}
                  type={isActive ? undefined : 'secondary'}
                >
                  {item.label || item.value}
                </Text>
              </Button>
            );
          })}
        </Grid>
      </Block>
    );
  },
);

export default SizeSelect;
