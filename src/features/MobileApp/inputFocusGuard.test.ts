import { afterEach, describe, expect, it } from 'vitest';

import { installMobileInputFocusGuard } from './inputFocusGuard';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
});

describe('mobile input focus policy', () => {
  const setup = () => {
    document.body.innerHTML =
      '<button>Open</button><input id="search"><textarea></textarea><div contenteditable="true"><span>Write</span></div><label for="search">Search</label>';
    cleanup = installMobileInputFocusGuard();
    return {
      button: document.querySelector('button')!,
      editor: document.querySelector<HTMLDivElement>('[contenteditable]')!,
      input: document.querySelector('input')!,
      textarea: document.querySelector('textarea')!,
    };
  };
  const touch = (element: Element) =>
    element.dispatchEvent(new Event('pointerdown', { bubbles: true }));

  it('blocks mount, modal and toolbar focus but allows non-input focus', () => {
    const { input, textarea, editor, button } = setup();
    touch(button);
    for (const element of [input, textarea, editor]) {
      element.focus();
      expect(document.activeElement).not.toBe(element);
    }
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('allows directly touched inputs and editor children only', () => {
    const { input, textarea, editor } = setup();
    touch(input);
    textarea.focus();
    expect(document.activeElement).not.toBe(textarea);
    input.focus();
    expect(document.activeElement).toBe(input);
    touch(editor.firstElementChild!);
    editor.focus();
    expect(document.activeElement).toBe(editor);
  });

  it('expires a gesture and prevents asynchronous keyboard restoration', async () => {
    const { input, button } = setup();
    touch(input);
    input.focus();
    document.dispatchEvent(new Event('click'));
    await Promise.resolve();
    button.focus();
    input.focus();
    expect(document.activeElement).toBe(button);
  });

  it('allows a directly clicked associated label', () => {
    const { input } = setup();
    touch(document.querySelector('label')!);
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('dismisses input focus when tapping outside and prevents toolbar restoration', () => {
    const { input, button } = setup();
    touch(input);
    input.focus();
    touch(button);
    expect(document.activeElement).not.toBe(input);
    input.focus();
    expect(document.activeElement).not.toBe(input);
  });

  it('restores desktop focus behavior when disposed', () => {
    const { input } = setup();
    cleanup?.();
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('blocks native selection focus that bypasses HTMLElement.focus', () => {
    const nativeFocus = HTMLElement.prototype.focus;
    const { editor } = setup();
    nativeFocus.call(editor);
    expect(document.activeElement).not.toBe(editor);
    touch(editor);
    nativeFocus.call(editor);
    expect(document.activeElement).toBe(editor);
  });

  it('retains external keyboard Tab navigation', () => {
    const { input } = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});
