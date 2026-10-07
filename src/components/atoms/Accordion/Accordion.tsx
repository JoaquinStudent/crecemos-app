// src/components/atoms/Accordion/Accordion.tsx
import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Icon } from '@components/atoms/Icon';

export interface AccordionProps {
  /** Lo que se ve siempre, en la fila superior */
  header: React.ReactNode;
  /** Lo que se muestra al abrir */
  children: React.ReactNode;
  /** Controlado: el padre decide si está abierto */
  expanded?: boolean;
  /** No controlado: estado inicial si el padre no lo maneja */
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const Accordion = ({
  header,
  children,
  expanded,
  defaultExpanded = false,
  onToggle,
  disabled = false,
  accessibilityLabel,
  style,
}: AccordionProps) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  const isControlled = expanded !== undefined;
  const isExpanded = isControlled ? expanded : internalExpanded;

  const toggle = () => {
    const next = !isExpanded;
    if (!isControlled) setInternalExpanded(next);
    onToggle?.(next);
  };

  return (
    <View style={[styles.container, style]}>
      <Pressable
        onPress={toggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: isExpanded, disabled }}
        style={({ pressed }) => [
          styles.header,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.headerContent}>{header}</View>
        <Icon
          icon={isExpanded ? ChevronUp : ChevronDown}
          color={disabled ? 'disabled' : 'textMuted'}
        />
      </Pressable>

      {isExpanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pressed: { backgroundColor: colors.surface },
  disabled: { backgroundColor: colors.disabledSoft },
  content: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
