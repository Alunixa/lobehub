import {
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  stopPropagation,
  TooltipGroup,
} from '@lobehub/ui';
import { memo, useCallback, useState } from 'react';

import { useIsMobile } from '@/hooks/useIsMobile';

import { PanelContent } from './components/PanelContent';
import { styles } from './styles';
import { type ModelSwitchPanelProps } from './types';
import { resolveOpenOnHover } from './utils';

const ModelSwitchPanel = memo<ModelSwitchPanelProps>(
  ({
    ModelItemComponent,
    children,
    enabledList,
    model: modelProp,
    onModelChange,
    onOpenChange,
    open,
    placement = 'topLeft',
    pricingMode,
    provider: providerProp,
    openOnHover = true,
  }) => {
    const isMobile = useIsMobile();
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open ?? internalOpen;
    const resolvedOpenOnHover = resolveOpenOnHover(openOnHover, isMobile);

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
      },
      [onOpenChange],
    );

    return (
      <TooltipGroup>
        <DropdownMenuRoot open={isOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger className={styles.trigger} openOnHover={resolvedOpenOnHover}>
            {children}
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuPositioner hoverTrigger={resolvedOpenOnHover} placement={placement}>
              <DropdownMenuPopup className={styles.container} onKeyDown={stopPropagation}>
                <PanelContent
                  ModelItemComponent={ModelItemComponent}
                  enabledList={enabledList}
                  model={modelProp}
                  pricingMode={pricingMode}
                  provider={providerProp}
                  onModelChange={onModelChange}
                  onOpenChange={handleOpenChange}
                />
              </DropdownMenuPopup>
            </DropdownMenuPositioner>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </TooltipGroup>
    );
  },
);

ModelSwitchPanel.displayName = 'ModelSwitchPanel';

export default ModelSwitchPanel;

export { type ModelSwitchPanelProps } from './types';
