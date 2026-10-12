/**
 * Crecemos: cuadra tu día, crece tu negocio.
 *
 * @format
 */

import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CrecemosProvider } from '@context/CrecemosProvider';
import { RootStack } from '@navigation/RootStack';
import { ErrorDeCarga } from '@components/organisms/ErrorDeCarga';
import { TemaProvider } from '@components/organisms/TemaProvider';

function App() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <StatusBar barStyle="dark-content" />
        <CrecemosProvider>
          <ErrorDeCarga>
            <NavigationContainer>
              <RootStack />
            </NavigationContainer>
          </ErrorDeCarga>
        </CrecemosProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
}

export default App;
