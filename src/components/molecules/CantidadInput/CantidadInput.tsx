// src/components/molecules/CantidadInput/CantidadInput.tsx
// Como AmountInput, pero para porciones enteras: solo dígitos y sin prefijo S/.
import React, { forwardRef } from 'react';
import { Input, InputProps, InputRef } from '@components/atoms/Input';

export interface CantidadInputProps
  extends Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType' | 'prefix'> {
  value: string;
  onChangeText: (value: string) => void;
}

export const CantidadInput = forwardRef<InputRef, CantidadInputProps>(
  ({ value, onChangeText, ...rest }, ref) => (
    <Input
      ref={ref}
      value={value}
      onChangeText={text => onChangeText(text.replace(/\D/g, ''))}
      keyboardType="number-pad"
      placeholder="0"
      {...rest}
    />
  ),
);

CantidadInput.displayName = 'CantidadInput';
