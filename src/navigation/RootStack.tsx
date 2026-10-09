// src/navigation/RootStack.tsx
// Stack raíz: las pestañas y, encima, el Perfil (no es una pestaña, decisión del SPEC-02),
// "Qué me deja cada uno" y "Mi reporte" (las dos se abren desde Resumen) y "Preguntarle a mis datos"
// (el chat, desde el botón flotante de Inicio y desde Resumen).
// Cada una lleva su propio botón "Atrás" con texto: el encabezado nativo de Android
// solo mostraría la flecha, y un ícono sin etiqueta rompe la regla 1 de UX.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { PerfilScreen } from '@screens/PerfilScreen';
import { PreguntarScreen } from '@screens/PreguntarScreen';
import { MiReporteScreen } from '@screens/MiReporteScreen';
import { QueMeDejaScreen } from '@screens/QueMeDejaScreen';
import { Tabs, TabsParamList } from './Tabs';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList> | undefined;
  Perfil: undefined;
  QueMeDeja: undefined;
  MiReporte: undefined;
  Preguntar: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs" component={Tabs} />
    <Stack.Screen name="Perfil" component={PerfilScreen} />
    <Stack.Screen name="QueMeDeja" component={QueMeDejaScreen} />
    <Stack.Screen name="MiReporte" component={MiReporteScreen} />
    <Stack.Screen name="Preguntar" component={PreguntarScreen} />
  </Stack.Navigator>
);
