const editableSelector =
  'textarea,input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="hidden"]),[contenteditable="true"]';

/**
 * Mobile keyboards are opt-in: only a direct gesture on the actual field may
 * programmatically focus it. Native touch focus and Tab navigation are untouched.
 */
export const installMobileInputFocusGuard = (doc: Document = document) => {
  const proto = doc.defaultView!.HTMLElement.prototype;
  const originalFocus = proto.focus;
  let gestureTarget: Element | null = null;
  const onPointerDown = (event: Event) => {
    const target = event.target;
    gestureTarget = target instanceof Element ? target.closest(editableSelector) : null;
    if (target instanceof Element && !gestureTarget) {
      gestureTarget = target.closest('label')?.control ?? null;
    }
    if (
      !gestureTarget &&
      doc.activeElement instanceof HTMLElement &&
      doc.activeElement.matches(editableSelector)
    ) {
      doc.activeElement.blur();
    }
  };
  const endGesture = () => {
    queueMicrotask(() => {
      gestureTarget = null;
    });
  };
  const guardedFocus: HTMLElement['focus'] = function (this: HTMLElement, options) {
    if (this.matches(editableSelector) && doc.activeElement !== this && gestureTarget !== this)
      return;
    originalFocus.call(this, { ...options, preventScroll: true });
  };
  proto.focus = guardedFocus;
  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('click', endGesture, true);
  doc.addEventListener('pointercancel', endGesture, true);
  doc.addEventListener('pointerup', endGesture, true);
  return () => {
    if (proto.focus === guardedFocus) proto.focus = originalFocus;
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('click', endGesture, true);
    doc.removeEventListener('pointercancel', endGesture, true);
    doc.removeEventListener('pointerup', endGesture, true);
  };
};
