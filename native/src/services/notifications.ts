/**
 * Notificações LOCAIS exatas com Notifee (AlarmManager por baixo).
 * Primário no aparelho; o Worker/FCM continua como BACKUP.
 * Anti-duplicidade: quando a notificação local dispara, marcamos events/{id}.reminderSentAt
 * (o Worker já pula quando esse campo existe — dedup que já vive no backend).
 */
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  EventType,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';
import {AppEvent} from './firestore';

const CHANNEL_ID = 'reminders';
const TYPE_LABELS: Record<string, string> = {
  gravacao: 'Gravação',
  reuniao: 'Reunião',
  trafego: 'Tráfego',
  revisao: 'Revisão',
  entrega: 'Entrega',
  foto: 'Foto',
  outro: 'Compromisso',
};

// eventId pendente (quando o usuário toca a notificação com app fechado/background)
let _pendingEventId: string | null = null;
export function setPendingEventId(id: string) {
  _pendingEventId = id;
}
export function takePendingEventId(): string | null {
  const id = _pendingEventId;
  _pendingEventId = null;
  return id;
}

export async function requestNotifPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission(); // dispara POST_NOTIFICATIONS no Android 13+
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Lembretes de compromisso',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

/** Início do compromisso em ms (horário local do aparelho), igual ao web. */
export function eventStartMs(e: AppEvent): number {
  if (!e.date) return 0;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date);
  if (!dm) return 0;
  let hh = 0;
  let mm = 0;
  if (e.start) {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(e.start);
    if (tm) {
      hh = +tm[1];
      mm = +tm[2];
    }
  }
  return new Date(+dm[1], +dm[2] - 1, +dm[3], hh, mm, 0, 0).getTime();
}

function notifId(eventId: string): string {
  return 'reminder-' + eventId;
}

/** Agenda (ou reagenda) o lembrete local exato. Cancela o anterior antes. */
export async function scheduleEventReminder(
  e: AppEvent,
  reminderMinutes: number,
): Promise<void> {
  await cancelEventReminder(e.id);
  if (!e || e.done) return;
  const startMs = eventStartMs(e);
  if (!startMs) return;
  const reminderAt = startMs - (reminderMinutes || 60) * 60000;
  // Sem retroativo: só agenda se ainda está no futuro.
  if (reminderAt <= Date.now()) return;

  const typ = TYPE_LABELS[e.type || 'outro'] || 'Compromisso';
  const parts: string[] = [];
  if (e.client) parts.push('Cliente: ' + e.client);
  const hor = e.start ? (e.end ? `${e.start}–${e.end}` : e.start) : '';
  if (hor) parts.push(hor);
  if (e.owner) parts.push('Responsável: ' + e.owner);
  if (e.location) parts.push(e.location);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: reminderAt,
    alarmManager: {allowWhileIdle: true}, // exato mesmo em Doze (requer SCHEDULE_EXACT_ALARM)
  };

  await notifee.createTriggerNotification(
    {
      id: notifId(e.id),
      title: `⏰ ${typ} em ${reminderMinutes || 60} min`,
      body: parts.join(' • ') || e.title || 'Compromisso',
      data: {eventId: e.id},
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_launcher',
        pressAction: {id: 'default'},
        importance: AndroidImportance.HIGH,
      },
    },
    trigger,
  );
}

export async function cancelEventReminder(eventId: string): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(notifId(eventId));
  } catch {}
}

/** Reagenda todos (uso no boot/refresh). Notifee persiste triggers, mas reforçamos. */
export async function rescheduleAll(
  events: AppEvent[],
  reminderMinutes: number,
): Promise<void> {
  for (const e of events) {
    if (e.done) {
      await cancelEventReminder(e.id);
    } else {
      await scheduleEventReminder(e, reminderMinutes);
    }
  }
}

/** Quando a notificação local dispara, marca reminderSentAt p/ o Worker não duplicar. */
export function registerForegroundHandler(onOpenEvent: (id: string) => void) {
  return notifee.onForegroundEvent(async ({type, detail}) => {
    const id = detail.notification?.data?.eventId
      ? String(detail.notification.data.eventId)
      : null;
    if (type === EventType.DELIVERED && id) {
      try {
        await firestore()
          .collection('events')
          .doc(id)
          .update({reminderSentAt: Date.now()});
      } catch {}
    }
    if (type === EventType.PRESS && id) {
      onOpenEvent(id);
    }
  });
}
