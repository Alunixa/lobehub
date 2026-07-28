import { DropdownMenuRoot, DropdownMenuTrigger } from '@lobehub/ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { preventMobileDropdownMouseDown, shouldUseExplicitMobileOverlayClick } from './actionUtils';

afterEach(cleanup);

const MobileDropdownHarness = ({ onOpenChange }: { onOpenChange: (open: boolean) => void }) => {
  const [open, setOpen] = useState(false);

  return createElement(
    DropdownMenuRoot,
    {
      onOpenChange: (nextOpen) => {
        onOpenChange(nextOpen);
        setOpen(nextOpen);
      },
      open,
    },
    createElement(
      DropdownMenuTrigger,
      {
        nativeButton: false,
        onMouseDown: (event) => preventMobileDropdownMouseDown(event, true),
      },
      createElement('div', {
        'aria-label': 'mobile action menu',
        'onClick': () => setOpen(!open),
        'role': 'button',
        'tabIndex': 0,
      }),
    ),
    createElement('output', { 'data-testid': 'open-state' }, String(open)),
  );
};

const tapTrigger = async (trigger: HTMLElement) => {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'touch' });
  fireEvent.mouseDown(trigger, { button: 0 });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 32));
  });
  fireEvent.mouseUp(trigger, { button: 0 });
  fireEvent.click(trigger, { button: 0 });
};

describe('shouldUseExplicitMobileOverlayClick', () => {
  it('handles overlay clicks explicitly on mobile', () => {
    expect(shouldUseExplicitMobileOverlayClick(true, true)).toBe(true);
  });

  it('lets the overlay trigger own clicks on desktop', () => {
    expect(shouldUseExplicitMobileOverlayClick(true, false)).toBe(false);
  });

  it('does not intercept actions without an overlay', () => {
    expect(shouldUseExplicitMobileOverlayClick(false, true)).toBe(false);
  });

  it('keeps a controlled mobile dropdown open after the real pointer and mouse event chain', async () => {
    const onOpenChange = vi.fn();
    render(createElement(MobileDropdownHarness, { onOpenChange }));

    const trigger = screen.getByRole('button', { name: 'mobile action menu' });

    await tapTrigger(trigger);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('open-state')).toHaveTextContent('true');

    await tapTrigger(trigger);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('open-state')).toHaveTextContent('false');
  });
});
