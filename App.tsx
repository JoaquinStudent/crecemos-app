/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { BudgetScreen } from '@screens/BudgetScreen';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <BudgetScreen />
    </SafeAreaProvider>
  );
}

export default App;
