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
  let gestureTimer: ReturnType<typeof setTimeout> | undefined;
  let tabTimer: ReturnType<typeof setTimeout> | undefined;
  let keyboardNavigation = false;
  const onPointerDown = (event: Event) => {
    clearTimeout(gestureTimer);
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
    gestureTimer = setTimeout(() => {
      gestureTarget = null;
    }, 1000);
  };
  const clearGesture = () => {
    gestureTarget = null;
    clearTimeout(gestureTimer);
  };
  const endGesture = (event: Event) => {
    // A label's default action focuses its control after click listeners and
    // their microtasks. Keep this explicit input gesture until that action runs.
    if (
      event.type === 'click' &&
      event.target instanceof Element &&
      event.target.closest('label')?.control === gestureTarget
    ) {
      clearTimeout(gestureTimer);
      gestureTimer = setTimeout(clearGesture, 0);
      return;
    }
    queueMicrotask(() => {
      gestureTarget = null;
      clearTimeout(gestureTimer);
    });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    keyboardNavigation = true;
    clearTimeout(tabTimer);
    tabTimer = setTimeout(() => {
      keyboardNavigation = false;
    }, 0);
  };
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target;
    // Lexical can focus through Selection.addRange without calling element.focus.
    // Catch that native path as well, while retaining direct touch and Tab access.
    if (
      target instanceof HTMLElement &&
      target.matches(editableSelector) &&
      target !== gestureTarget &&
      !keyboardNavigation
    )
      target.blur();
  };
  const guardedFocus: HTMLElement['focus'] = function (this: HTMLElement, options) {
    if (
      this.matches(editableSelector) &&
      doc.activeElement !== this &&
      gestureTarget !== this &&
      !keyboardNavigation
    )
      return;
    originalFocus.call(this, { ...options, preventScroll: true });
  };
  proto.focus = guardedFocus;
  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('click', endGesture, true);
  doc.addEventListener('pointercancel', endGesture, true);
  return () => {
    clearTimeout(gestureTimer);
    clearTimeout(tabTimer);
    if (proto.focus === guardedFocus) proto.focus = originalFocus;
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('click', endGesture, true);
    doc.removeEventListener('pointercancel', endGesture, true);
  };
};
