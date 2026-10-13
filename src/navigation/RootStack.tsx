// src/navigation/RootStack.tsx
// Stack raíz: las pestañas y, encima, "Cerrar mi día" (modal), el Perfil (no es una pestaña,
// decisión del SPEC-02), "Qué me deja cada uno" y "Mi reporte" (las dos se abren desde Resumen).
// El chat ("Asistente") ya es una pestaña. Cada pantalla de aquí lleva su propio botón "Atrás"
// con texto (ScreenHeader): el encabezado nativo de Android solo mostraría la flecha, y un ícono
// sin etiqueta rompe la regla 1 de UX.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { PerfilScreen } from '@screens/PerfilScreen';
import { PerfilDatosScreen } from '@screens/PerfilDatosScreen';
import { PerfilPagosScreen } from '@screens/PerfilPagosScreen';
import { PerfilProductosScreen } from '@screens/PerfilProductosScreen';
import { PerfilRecordatorioScreen } from '@screens/PerfilRecordatorioScreen';
import { CerrarDiaScreen } from '@screens/CerrarDiaScreen';
import { MiMetaScreen } from '@screens/MiMetaScreen';
import { MiReporteScreen } from '@screens/MiReporteScreen';
import { QueMeDejaScreen } from '@screens/QueMeDejaScreen';
import type { FechaNegocio } from '@dominio/tipos';
import { Tabs, TabsParamList } from './Tabs';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList> | undefined;
  /** Con `fecha`, "Cerrar mi día" edita ese día; sin ella, es un cierre nuevo (o el de hoy). */
  CerrarDia: { fecha?: FechaNegocio } | undefined;
  Perfil: undefined;
  /** Las pantallas que se abren desde las opciones del Perfil; "Atrás" vuelve a él. */
  PerfilDatos: undefined;
  PerfilPagos: undefined;
  PerfilRecordatorio: undefined;
  PerfilProductos: undefined;
  QueMeDeja: undefined;
  MiReporte: undefined;
  /** La alcancía de la cuota del préstamo. */
  MiMeta: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs" component={Tabs} />
    <Stack.Screen name="CerrarDia" component={CerrarDiaScreen} options={{ presentation: 'modal' }} />
    <Stack.Screen name="Perfil" component={PerfilScreen} />
    <Stack.Screen name="PerfilDatos" component={PerfilDatosScreen} />
    <Stack.Screen name="PerfilPagos" component={PerfilPagosScreen} />
    <Stack.Screen name="PerfilRecordatorio" component={PerfilRecordatorioScreen} />
    <Stack.Screen name="PerfilProductos" component={PerfilProductosScreen} />
    <Stack.Screen name="QueMeDeja" component={QueMeDejaScreen} />
    <Stack.Screen name="MiReporte" component={MiReporteScreen} />
    <Stack.Screen name="MiMeta" component={MiMetaScreen} />
  </Stack.Navigator>
);
