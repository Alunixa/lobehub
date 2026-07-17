import { Center, Flexbox, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { ChevronDownIcon } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useBusinessModelModeConfig } from '@/business/client/hooks/useBusinessAgentMode';
import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { usePermission } from '@/hooks/usePermission';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

import { useAgentId } from '../../hooks/useAgentId';
import { useChatInputResourceAccess } from '../../hooks/useChatInputResourceAccess';
import { useActionBarContext } from '../context';

const styles = createStaticStyles(({ css, cssVar }) => ({
  chevron: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  name: css`
    overflow: hidden;

    max-width: 160px;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;
    border-radius: 6px;

    :hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  triggerDisabled: css`
    cursor: not-allowed;

    :hover {
      background: transparent;
    }
  `,
}));

const ModelLabel = memo(() => {
  const { t } = useTranslation('setting');
  const { dropdownPlacement } = useActionBarContext();
  const { allowed: canCreateContent, reason } = usePermission('create_content');
  const { canConfigureResource, isAccessLoading } = useChatInputResourceAccess();
  const canSelectModel = canCreateContent && canConfigureResource && !isAccessLoading;
  const disabledReason = !canCreateContent
    ? reason
    : isAccessLoading
      ? t('checkingPermissions')
      : t('permission.accessTag.useOnlyTip');

  const agentId = useAgentId();
  const [model, provider, updateAgentConfigById] = useAgentStore((s) => [
    agentByIdSelectors.getAgentModelById(agentId)(s),
    agentByIdSelectors.getAgentModelProviderById(agentId)(s),
    s.updateAgentConfigById,
  ]);
  const applyBusinessModelModeConfig = useBusinessModelModeConfig();

  const enabledModel = useAiInfraStore(aiModelSelectors.getEnabledModelById(model, provider));
  const displayName = enabledModel?.displayName || model;

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      if (!canSelectModel) return;

      await updateAgentConfigById(agentId, applyBusinessModelModeConfig(params));
    },
    [agentId, applyBusinessModelModeConfig, canSelectModel, updateAgentConfigById],
  );

  const trigger = (
    <Center
      horizontal
      aria-disabled={!canSelectModel}
      aria-label={displayName}
      className={cx(styles.trigger, !canSelectModel && styles.triggerDisabled)}
      height={28}
      paddingInline={6}
    >
      <Flexbox horizontal align={'center'} gap={2}>
        <span className={styles.name}>{displayName}</span>
        <ChevronDownIcon className={styles.chevron} size={12} />
      </Flexbox>
    </Center>
  );

  if (!canSelectModel)
    return (
      <Tooltip title={disabledReason}>
        <div>{trigger}</div>
      </Tooltip>
    );

  return (
    <ModelSwitchPanel
      model={model}
      openOnHover={false}
      placement={dropdownPlacement}
      provider={provider}
      onModelChange={handleModelChange}
    >
      {trigger}
    </ModelSwitchPanel>
  );
});

ModelLabel.displayName = 'ModelLabel';

export default ModelLabel;
