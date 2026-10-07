// src/navigation/Tabs.tsx
// Dos pestañas, cada una con su etiqueta de texto visible (UX, regla 1):
// el ícono acompaña, nunca va solo.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardCheck, House } from 'lucide-react-native';
import { colors, typography } from '@theme';
import { InicioScreen } from '@screens/InicioScreen';
import { CerrarDiaScreen } from '@screens/CerrarDiaScreen';

export type TabsParamList = {
  Inicio: undefined;
  CerrarDia: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

const iconoInicio = ({ color, size }: { color: string; size: number }) => (
  <House color={color} size={size} />
);
const iconoCerrarDia = ({ color, size }: { color: string; size: number }) => (
  <ClipboardCheck color={color} size={size} />
);

export const Tabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarLabelVisibilityMode: 'labeled',
      tabBarLabelPosition: 'below-icon',
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: typography.label.fontSize, fontWeight: '600' },
      tabBarItemStyle: { minHeight: 48 },
    }}
  >
    <Tab.Screen
      name="Inicio"
      component={InicioScreen}
      options={{ tabBarLabel: 'Inicio', tabBarIcon: iconoInicio, tabBarButtonTestID: 'tab-inicio' }}
    />
    <Tab.Screen
      name="CerrarDia"
      component={CerrarDiaScreen}
      options={{
        tabBarLabel: 'Cerrar mi día',
        tabBarIcon: iconoCerrarDia,
        tabBarButtonTestID: 'tab-cerrar-dia',
      }}
    />
  </Tab.Navigator>
);
