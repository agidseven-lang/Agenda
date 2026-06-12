import React, {useEffect, useRef, useState, useCallback} from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {AppEvent, listenEvents} from '../services/firestore';
import {rescheduleAll, registerForegroundHandler, takePendingEventId} from '../services/notifications';
import {useAuth} from '../state/AuthContext';

export default function EventListScreen() {
  const nav: any = useNavigation();
  const {reminderMinutes, signOut} = useAuth();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const eventsRef = useRef<AppEvent[]>([]);

  useEffect(() => {
    const unsub = listenEvents(list => {
      eventsRef.current = list;
      setEvents(list);
      // mantém os lembretes locais em dia sempre que a agenda muda
      rescheduleAll(list, reminderMinutes).catch(() => {});
    });
    return unsub;
  }, [reminderMinutes]);

  // tap em notificação (foreground) → abre o evento
  useEffect(() => {
    const unsub = registerForegroundHandler(id => openById(id));
    // tap que abriu o app (background/quit)
    const pending = takePendingEventId();
    if (pending) setTimeout(() => openById(pending), 400);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openById = useCallback((id: string) => {
    const e = eventsRef.current.find(x => x.id === id);
    if (e) nav.navigate('EventForm', {event: e});
  }, [nav]);

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.title}>Compromissos</Text>
        <TouchableOpacity onPress={signOut}><Text style={s.logout}>Sair</Text></TouchableOpacity>
      </View>
      <FlatList
        data={events}
        keyExtractor={e => e.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor="#fff" />}
        ListEmptyComponent={<Text style={s.empty}>Nenhum compromisso.</Text>}
        renderItem={({item}) => (
          <TouchableOpacity style={s.card} onPress={() => nav.navigate('EventForm', {event: item})}>
            <Text style={s.cardTitle}>{item.title || item.client || 'Sem título'}</Text>
            <Text style={s.cardSub}>
              {(item.date || '')}{item.start ? ' · ' + item.start : ''}
              {item.owner ? ' · ' + item.owner : ''}
            </Text>
            {item.done ? <Text style={s.done}>finalizado</Text> : null}
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={s.fab} onPress={() => nav.navigate('EventForm', {})}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {flex: 1, backgroundColor: '#0b0c0f'},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, paddingTop: 22},
  title: {color: '#fff', fontSize: 22, fontWeight: '800'},
  logout: {color: '#9aa0ac', fontSize: 14},
  empty: {color: '#7b8190', textAlign: 'center', marginTop: 40},
  card: {backgroundColor: '#16181d', marginHorizontal: 16, marginVertical: 6, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#23262d'},
  cardTitle: {color: '#fff', fontSize: 15, fontWeight: '700'},
  cardSub: {color: '#9aa0ac', fontSize: 13, marginTop: 4},
  done: {color: '#4ade80', fontSize: 11, marginTop: 6},
  fab: {position: 'absolute', right: 22, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: '#5b6cff', alignItems: 'center', justifyContent: 'center', elevation: 6},
  fabTxt: {color: '#fff', fontSize: 30, marginTop: -2},
});
