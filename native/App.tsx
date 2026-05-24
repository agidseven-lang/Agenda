import React, {useEffect} from 'react';
import {StatusBar, View, Text, ScrollView} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/state/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import {ensureChannel, requestNotifPermission} from './src/services/notifications';

// Captura erros de render JS e mostra na tela (em vez de fechar o app sem explicação).
class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  {error: Error | null}
> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[ID Seven] erro de runtime:', error);
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{flex: 1, backgroundColor: '#0b0c0f'}} contentContainerStyle={{padding: 24, paddingTop: 60}}>
          <Text style={{color: '#ff6b6b', fontSize: 18, fontWeight: '800', marginBottom: 12}}>
            Erro ao iniciar o app
          </Text>
          <Text style={{color: '#fff', fontSize: 13, marginBottom: 8}}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
          <Text selectable style={{color: '#9aa0ac', fontSize: 11}}>
            {String((this.state.error as any)?.stack || '')}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        await requestNotifPermission();
        await ensureChannel();
      } catch (e) {
        // não derruba o app por causa de permissão/canal
        // eslint-disable-next-line no-console
        console.warn('[ID Seven] notif init:', e);
      }
    })();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0b0c0f" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
