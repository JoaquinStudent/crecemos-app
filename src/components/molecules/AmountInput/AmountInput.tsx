// src/components/molecules/AmountInput/AmountInput.tsx
import React, { forwardRef } from 'react';
import { Input, InputProps, InputRef } from '@components/atoms/Input';
import { sanitizeAmount } from '@dominio/formato';

export interface AmountInputProps
  extends Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType' | 'prefix'> {
  value: string;
  onChangeText: (value: string) => void;
}

export const AmountInput = forwardRef<InputRef, AmountInputProps>(
  ({ value, onChangeText, ...rest }, ref) => (
    <Input
      ref={ref}
      prefix="S/"
      value={value}
      onChangeText={text => onChangeText(sanitizeAmount(text))}
      keyboardType="decimal-pad"
      placeholder="0.00"
      {...rest}
    />
  ),
);

AmountInput.displayName = 'AmountInput';
