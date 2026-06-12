import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {AppEvent, createEvent, updateEvent, deleteEvent} from '../services/firestore';
import {scheduleEventReminder, cancelEventReminder} from '../services/notifications';
import {useAuth} from '../state/AuthContext';

export default function EventFormScreen() {
  const nav: any = useNavigation();
  const route: any = useRoute();
  const {user, reminderMinutes} = useAuth();
  const existing: AppEvent | undefined = route.params?.event;

  const [client, setClient] = useState(existing?.client || '');
  const [title, setTitle] = useState(existing?.title || '');
  const [date, setDate] = useState(existing?.date || '');
  const [start, setStart] = useState(existing?.start || '');
  const [end, setEnd] = useState(existing?.end || '');
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (busy) return;
    if (!client.trim()) return Alert.alert('Informe o cliente/empresa.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Data no formato YYYY-MM-DD.');
    setBusy(true);
    const data: Omit<AppEvent, 'id'> = {
      type: existing?.type || 'gravacao',
      client: client.trim(),
      title: title.trim(),
      date,
      start,
      end,
      owner: existing?.owner || user?.name || '',
      ownerId: existing?.ownerId || user?.id || null,
      by: user?.id,
    };
    try {
      let id: string;
      if (existing?.id) {
        id = existing.id;
        await updateEvent(id, data);
      } else {
        id = await createEvent(data);
      }
      // agenda/reagenda o lembrete LOCAL exato
      await scheduleEventReminder({id, ...data} as AppEvent, reminderMinutes);
      setBusy(false);
      nav.goBack();
    } catch (e: any) {
      setBusy(false);
      Alert.alert('Erro ao salvar', String(e?.message || e));
    }
  }

  async function onFinish() {
    if (!existing?.id) return;
    setBusy(true);
    try {
      await updateEvent(existing.id, {done: true});
      await cancelEventReminder(existing.id);
      setBusy(false);
      nav.goBack();
    } catch {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!existing?.id) return;
    Alert.alert('Excluir', 'Excluir este compromisso?', [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await cancelEventReminder(existing.id);
          await deleteEvent(existing.id);
          nav.goBack();
        },
      },
    ]);
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{padding: 18}}>
      <Text style={s.h}>{existing ? 'Editar compromisso' : 'Novo compromisso'}</Text>
      <Field label="Cliente / Empresa" value={client} onChangeText={setClient} />
      <Field label="Título" value={title} onChangeText={setTitle} />
      <Field label="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-05-24" />
      <Field label="Início (HH:MM)" value={start} onChangeText={setStart} placeholder="15:00" />
      <Field label="Fim (HH:MM)" value={end} onChangeText={setEnd} placeholder="16:00" />

      <TouchableOpacity style={s.btn} onPress={onSave} disabled={busy}>
        <Text style={s.btnTxt}>{existing ? 'Salvar' : 'Criar'}</Text>
      </TouchableOpacity>

      {existing && !existing.done ? (
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onFinish} disabled={busy}>
          <Text style={s.btnGhostTxt}>Finalizar</Text>
        </TouchableOpacity>
      ) : null}
      {existing ? (
        <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={onDelete} disabled={busy}>
          <Text style={s.btnTxt}>Excluir</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={s.note}>O lembrete local toca {reminderMinutes} min antes do início.</Text>
    </ScrollView>
  );
}

function Field(props: any) {
  return (
    <View style={{marginBottom: 12}}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        style={s.input}
        placeholderTextColor="#7b8190"
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {flex: 1, backgroundColor: '#0b0c0f'},
  h: {color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16},
  label: {color: '#9aa0ac', fontSize: 12, marginBottom: 6},
  input: {backgroundColor: '#16181d', color: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#23262d'},
  btn: {backgroundColor: '#5b6cff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10},
  btnTxt: {color: '#fff', fontSize: 15, fontWeight: '700'},
  btnGhost: {backgroundColor: '#16181d', borderWidth: 1, borderColor: '#23262d'},
  btnGhostTxt: {color: '#fff', fontSize: 15, fontWeight: '700'},
  btnDanger: {backgroundColor: '#7a1f1f'},
  note: {color: '#7b8190', fontSize: 12, textAlign: 'center', marginTop: 18},
});
