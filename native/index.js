/**
 * Entry point do app nativo ID Seven (React Native).
 * Registra o handler de notificação em background do Notifee ANTES do app montar.
 */
import {AppRegistry} from 'react-native';
import notifee, {EventType} from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';
import {setPendingEventId} from './src/services/notifications';

// Toque na notificação com o app em background/fechado → guarda o eventId p/ abrir depois.
notifee.onBackgroundEvent(async ({type, detail}) => {
  if (type === EventType.PRESS && detail.notification?.data?.eventId) {
    setPendingEventId(String(detail.notification.data.eventId));
  }
});

AppRegistry.registerComponent(appName, () => App);
