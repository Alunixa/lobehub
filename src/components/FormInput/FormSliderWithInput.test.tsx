import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FormSliderWithInput from './FormSliderWithInput';

interface MockSliderWithInputProps {
  onBlur?: () => void;
  onChange: (value: number) => void;
  value: number;
}

vi.mock('@lobehub/ui', () => ({
  SliderWithInput: ({ onBlur, onChange, value }: MockSliderWithInputProps) => (
    <input
      aria-label="slider"
      value={value}
      onBlur={onBlur}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  ),
}));

describe('FormSliderWithInput', () => {
  it('should submit the latest input value when change and blur happen in the same render batch', () => {
    const onChange = vi.fn();
    render(<FormSliderWithInput value={2} onChange={onChange} />);

    const input = screen.getByLabelText('slider');
    act(() => {
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.blur(input);
    });

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('should submit an externally refreshed value', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FormSliderWithInput value={2} onChange={onChange} />);

    rerender(<FormSliderWithInput value={7} onChange={onChange} />);
    fireEvent.blur(screen.getByLabelText('slider'));

    expect(onChange).toHaveBeenCalledWith(7);
  });
});
