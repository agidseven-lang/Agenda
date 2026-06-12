import React from 'react';
import {View, Text} from 'react-native';

// App MÍNIMO de diagnóstico: sem Firebase, Firestore, Messaging, Notifee,
// navegação, AuthContext ou imports de services. Só renderiza texto.
export default function App() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0b0c0f',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
      <Text style={{color: '#ffffff', fontSize: 22, fontWeight: '800'}}>
        ID Seven Nativo abriu
      </Text>
      <Text style={{color: '#9aa0ac', marginTop: 10, fontSize: 13}}>
        build mínimo de diagnóstico (RN puro)
      </Text>
    </View>
  );
}
