// src/utils/categories.ts
import {
  Briefcase,
  Bus,
  Ellipsis,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  Lightbulb,
  LucideIcon,
  Popcorn,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import type { TransactionType } from './budget';

export interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
  type: TransactionType;
}

export const categories: Category[] = [
  // Egresos
  { id: 'food', label: 'Comida', icon: UtensilsCrossed, type: 'expense' },
  { id: 'transport', label: 'Transporte', icon: Bus, type: 'expense' },
  { id: 'housing', label: 'Vivienda', icon: House, type: 'expense' },
  { id: 'utilities', label: 'Servicios', icon: Lightbulb, type: 'expense' },
  { id: 'health', label: 'Salud', icon: HeartPulse, type: 'expense' },
  { id: 'education', label: 'Educación', icon: GraduationCap, type: 'expense' },
  { id: 'entertainment', label: 'Entretenimiento', icon: Popcorn, type: 'expense' },
  { id: 'other-expense', label: 'Otros', icon: Ellipsis, type: 'expense' },

  // Ingresos
  { id: 'salary', label: 'Sueldo', icon: Briefcase, type: 'income' },
  { id: 'freelance', label: 'Freelance', icon: Laptop, type: 'income' },
  { id: 'sales', label: 'Ventas', icon: Store, type: 'income' },
  { id: 'gifts', label: 'Regalos', icon: Gift, type: 'income' },
  { id: 'other-income', label: 'Otros', icon: Ellipsis, type: 'income' },
];

export const getCategoriesByType = (type: TransactionType): Category[] =>
  categories.filter(c => c.type === type);

export const getCategory = (id: string): Category | undefined => categories.find(c => c.id === id);
