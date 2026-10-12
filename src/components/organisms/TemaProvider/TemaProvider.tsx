// src/components/organisms/TemaProvider/TemaProvider.tsx
// Envuelve la app en el ThemeProvider de React Native Elements con NUESTRO tema.
// Es el único punto de entrada de RNE para la app: las pantallas no importan `@rneui/*`.
import { ReactNode } from 'react';
import { ThemeProvider } from '@rneui/themed';
import { rneTheme } from '@theme/rneTheme';

export const TemaProvider = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={rneTheme}>{children}</ThemeProvider>
);
