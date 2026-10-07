// src/components/organisms/IncomeForm/IncomeForm.tsx
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Input } from '@components/atoms/Input';
import { Button } from '@components/atoms/Button';
import { AmountInput } from '@components/molecules/AmountInput';
import { ChipGroup } from '@components/molecules/ChipGroup';
import { SelectField } from '@components/molecules/SelectField';
import { useTransactionForm } from '@hooks/useTransactionForm';
import { NewTransaction, paymentMethodOptions } from '@utils/budget';
import { getCategoriesByType } from '@utils/categories';

const categoryOptions = getCategoriesByType('income').map(c => ({
  value: c.id,
  label: c.label,
  icon: c.icon,
}));

export interface IncomeFormProps {
  onSubmit: (transaction: NewTransaction) => void;
  style?: StyleProp<ViewStyle>;
}

export const IncomeForm = ({ onSubmit, style }: IncomeFormProps) => {
  const { values, update, handleSubmit } = useTransactionForm(data =>
    onSubmit({ ...data, type: 'income' }),
  );

  return (
    <View style={[styles.container, style]}>
      <Text variant="h2">Nuevo ingreso</Text>

      <AmountInput label="Monto" value={values.amount} onChangeText={v => update('amount', v)} />

      <SelectField
        label="Categoría"
        placeholder="¿De dónde viene?"
        options={categoryOptions}
        value={values.categoryId}
        onChange={v => update('categoryId', v)}
      />

      <ChipGroup
        label="¿Cómo te pagaron?"
        options={paymentMethodOptions}
        value={values.paymentMethod}
        onChange={v => update('paymentMethod', v)}
      />

      <Input
        label="Descripción"
        helperText="Opcional"
        placeholder="Ej. Pago de septiembre"
        value={values.description}
        onChangeText={v => update('description', v)}
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />

      <Button title="Agregar ingreso" leftIcon={Plus} fullWidth onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
});
