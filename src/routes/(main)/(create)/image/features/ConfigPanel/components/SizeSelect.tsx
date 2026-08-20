import { memo } from 'react';

import { useGenerationConfigParam } from '@/store/image/slices/generationConfig/hooks';

import Select from './Select';

const SizeSelect = memo(() => {
  const { value, setValue, enumValues, allowCustom, min, max, step } =
    useGenerationConfigParam('size');
  const options = enumValues!.map((size) => ({
    label: size,
    value: size,
  }));

  return (
    <Select
      allowCustom={allowCustom}
      max={max}
      min={min}
      options={options}
      step={step}
      value={value}
      onChange={setValue}
    />
  );
});

export default SizeSelect;
