/**
 * Crecemos: cuadra tu día, crece tu negocio.
 *
 * @format
 */

import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { AjustesVisualesProvider } from '@context/AjustesVisualesContext';
import { RecorridoProvider } from '@context/RecorridoProvider';
import { RootStack } from '@navigation/RootStack';
import { ErrorDeCarga } from '@components/organisms/ErrorDeCarga';
import { SplashAnimado } from '@components/organisms/SplashAnimado';
import { TemaProvider } from '@components/organisms/TemaProvider';

/** El splash de la marca se va cuando la app terminó de cargar sus datos. */
const SplashDeCarga = () => {
  const { cargando } = useCrecemos();
  return <SplashAnimado listo={!cargando} />;
};

function App() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <StatusBar barStyle="dark-content" />
        <CrecemosProvider>
          <AjustesVisualesProvider>
            <ErrorDeCarga>
              <RecorridoProvider>
                <NavigationContainer>
                  <RootStack />
                </NavigationContainer>
              </RecorridoProvider>
            </ErrorDeCarga>
            <SplashDeCarga />
          </AjustesVisualesProvider>
        </CrecemosProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
}

export default App;
