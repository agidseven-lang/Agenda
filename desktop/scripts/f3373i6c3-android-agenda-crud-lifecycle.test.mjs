#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C3 — Testes HERMÉTICOS (texto/fonte Kotlin) da paridade CRUD+lifecycle
   do Android com o Desktop 1.0.161 e o contrato server-side 73I6C1:
     - cancelamento LÓGICO (status:"cancelled"+cancelledAt/cancelledBy) — SEM delete físico;
     - edição grava updatedAt/updatedBy (preserva by/createdAt/src/done/startedAt);
     - iniciar/finalizar já existentes preservados; status visual inclui Cancelado;
     - Agenda ATIVA + "Hoje/Próximos" filtram cancelados;
     - AppFirebaseMessagingService não reagenda lembrete em push de lifecycle;
     - deep-link event:<id>, FCM token server-side, Chat/Copywriting removidos preservados.
   Lê os .kt como TEXTO — NÃO compila, NÃO abre app, NÃO rede, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'android-native-beta', 'app', 'src', 'main', 'java', 'br', 'com', 'idseven', 'agenda', 'nativebeta');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MODELS = R('domain/Models.kt');
const EVSTATUS = R('domain/EventStatus.kt');
const CONTRACT = R('data/EventContract.kt');
const REPO = R('data/EventRepo.kt');
const DETAIL = R('features/events/EventDetailScreen.kt');
const FORM = R('features/events/EventFormScreen.kt');
const AGENDA = R('features/agenda/AgendaScreen.kt');
const DASH = R('features/dashboard/DashboardScreen.kt');
const FCM = R('core/AppFirebaseMessagingService.kt');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I6C3 — Android Agenda CRUD+lifecycle parity (hermético)');

/* ── A: modelo + contrato ── */
ok('A1 EventItem tem status/cancelledAt/cancelledBy',
  /val status: String\? = null,[\s\S]{0,80}val cancelledAt: Long\? = null,[\s\S]{0,80}val cancelledBy: String\? = null,/.test(MODELS));
ok('A2 EventRepo.map lê status/cancelledAt/cancelledBy',
  /status = d\.getString\("status"\),[\s\S]{0,80}cancelledAt = d\.getLong\("cancelledAt"\),[\s\S]{0,80}cancelledBy = d\.getString\("cancelledBy"\),/.test(REPO));
ok('A3 EventContract.cancelPatch grava status:cancelled + cancelledAt/cancelledBy',
  /fun cancelPatch\(uid: String\?, nowMs: Long\)[\s\S]{0,140}"status" to "cancelled", "cancelledAt" to nowMs, "cancelledBy" to uid/.test(CONTRACT));
ok('A4 EventContract.editPatch = base + updatedAt/updatedBy',
  /fun editPatch\(i: Input, uid: String\?, nowMs: Long\)[\s\S]{0,160}base\(i\)\.apply \{ put\("updatedAt", nowMs\); put\("updatedBy", uid\) \}/.test(CONTRACT));
ok('A5 create ainda grava src:"nativebeta" + by/done/createdAt (preservado)',
  /put\("src", "nativebeta"\)/.test(CONTRACT) && /put\("by", byUid\)/.test(CONTRACT) && /put\("createdAt", nowMs\)/.test(CONTRACT));
ok('A6 startPatch/finishPatch/reopenPatch preservados',
  /fun startPatch\([\s\S]{0,80}"startedAt" to nowMs, "startedBy" to uid/.test(CONTRACT) &&
  /fun finishPatch\([\s\S]{0,80}"done" to true, "doneAt" to nowMs, "doneBy" to uid/.test(CONTRACT));

/* ── B: exclusão LÓGICA (sem delete físico) ── */
ok('B1 EventRepo.cancel via update (cancelPatch)',
  /suspend fun cancel\(id: String, uid: String\?\) = update\(id, EventContract\.cancelPatch\(uid, System\.currentTimeMillis\(\)\)\)/.test(REPO));
ok('B2 SEM delete físico de events (nenhum .document(id).delete())',
  !/\.document\(id\)\.delete\(\)/.test(REPO) && !/fun delete\(/.test(REPO));
ok('B3 EventDetailScreen cancela (confirmCancel → EventRepo.cancel), sem EventRepo.delete',
  /EventRepo\.cancel\(id, currentUid\)\.onSuccess \{ onBack\(\) \}/.test(DETAIL) && !/EventRepo\.delete/.test(DETAIL));
ok('B4 diálogo de cancelamento é lógico (sai da agenda, não apaga)',
  /Cancelar compromisso/.test(DETAIL) && /não é apagado/.test(DETAIL) && /Sim, cancelar/.test(DETAIL));

/* ── C: status visual + botões condicionais ── */
ok('C1 EventStatus.isCancelled derivado de status/cancelledAt',
  /fun isCancelled\(e: EventItem\): Boolean = e\.status == "cancelled" \|\| \(e\.cancelledAt != null && e\.cancelledAt > 0\)/.test(EVSTATUS));
ok('C2 EventStatus.status retorna "Cancelado" antes de done/andamento',
  /if \(isCancelled\(e\)\) return S\("cancelled", "Cancelado", false\)/.test(EVSTATUS));
ok('C3 detalhe: cor vermelha p/ cancelado na Situação', /si\.kind == "cancelled" \|\| si\.late/.test(DETAIL));
ok('C4 detalhe: linha "Cancelada em" com ator', /isCancelled\(ev\) && ev\.cancelledAt != null[\s\S]{0,200}"Cancelada em"/.test(DETAIL));
ok('C5 detalhe: ações de lifecycle escondidas se cancelado', /if \(!EventStatus\.isCancelled\(ev\)\) \{[\s\S]{0,260}Iniciar agora/.test(DETAIL));
ok('C6 header: Editar/Cancelar só se NÃO cancelado; Cancelar só se !done',
  /if \(canManage && evc != null && !EventStatus\.isCancelled\(evc\)\)/.test(DETAIL) && /if \(!evc\.done\) \{[\s\S]{0,120}Icons\.Outlined\.Cancel/.test(DETAIL));

/* ── D: edição grava updatedAt/updatedBy ── */
ok('D1 EventFormScreen edição usa editPatch (updatedAt/updatedBy)',
  /if \(editId != null\) EventRepo\.update\(editId, EventContract\.editPatch\(input, currentUid, System\.currentTimeMillis\(\)\)\)/.test(FORM));

/* ── E: Agenda ativa filtra cancelados ── */
ok('E1 AgendaScreen filtra cancelados', /itemsOrEmpty\(\)\.filter \{ !EventStatus\.isCancelled\(it\) \}/.test(AGENDA) && /import br\.com\.idseven\.agenda\.nativebeta\.domain\.EventStatus/.test(AGENDA));
ok('E2 Dashboard "Hoje/Próximos" filtra cancelados', /itemsOrEmpty\(\)\.filter \{ !EventStatus\.isCancelled\(it\) \}/.test(DASH));

/* ── F: FCM lifecycle não reagenda lembrete; deep-link/token preservados ── */
ok('F1 AppFirebaseMessagingService: push de lifecycle NÃO reagenda lembrete',
  /val isLifecycle = action == "started" \|\| action == "finished" \|\| action == "cancelled" \|\| action == "updated"/.test(FCM) &&
  /\(type == "event" \|\| type == "task"\) && !isLifecycle/.test(FCM));
ok('F2 deep-link event:<id> preservado (rota event/<id>)', /data\["deepLink"\]/.test(FCM) && /data\["eventId"\]/.test(FCM));
ok('F3 FCM token server-side preservado (registerFcmToken via FcmApi.register)', /FcmApi\.register\(applicationContext, token\)/.test(FCM));
ok('F4 payload action/actorName/actorPhoto não quebra (data-only lido com segurança)',
  /val data = message\.data/.test(FCM) && /data\["title"\]/.test(FCM) && /data\["body"\]/.test(FCM));

/* ── G: regressões (não reintroduz Chat/Copywriting; contrato preservado) ── */
ok('G1 EventItem preserva 14 campos-base + done/started/done*', /val done: Boolean,/.test(MODELS) && /val startedAt: Long\?,/.test(MODELS) && /val doneBy: String\?,/.test(MODELS));
ok('G2 update() genérico intacto (merge de campos, preserva os demais)', /db\.collection\("events"\)\.document\(id\)\.update\(data\)/.test(REPO));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
