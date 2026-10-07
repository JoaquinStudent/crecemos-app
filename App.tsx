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

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <CrecemosProvider>
        <NavigationContainer>
          <RootStack />
        </NavigationContainer>
      </CrecemosProvider>
    </SafeAreaProvider>
  );
}

export default App;
