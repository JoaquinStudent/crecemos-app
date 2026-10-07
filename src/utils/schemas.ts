// src/utils/schemas.ts
import { z } from 'zod';
import { PAYMENT_METHODS, PaymentMethod, parseAmount } from './budget';

export const transactionBaseSchema = z.object({
  amount: z
    .string()
    .transform(parseAmount)
    .refine(value => value > 0, { message: 'Ingresa un monto mayor a 0' }),
  categoryId: z.string().min(1, { message: 'Elige una categoría' }),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'Elige un método de pago' }),
  description: z.string().trim().max(60, { message: 'Máximo 60 caracteres' }),
});

// Cada formulario tiene su propio esquema para que las validaciones crezcan por separado
export const expenseSchema = transactionBaseSchema;
export const incomeSchema = transactionBaseSchema;

/** Lo que devuelve Zod si todo es válido (el monto ya viene como número) */
export type TransactionFormData = z.output<typeof transactionBaseSchema>;

/** Lo que guarda el formulario mientras el usuario escribe (todo como texto) */
export type TransactionFormValues = {
  amount: string;
  categoryId: string;
  paymentMethod: PaymentMethod | '';
  description: string;
};
