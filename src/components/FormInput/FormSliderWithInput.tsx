import { type SliderWithInputProps } from '@lobehub/ui';
import { SliderWithInput } from '@lobehub/ui';
import { memo, useEffect, useRef, useState } from 'react';

interface FormSliderWithInputProps extends Omit<SliderWithInputProps, 'onChange' | 'value'> {
  onChange?: (value: number) => void;
  value?: number;
}

/**
 * Form-integrated slider with delayed onChange behavior.
 * Only triggers onChange on blur to prevent excessive updates during user interaction.
 */
const FormSliderWithInput = memo<FormSliderWithInputProps>(
  ({ onChange, value: defaultValue, ...props }) => {
    const initialValue = defaultValue ?? 0;
    const [value, setValue] = useState(initialValue);
    const valueRef = useRef(initialValue);

    useEffect(() => {
      const nextValue = defaultValue ?? 0;
      valueRef.current = nextValue;
      setValue(nextValue);
    }, [defaultValue]);

    return (
      <SliderWithInput
        onBlur={() => {
          onChange?.(valueRef.current);
        }}
        onChange={(newValue) => {
          if (typeof newValue === 'number') {
            valueRef.current = newValue;
            setValue(newValue);
          }
        }}
        {...props}
        value={value}
      />
    );
  },
);

FormSliderWithInput.displayName = 'FormSliderWithInput';

export default FormSliderWithInput;
