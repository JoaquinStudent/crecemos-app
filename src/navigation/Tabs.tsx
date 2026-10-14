// src/navigation/Tabs.tsx
// Cuatro pestañas (Inicio · Historial · Resumen · Asistente) con la barra propia
// `BarraNavegacion`, que pone "Cerrar día" al centro. "Cerrar día" no es una pestaña: es un
// modal del stack raíz (RootStack). Cada etiqueta de texto visible vive en la barra (UX, regla 1).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BarraNavegacion } from '@components/organisms/BarraNavegacion';
import { BarraOcultaProvider } from '@context/BarraOcultaContext';
import { InicioScreen } from '@screens/InicioScreen';
import { HistorialScreen } from '@screens/HistorialScreen';
import { ResumenScreen } from '@screens/ResumenScreen';
import { PreguntarScreen } from '@screens/PreguntarScreen';

export type TabsParamList = {
  Inicio: undefined;
  Historial: undefined;
  Resumen: undefined;
  /** Con `pregunta`, el chat la hace al abrirse (la usan los botones "¿Por qué?"). */
  Asistente: { pregunta?: string } | undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

const barra = (props: React.ComponentProps<typeof BarraNavegacion>) => (
  <BarraNavegacion {...props} />
);

export const Tabs = () => (
  <BarraOcultaProvider>
    <Tab.Navigator tabBar={barra} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Inicio" component={InicioScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Historial" component={HistorialScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Resumen" component={ResumenScreen} options={{ title: 'Resumen' }} />
      <Tab.Screen name="Asistente" component={PreguntarScreen} options={{ title: 'Asistente' }} />
    </Tab.Navigator>
  </BarraOcultaProvider>
);
