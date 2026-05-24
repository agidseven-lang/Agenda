import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {login} from '../services/auth';
import {useAuth} from '../state/AuthContext';

export default function LoginScreen() {
  const {setUser} = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit() {
    if (busy) return;
    setErr('');
    setBusy(true);
    const r = await login(email, pass);
    setBusy(false);
    if (r.ok) setUser(r.user);
    else setErr(r.error);
  }

  return (
    <View style={s.wrap}>
      <Text style={s.brand}>ID Seven</Text>
      <Text style={s.sub}>Agenda e Gestor de Tarefas</Text>
      <TextInput
        style={s.input}
        placeholder="Email"
        placeholderTextColor="#7b8190"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={s.input}
        placeholder="Senha"
        placeholderTextColor="#7b8190"
        secureTextEntry
        value={pass}
        onChangeText={setPass}
      />
      {!!err && <Text style={s.err}>{err}</Text>}
      <TouchableOpacity style={s.btn} onPress={onSubmit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Entrar</Text>}
      </TouchableOpacity>
      <Text style={s.note}>Use a mesma conta do app web.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {flex: 1, backgroundColor: '#0b0c0f', padding: 24, justifyContent: 'center'},
  brand: {color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center'},
  sub: {color: '#9aa0ac', fontSize: 13, textAlign: 'center', marginBottom: 28},
  input: {
    backgroundColor: '#16181d', color: '#fff', borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#23262d',
  },
  err: {color: '#ff6b6b', fontSize: 13, marginBottom: 10},
  btn: {backgroundColor: '#5b6cff', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4},
  btnTxt: {color: '#fff', fontSize: 15, fontWeight: '700'},
  note: {color: '#7b8190', fontSize: 12, textAlign: 'center', marginTop: 16},
});
