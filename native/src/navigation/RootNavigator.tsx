import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../state/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import EventListScreen from '../screens/EventListScreen';
import EventFormScreen from '../screens/EventFormScreen';

const Stack = createNativeStackNavigator();

const theme = {
  ...DefaultTheme,
  colors: {...DefaultTheme.colors, background: '#0b0c0f', card: '#0b0c0f', text: '#fff', border: '#23262d', primary: '#5b6cff'},
};

export default function RootNavigator() {
  const {user, loading} = useAuth();
  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: '#0b0c0f', alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator color="#5b6cff" />
      </View>
    );
  }
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{headerStyle: {backgroundColor: '#0b0c0f'}, headerTintColor: '#fff'}}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} />
        ) : (
          <>
            <Stack.Screen name="EventList" component={EventListScreen} options={{headerShown: false}} />
            <Stack.Screen name="EventForm" component={EventFormScreen} options={{title: 'Compromisso'}} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
