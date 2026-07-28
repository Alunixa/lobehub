export const shouldUseExplicitMobileOverlayClick = (hasOverlay: boolean, isMobile: boolean) =>
  hasOverlay && isMobile;

interface BaseUITriggerEvent {
  preventBaseUIHandler?: () => void;
}

export const preventMobileDropdownMouseDown = (event: BaseUITriggerEvent, isMobile: boolean) => {
  if (!isMobile) return false;

  event.preventBaseUIHandler?.();
  return true;
};
