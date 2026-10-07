// src/utils/budget.ts
export type TransactionType = 'income' | 'expense';

export const PAYMENT_METHODS = ['yape', 'plin', 'transfer', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia',
  cash: 'Efectivo',
};

export const paymentMethodOptions = PAYMENT_METHODS.map(value => ({
  value,
  label: paymentMethodLabels[value],
}));

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  description: string;
  date: string;
}

export type NewTransaction = Omit<Transaction, 'id' | 'date'>;

const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

export const formatCurrency = (value: number): string => formatter.format(value);

export const sanitizeAmount = (text: string): string => {
  const normalized = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [integer, ...decimals] = normalized.split('.');
  if (decimals.length === 0) return integer;
  return `${integer}.${decimals.join('').slice(0, 2)}`;
};

export const parseAmount = (text: string): number => {
  const value = parseFloat(text);
  return Number.isFinite(value) ? value : 0;
};
