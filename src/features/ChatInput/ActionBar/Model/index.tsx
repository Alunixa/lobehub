import { ModelIcon } from '@lobehub/icons';
import { Center, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useBusinessModelModeConfig } from '@/business/client/hooks/useBusinessAgentMode';
import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { usePermission } from '@/hooks/usePermission';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';

import { useAgentId } from '../../hooks/useAgentId';
import { useChatInputResourceAccess } from '../../hooks/useChatInputResourceAccess';
import { useActionBarContext } from '../context';

const styles = createStaticStyles(({ css, cssVar }) => ({
  icon: css`
    transition: scale 400ms cubic-bezier(0.215, 0.61, 0.355, 1);
  `,
  modelDisabled: css`
    cursor: not-allowed;
    opacity: 0.5;

    :hover {
      background: transparent;
    }

    :active {
      div {
        scale: 1;
      }
    }
  `,
  model: css`
    cursor: pointer;
    border-radius: 24px;

    :hover {
      background: ${cssVar.colorFillSecondary};
    }

    :active {
      div {
        scale: 0.8;
      }
    }
  `,
}));

const ModelSwitch = memo(() => {
  const { t } = useTranslation('setting');
  const { actionSize, dropdownPlacement } = useActionBarContext();
  const blockSize = actionSize?.blockSize ?? 32;
  const iconSize = actionSize?.size ?? 20;
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

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      if (!canSelectModel) return;

      await updateAgentConfigById(agentId, applyBusinessModelModeConfig(params));
    },
    [agentId, applyBusinessModelModeConfig, canSelectModel, updateAgentConfigById],
  );

  const trigger = (
    <Center
      aria-disabled={!canSelectModel}
      aria-label={model}
      className={cx(styles.model, !canSelectModel && styles.modelDisabled)}
      height={blockSize}
      width={blockSize}
    >
      <div className={styles.icon}>
        <ModelIcon model={model} size={iconSize} />
      </div>
    </Center>
  );

  if (!canSelectModel)
    return (
      <Tooltip title={`${model} · ${disabledReason}`}>
        <div>{trigger}</div>
      </Tooltip>
    );

  return (
    <ModelSwitchPanel
      model={model}
      placement={dropdownPlacement}
      provider={provider}
      onModelChange={handleModelChange}
    >
      {trigger}
    </ModelSwitchPanel>
  );
});

ModelSwitch.displayName = 'ModelSwitch';

export default ModelSwitch;
