import { z } from 'zod';
import { PAYMENT_METHODS } from '@utils/budget';

export const expenseSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Ingresa un monto')
    .refine(value => Number.isFinite(Number(value)) && Number(value) > 1, {
      message: 'El monto debe ser mayor a 1',
    }),
  categoryId: z.string().min(1, 'Selecciona una categoría'),
  paymentMethod: z.enum(PAYMENT_METHODS, {
    error: 'Elige un método de pago',
  }),
  description: z.string(),
});
