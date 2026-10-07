// src/navigation/Tabs.tsx
// Cuatro pestañas, cada una con su etiqueta de texto visible (UX, regla 1):
// el ícono acompaña, nunca va solo.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChartColumn, ClipboardCheck, History, House } from 'lucide-react-native';
import { colors } from '@theme';
import { InicioScreen } from '@screens/InicioScreen';
import { CerrarDiaScreen } from '@screens/CerrarDiaScreen';
import { HistorialScreen } from '@screens/HistorialScreen';
import { ResumenScreen } from '@screens/ResumenScreen';
import type { FechaNegocio } from '@dominio/tipos';

export type TabsParamList = {
  Inicio: undefined;
  /** Con `fecha`, "Cerrar mi día" edita ese día; sin ella, es un cierre nuevo. */
  CerrarDia: { fecha?: FechaNegocio } | undefined;
  Historial: undefined;
  Resumen: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

const iconoInicio = ({ color, size }: { color: string; size: number }) => (
  <House color={color} size={size} />
);
const iconoCerrarDia = ({ color, size }: { color: string; size: number }) => (
  <ClipboardCheck color={color} size={size} />
);
const iconoHistorial = ({ color, size }: { color: string; size: number }) => (
  <History color={color} size={size} />
);
const iconoResumen = ({ color, size }: { color: string; size: number }) => (
  <ChartColumn color={color} size={size} />
);

export const Tabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarLabelVisibilityMode: 'labeled',
      tabBarLabelPosition: 'below-icon',
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      // Con 4 pestañas, "Cerrar mi día" a 15 px se cortaba en "Cerrar mi…": 14 px es el mínimo
      // de la regla de UX y sin relleno lateral la etiqueta cabe entera.
      tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
      tabBarItemStyle: { minHeight: 48, paddingHorizontal: 0 },
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
    <Tab.Screen
      name="Historial"
      component={HistorialScreen}
      options={{
        tabBarLabel: 'Historial',
        tabBarIcon: iconoHistorial,
        tabBarButtonTestID: 'tab-historial',
      }}
    />
    <Tab.Screen
      name="Resumen"
      component={ResumenScreen}
      options={{
        tabBarLabel: 'Resumen',
        tabBarIcon: iconoResumen,
        tabBarButtonTestID: 'tab-resumen',
      }}
    />
  </Tab.Navigator>
);
