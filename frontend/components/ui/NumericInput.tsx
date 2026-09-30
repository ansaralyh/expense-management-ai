'use client';

import { InputHTMLAttributes } from 'react';
import { normalizeNumericInput } from '../../lib/numeric-input';

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'inputMode'> & {
  value: string | number;
  onValueChange: (value: string) => void;
  integerOnly?: boolean;
};

export default function NumericInput({
  value,
  onValueChange,
  integerOnly = false,
  className,
  ...props
}: NumericInputProps) {
  const displayValue = value === '' ? '' : String(value);

  return (
    <input
      {...props}
      type="text"
      inputMode={integerOnly ? 'numeric' : 'decimal'}
      value={displayValue}
      onChange={(event) => onValueChange(normalizeNumericInput(event.target.value, { integerOnly }))}
      className={className}
    />
  );
}
