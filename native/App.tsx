import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/state/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import {ensureChannel, requestNotifPermission} from './src/services/notifications';

export default function App() {
  useEffect(() => {
    (async () => {
      await requestNotifPermission();
      await ensureChannel();
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0b0c0f" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
