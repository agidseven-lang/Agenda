#!/usr/bin/env node
/* ============================================================================
 * TESTE REAL ASSISTIDO — team-action do Worker V64.46 (produção)
 * ----------------------------------------------------------------------------
 * Reproduz EXATAMENTE o que o botão "Marcar como corrigido" do Desktop novo
 * fará: emite o Team Session JWT em /team/session (senha digitada SEM ECO,
 * nunca em argumento/histórico/arquivo) e chama a team-action com Bearer +
 * Idempotency-Key; depois repete a MESMA chamada para provar o replay
 * (duplo clique não duplica push/evento).
 *
 * Uso:  node scripts/worker-team-action-test.mjs
 * Requisitos: Node 18+ (fetch nativo). Nenhuma dependência.
 * Segurança: a senha vai apenas no corpo HTTPS para o SEU Worker; o script
 * não grava nada em disco e imprime só trechos do JWT.
 * ============================================================================ */
import readline from 'node:readline/promises';

const B = 'https://idseven-push.agidseven.workers.dev';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function askHidden(promptText) {
  return new Promise((resolve) => {
    process.stdout.write(promptText);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode && stdin.setRawMode(true);
    let s = '';
    const onData = (c) => {
      c = c.toString('utf8');
      if (c === '\r' || c === '\n') {
        stdin.setRawMode && stdin.setRawMode(wasRaw || false);
        stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(s);
      } else if (c === '') { // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      } else if (c === '' || c === '\b') {
        s = s.slice(0, -1);
      } else {
        s += c;
      }
    };
    stdin.on('data', onData);
  });
}

const uid = (await rl.question('UID do usuário Social/Admin (id do doc em users/): ')).trim();
const password = await askHidden('Senha (não aparece ao digitar): ');
const token = (await rl.question('Token do cliente (final do link /cliente/cronograma/<token>): ')).trim();
const idxRaw = (await rl.question('Índice do conteúdo com ajuste pendente (0 = primeiro) [0]: ')).trim();
const idx = Number(idxRaw === '' ? 0 : idxRaw);

console.log('\n[1/3] Emitindo Team Session JWT em /team/session …');
let r = await fetch(B + '/team/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uid, password }),
});
let j = await r.json().catch(() => ({}));
if (!r.ok || j.ok !== true || !j.token) {
  console.error('  FALHOU /team/session → HTTP', r.status, JSON.stringify(j));
  console.error('  (401 "credenciais inválidas" = uid/senha errados ou usuário sem role Social/Admin ativo;');
  console.error('   429 = rate limit — aguarde 15 min; 503 = TEAM_SESSION_SECRET ausente no Worker)');
  process.exit(1);
}
console.log('  OK: JWT emitido (expira em ' + (j.expiresIn / 3600) + 'h). Trecho: ' + j.token.slice(0, 18) + '…');

console.log('[2/3] Chamando team-action (Marcar como corrigido) …');
const idem = uid + '|' + token.slice(0, 8) + '|' + idx + '|' + Math.floor(Date.now() / 10000);
const call = () => fetch(B + '/cliente/cronograma/' + encodeURIComponent(token) + '/team-action', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + j.token,
    'Idempotency-Key': idem,
  },
  body: JSON.stringify({ action: 'adjustedItem', contentIndexes: [idx] }),
});
r = await call();
const a = await r.json().catch(() => ({}));
console.log('  HTTP ' + r.status + ' → ' + JSON.stringify(a));
if (!r.ok || a.ok !== true) {
  console.error('  FALHOU team-action (404 = token de cliente inválido; 401 = JWT rejeitado; 403 = role revogada).');
  process.exit(1);
}
const pushed = (a.push && a.push.sent) || 0;
console.log('  Push ao cliente: sent=' + pushed + (a.push && a.push.fallback ? ' · fallback=' + a.push.fallback : '') +
  (a.push && a.push.reason ? ' · reason=' + a.push.reason : ''));

console.log('[3/3] DUPLO CLIQUE (mesma Idempotency-Key) — deve dar REPLAY, sem novo push …');
r = await call();
const replayed = r.headers.get('X-Idempotency-Replayed');
console.log('  HTTP ' + r.status + ' · X-Idempotency-Replayed: ' + (replayed || '(ausente)'));

console.log('\n== CONFERIR AGORA ==');
console.log('• Celular (tela bloqueada): chegou "Ajuste do tema realizado — Toque para revisar novamente."?');
console.log('• Tocar na notificação abre o MESMO link do portal?');
console.log('• Desktop/Android: o card saiu de "Ajuste solicitado" (cliente aguardando nova análise)?');
console.log('• Só UMA notificação (replay não duplicou)?');
rl.close();
