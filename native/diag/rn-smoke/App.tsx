import React from 'react';
import {View, Text} from 'react-native';

// RN smoke: só texto. Sem Firebase, Notifee, Firestore, Messaging, navegação, services.
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
        React Native abriu
      </Text>
    </View>
  );
}
