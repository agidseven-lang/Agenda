/**
 * Entry point do app nativo ID Seven (React Native).
 * Registra o handler de notificação em background do Notifee ANTES do app montar.
 * Tudo protegido: nada aqui pode derrubar o boot do app.
 */
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Registro do handler de background do Notifee — isolado em try/catch e import dinâmico,
// para que um problema no módulo nativo NÃO impeça o app de abrir na tela de login.
try {
  const notifee = require('@notifee/react-native').default;
  const {EventType} = require('@notifee/react-native');
  const {setPendingEventId} = require('./src/services/notifications');
  notifee.onBackgroundEvent(async ({type, detail}) => {
    try {
      if (type === EventType.PRESS && detail.notification?.data?.eventId) {
        setPendingEventId(String(detail.notification.data.eventId));
      }
    } catch (_) {}
  });
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[ID Seven] Notifee background indisponível no boot:', e);
}

AppRegistry.registerComponent(appName, () => App);
