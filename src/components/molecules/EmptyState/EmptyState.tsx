// src/components/molecules/EmptyState/EmptyState.tsx
// Estado vacío que enseña (UX): una frase que explica qué va a aparecer y un botón para lograrlo.
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Card } from '@components/molecules/Card';

export interface EmptyStateProps {
  title: string;
  text?: string;
  /** Si se pasan `actionLabel` y `onAction`, se dibuja el botón principal. */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  actionTestID?: string;
}

export const EmptyState = ({
  title,
  text,
  actionLabel,
  onAction,
  style,
  testID,
  actionTestID,
}: EmptyStateProps) => (
  <Card variant="bordered" style={[styles.tarjeta, style]} testID={testID}>
    <Text variant="h3" accessibilityRole="header">
      {title}
    </Text>
    {text ? <Text color="textMuted">{text}</Text> : null}
    {actionLabel && onAction ? (
      <Button
        title={actionLabel}
        size="lg"
        fullWidth
        onPress={onAction}
        testID={actionTestID}
        style={styles.accion}
      />
    ) : null}
  </Card>
);

const styles = StyleSheet.create({
  tarjeta: { gap: spacing.sm },
  accion: { marginTop: spacing.sm },
});
