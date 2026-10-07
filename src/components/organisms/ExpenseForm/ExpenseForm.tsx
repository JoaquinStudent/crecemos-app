// src/components/organisms/ExpenseForm/ExpenseForm.tsx
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Minus } from 'lucide-react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Input } from '@components/atoms/Input';
import { Button } from '@components/atoms/Button';
import { AmountInput } from '@components/molecules/AmountInput';
import { ChipGroup } from '@components/molecules/ChipGroup';
import { SelectField } from '@components/molecules/SelectField';
import { NewTransaction, paymentMethodOptions } from '@utils/budget';
import { getCategoriesByType } from '@utils/categories';
import { expenseSchema } from '@validations/expense.schema';
import { Controller, useForm } from 'react-hook-form';

import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const categoryOptions = getCategoriesByType('expense').map(c => ({
  value: c.id,
  label: c.label,
  icon: c.icon,
}));

export interface ExpenseFormProps {
  onSubmit: (transaction: NewTransaction) => void;
  style?: StyleProp<ViewStyle>;
}

type TExpenseForm = z.infer<typeof expenseSchema>;
export const ExpenseForm = ({ onSubmit, style }: ExpenseFormProps) => {
  const form = useForm<TExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: '',
      categoryId: '',
      description: '',
    },
  });

  const handleOnSubmit = (data: TExpenseForm) => {
    onSubmit({ ...data, amount: Number(data.amount), type: 'expense' });
  };

  console.log('Categories for expense:', categoryOptions);

  return (
    <View style={[styles.container, style]}>
      <Text variant="h2">Nuevo egreso</Text>

      <Controller
        control={form.control}
        name="amount"
        render={({ field, fieldState }) => (
          <AmountInput
            label="Monto"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={form.control}
        name="categoryId"
        render={({ field, fieldState }) => (
          <SelectField
            label="Categoría"
            placeholder="¿En qué gastaste?"
            options={categoryOptions}
            value={field.value}
            onChange={val => field.onChange(val)}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={form.control}
        name="paymentMethod"
        render={({ field }) => (
          <ChipGroup
            label="¿Cómo pagaste?"
            options={paymentMethodOptions}
            value={field.value}
            onChange={val => field.onChange(val)}
          />
        )}
      />

      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <Input
            label="Descripción"
            helperText="Opcional"
            placeholder="Ej. Mercado de la semana"
            value={field.value}
            onChangeText={val => field.onChange(val)}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={() => handleOnSubmit}
          />
        )}
      />

      <Button
        title="Agregar egreso"
        leftIcon={Minus}
        fullWidth
        onPress={() => form.handleSubmit(handleOnSubmit)()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
});
