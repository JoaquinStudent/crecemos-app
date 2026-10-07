// src/screens/BudgetScreen/BudgetScreen.tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@theme';
import { TransactionTypeSelector } from '@components/molecules/TransactionTypeSelector';
import { ExpenseForm } from '@components/organisms/ExpenseForm';
import { IncomeForm } from '@components/organisms/IncomeForm';
import { NewTransaction, TransactionType } from '@utils/budget';

export const BudgetScreen = () => {
  const [type, setType] = useState<TransactionType>('expense');
  const insets = useSafeAreaInsets();

  const handleSubmit = (data: NewTransaction) => {
    console.log('Movimiento enviado:', data);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <TransactionTypeSelector value={type} onChange={setType} />

        {type === 'expense' ? (
          <ExpenseForm onSubmit={handleSubmit} />
        ) : (
          <IncomeForm onSubmit={handleSubmit} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
});
