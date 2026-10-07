// src/hooks/useTransactionForm.ts
import { useState } from 'react';
import { NewTransaction, parseAmount, PaymentMethod } from '@utils/budget';

/** Lo que guarda el formulario mientras el usuario escribe */
export type TransactionFormValues = {
  amount: string;
  categoryId: string;
  paymentMethod: PaymentMethod | '';
  description: string;
};

/** Lo que entrega el formulario al enviar (el tipo lo agrega cada form) */
export type TransactionFormData = Omit<NewTransaction, 'type'>;

const initialValues: TransactionFormValues = {
  amount: '',
  categoryId: '',
  paymentMethod: '',
  description: '',
};

export const useTransactionForm = (onSubmit: (data: TransactionFormData) => void) => {
  const [values, setValues] = useState<TransactionFormValues>(initialValues);

  const update = <K extends keyof TransactionFormValues>(
    key: K,
    value: TransactionFormValues[K],
  ) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const reset = () => setValues(initialValues);

  const handleSubmit = () => {
    // TODO (Zod): validar `values` aquí y cortar si hay errores.
    // Cuando esté la validación, el `as PaymentMethod` de abajo ya no hace falta.
    onSubmit({
      amount: parseAmount(values.amount),
      categoryId: values.categoryId,
      paymentMethod: values.paymentMethod as PaymentMethod,
      description: values.description.trim(),
    });
    reset();
  };

  return { values, update, handleSubmit, reset };
};
