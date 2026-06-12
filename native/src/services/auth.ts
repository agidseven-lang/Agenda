/**
 * Login NATIVO compatível com o web (auth custom, sem Firebase Auth).
 * Busca o usuário por email em `users` e verifica a senha pelo mesmo hash do web.
 */
import {findUserByEmail, AppUser} from './firestore';
import {verifyPw} from './crypto';
import {setSessionUid, clearSession} from './session';

export type LoginResult =
  | {ok: true; user: AppUser}
  | {ok: false; error: string};

export async function login(email: string, password: string): Promise<LoginResult> {
  const e = (email || '').trim().toLowerCase();
  if (!e || !password) return {ok: false, error: 'Informe email e senha.'};
  let user: AppUser | null = null;
  try {
    user = await findUserByEmail(e);
  } catch {
    return {ok: false, error: 'Falha de conexão. Tente novamente.'};
  }
  if (!user) return {ok: false, error: 'Email não encontrado.'};
  if (user.status === 'pendente') return {ok: false, error: 'Cadastro aguardando aprovação.'};
  if (user.status === 'removido' || user.status === 'excluido') {
    return {ok: false, error: 'Conta inativa.'};
  }
  if (!verifyPw(user, password)) return {ok: false, error: 'Senha incorreta.'};
  await setSessionUid(user.id);
  return {ok: true, user};
}

export async function logout(): Promise<void> {
  await clearSession();
}
