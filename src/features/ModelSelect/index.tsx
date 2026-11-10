import { TooltipGroup } from '@lobehub/ui';
import { Select, type SelectProps } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { type ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { ModelItemRender, ProviderItemRender, TAG_CLASSNAME } from '@/components/ModelSelect';
import { useEnabledChatModels } from '@/hooks/useEnabledChatModels';
import { useAiInfraStore } from '@/store/aiInfra';
import { aiProviderSelectors } from '@/store/aiInfra/selectors';
import { type EnabledProviderWithModels } from '@/types/aiProvider';

const prefixCls = 'ant';

const styles = createStaticStyles(({ css }) => ({
  popup: css`
    width: max(360px, var(--anchor-width));
    max-width: calc(100vw - 24px);
    max-height: min(70dvh, var(--available-height, 600px));

    &.${prefixCls}-select-dropdown .${prefixCls}-select-item-option-grouped {
      padding-inline-start: 12px;
    }
  `,
  select: css`
    .${prefixCls}-select-selection-item {
      .${TAG_CLASSNAME} {
        display: none;
      }
    }
  `,
}));

interface ModelOption {
  abilities?: Record<string, boolean>;
  id: string;
  label: ReactNode;
  provider: string;
  value: string;
}

interface ModelSelectProps extends Pick<
  SelectProps,
  'disabled' | 'loading' | 'size' | 'style' | 'variant'
> {
  defaultValue?: { model: string; provider?: string };
  initialWidth?: boolean;
  modelType?: 'chat' | 'image';
  /** When provided, the explicit empty selection is returned as empty model/provider strings. */
  noneLabel?: string;
  onChange?: (props: { model: string; provider: string }) => void;
  popupWidth?: number;
  requiredAbilities?: (keyof EnabledProviderWithModels['children'][number]['abilities'])[];
  showAbility?: boolean;
  value?: { model: string; provider?: string };
}

const ModelSelect = memo<ModelSelectProps>(
  ({
    value,
    onChange,
    requiredAbilities,
    loading,
    disabled,
    size,
    style,
    variant,
    initialWidth = false,
    modelType = 'chat',
    noneLabel,
    popupWidth,
  }) => {
    const chatModels = useEnabledChatModels();
    const imageModels = useAiInfraStore(aiProviderSelectors.enabledImageModelList);
    const enabledList = modelType === 'image' ? imageModels : chatModels;
    const noneValue = '__none__';

    const options = useMemo<SelectProps['options']>(() => {
      const getChatModels = (provider: EnabledProviderWithModels) => {
        const models =
          requiredAbilities && requiredAbilities.length > 0
            ? provider.children.filter((model) =>
                requiredAbilities.every((ability) => Boolean(model.abilities?.[ability])),
              )
            : provider.children;

        return models.map((model) => ({
          ...model,
          label: <ModelItemRender {...model} {...model.abilities} showInfoTag={false} />,
          provider: provider.id,
          value: `${provider.id}/${model.id}`,
        }));
      };

      const noneOptions = noneLabel ? [{ label: noneLabel, value: noneValue }] : [];

      if (enabledList.length === 1) {
        const provider = enabledList[0];

        return [...noneOptions, ...getChatModels(provider)];
      }

      const providerOptions = enabledList
        .map((provider) => {
          const opts = getChatModels(provider);
          if (opts.length === 0) return undefined;

          return {
            label: (
              <ProviderItemRender
                logo={provider.logo}
                name={provider.name}
                provider={provider.id}
                source={provider.source}
              />
            ),
            options: opts,
          };
        })
        .filter(Boolean);
      return [...noneOptions, ...providerOptions] as SelectProps['options'];
    }, [enabledList, requiredAbilities, noneLabel]);

    const selectedValue =
      noneLabel && !value?.model ? noneValue : `${value?.provider}/${value?.model}`;

    return (
      <TooltipGroup>
        <Select
          className={styles.select}
          defaultValue={selectedValue}
          disabled={disabled}
          loading={loading}
          options={options}
          popupClassName={styles.popup}
          popupMatchSelectWidth={popupWidth === undefined ? false : popupWidth}
          size={size}
          value={selectedValue}
          variant={variant}
          optionRender={(option) =>
            option.value === noneValue ? (
              noneLabel
            ) : (
              <ModelItemRender
                {...(option as ModelOption)}
                {...(option as ModelOption).abilities}
                showInfoTag={false}
              />
            )
          }
          style={{
            minWidth: 200,
            width: initialWidth ? 'initial' : undefined,
            ...style,
          }}
          onChange={(value, option) => {
            if (noneLabel && value === noneValue) {
              onChange?.({ model: '', provider: '' });
              return;
            }
            const model = value.split('/').slice(1).join('/');
            onChange?.({ model, provider: (option as unknown as ModelOption).provider });
          }}
        />
      </TooltipGroup>
    );
  },
);

export default ModelSelect;
