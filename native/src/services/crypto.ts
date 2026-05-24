/**
 * Compatibilidade de senha com o app WEB (mesmo esquema, mesma coleção `users`).
 * Web: hashPw(pw, salt) = "s2:" + sha256Hex(salt + "|" + pw).
 * Legado fraco (djb2): hashPass(pw) = "h" + (uint32). Mantido só para verificar contas antigas.
 * NÃO alteramos o esquema — apenas verificamos, para o login nativo bater com o web.
 */
import {sha256} from 'js-sha256';

export function hashPw(pw: string, salt: string): string {
  return 's2:' + sha256(salt + '|' + pw);
}

// djb2 idêntico ao web (hashPass)
export function legacyHashPass(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return 'h' + (h >>> 0);
}

export function verifyPw(
  user: {pass?: string; salt?: string} | null | undefined,
  pw: string,
): boolean {
  if (!user || typeof user.pass !== 'string') return false;
  if (user.salt && user.pass.indexOf('s2:') === 0) {
    return user.pass === hashPw(pw, user.salt);
  }
  // conta legada (hash fraco) — só verificação; a migração para "s2:" segue sendo feita pelo web
  return user.pass === legacyHashPass(pw);
}
