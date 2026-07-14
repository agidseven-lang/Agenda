#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C3A — Testes HERMÉTICOS (texto/fonte Kotlin) da EXCLUSÃO DEFINITIVA
   do Android, em paridade com o Desktop 1.0.162 e o gatilho onEventDeleted:
     - EventContract.deletePatch grava deletedBy/deletedAt;
     - EventRepo.remove: grava deletePatch ANTES do delete físico e REMOVE o doc
       (único .document(id).delete() do repo); cancelar continua LÓGICO (update);
     - EventDetailScreen: "Excluir definitivamente" SÓ admin (canManage), em QUALQUER
       estado (fora do bloco de lifecycle que se esconde quando cancelado);
     - confirmação FORTE: aviso de irreversibilidade + digitar "EXCLUIR" (campo);
     - AgendaScreen: alternador "Mostrar/Ocultar cancelados" (showCancelled);
     - AppFirebaseMessagingService: "deleted" entra no guard isLifecycle (não reagenda);
     - regressões: cancelar-lógico / criar / editar / iniciar / finalizar preservados.
   Lê os .kt como TEXTO — NÃO compila, NÃO abre app, NÃO rede, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'android-native-beta', 'app', 'src', 'main', 'java', 'br', 'com', 'idseven', 'agenda', 'nativebeta');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CONTRACT = R('data/EventContract.kt');
const REPO = R('data/EventRepo.kt');
const DETAIL = R('features/events/EventDetailScreen.kt');
const AGENDA = R('features/agenda/AgendaScreen.kt');
const FCM = R('core/AppFirebaseMessagingService.kt');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I6C3A — Android exclusão definitiva (hermético)');

/* ── A: contrato deletePatch ── */
ok('A1 EventContract.deletePatch grava deletedBy/deletedAt (p/ onEventDeleted atribuir ator)',
  /fun deletePatch\(uid: String\?, nowMs: Long\): Map<String, Any\?> =\s*mapOf\("deletedBy" to uid, "deletedAt" to nowMs\)/.test(CONTRACT));
ok('A2 deletePatch é SEPARADO do cancelPatch (não mistura cancelamento com exclusão)',
  /fun cancelPatch\(uid: String\?, nowMs: Long\)[\s\S]{0,140}"status" to "cancelled"/.test(CONTRACT) &&
  /fun deletePatch\(/.test(CONTRACT));

/* ── B: EventRepo.remove — deletePatch ANTES do delete físico; único delete ── */
ok('B1 EventRepo.remove grava deletePatch ANTES do .document(id).delete()',
  /suspend fun remove\(id: String, uid: String\?\): Result<Unit> \{[\s\S]{0,260}EventContract\.deletePatch\(uid, System\.currentTimeMillis\(\)\)[\s\S]{0,220}\.document\("events"\)?\)?[\s\S]{0,40}\.document\(id\)\.delete\(\)/.test(REPO) ||
  /suspend fun remove\(id: String, uid: String\?\): Result<Unit> \{[\s\S]{0,260}deletePatch\(uid[\s\S]{0,200}\.document\(id\)\.delete\(\)/.test(REPO));
ok('B2 único delete físico de events em todo o EventRepo é o do remove()',
  (REPO.match(/\.document\(id\)\.delete\(\)/g) || []).length === 1);
ok('B3 cancelar/iniciar/finalizar continuam via update() (NUNCA delete físico)',
  /suspend fun cancel\(id: String, uid: String\?\) = update\(id, EventContract\.cancelPatch/.test(REPO) &&
  /suspend fun start\(id: String, uid: String\?\) = update\(id, EventContract\.startPatch/.test(REPO) &&
  /suspend fun finish\(id: String, uid: String\?\) = update\(id, EventContract\.finishPatch/.test(REPO) &&
  !/fun cancel\([\s\S]{0,160}\.delete\(\)/.test(REPO));

/* ── C: EventDetailScreen — botão admin em qualquer estado + confirmação forte ── */
ok('C1 "Excluir definitivamente" só admin (canManage), FORA do bloco de lifecycle (vale p/ cancelados)',
  /if \(canManage\) \{[\s\S]{0,220}BigButton\("Excluir definitivamente", Icons\.Outlined\.DeleteForever/.test(DETAIL));
ok('C2 delete vale em QUALQUER estado: Spacer trata isCancelled DENTRO do if(canManage) (fora do bloco de lifecycle)',
  /if \(canManage\) \{\s*Spacer\(Modifier\.height\(if \(EventStatus\.isCancelled\(ev\)\) 16\.dp else 11\.dp\)\)\s*BigButton\("Excluir definitivamente"/.test(DETAIL));
ok('C3 confirmação FORTE: texto de irreversibilidade obrigatório',
  /Esta ação é permanente e não poderá ser desfeita\./.test(DETAIL));
ok('C4 confirmação FORTE: exige digitar EXCLUIR (campo + armado só com "EXCLUIR")',
  /val armed = delText\.trim\(\) == "EXCLUIR"/.test(DETAIL) &&
  /OutlinedTextField\(value = delText, onValueChange = \{ delText = it \}/.test(DETAIL) &&
  /Para confirmar, digite EXCLUIR/.test(DETAIL));
ok('C5 confirmar chama EventRepo.remove (grava ator + apaga) e volta; botão só armado+!busy',
  /enabled = armed && !busy/.test(DETAIL) &&
  /EventRepo\.remove\(id, currentUid\)\.onSuccess \{ onBack\(\) \}/.test(DETAIL));
ok('C6 estados de confirmação separados (confirmDelete ≠ confirmCancel)',
  /var confirmDelete by remember \{ mutableStateOf\(false\) \}/.test(DETAIL) &&
  /var confirmCancel by remember \{ mutableStateOf\(false\) \}/.test(DETAIL));

/* ── D: acesso a cancelados (Mostrar/Ocultar cancelados) ── */
ok('D1 AgendaScreen tem alternador showCancelled',
  /var showCancelled by remember \{ mutableStateOf\(false\) \}/.test(AGENDA));
ok('D2 quando ligado, inclui cancelados; padrão filtra (exclusão lógica preservada)',
  /val all = if \(showCancelled\) eventsState\.itemsOrEmpty\(\)\s*else eventsState\.itemsOrEmpty\(\)\.filter \{ !EventStatus\.isCancelled\(it\) \}/.test(AGENDA));
ok('D3 botão "Mostrar/Ocultar cancelados" (FilterChip alternando o estado)',
  /FilterChip\(\s*selected = showCancelled,\s*onClick = \{ showCancelled = !showCancelled \}/.test(AGENDA) &&
  /if \(showCancelled\) "Ocultar cancelados" else "Mostrar cancelados"/.test(AGENDA));

/* ── E: FCM — "deleted" é lifecycle (não reagenda; sem deep-link p/ doc removido) ── */
ok('E1 isLifecycle inclui "deleted"',
  /val isLifecycle = action == "started" \|\| action == "finished" \|\| action == "cancelled" \|\| action == "updated" \|\| action == "deleted"/.test(FCM));
ok('E2 lifecycle (inclui deleted) NÃO reagenda lembrete',
  /\(type == "event" \|\| type == "task"\) && !isLifecycle/.test(FCM));

/* ── F: regressões preservadas ── */
ok('F1 cancelamento LÓGICO preservado (status:cancelled via cancelPatch; sem delete)',
  /fun cancelPatch\(uid: String\?, nowMs: Long\): Map<String, Any\?> =\s*mapOf\("status" to "cancelled", "cancelledAt" to nowMs, "cancelledBy" to uid\)/.test(CONTRACT));
ok('F2 diálogo de cancelamento continua lógico ("não é apagado")',
  /Cancelar compromisso/.test(DETAIL) && /não é apagado/.test(DETAIL) && /Sim, cancelar/.test(DETAIL));
ok('F3 criar preservado (src nativebeta + by/done/createdAt)',
  /put\("src", "nativebeta"\)/.test(CONTRACT) && /put\("by", byUid\)/.test(CONTRACT) && /put\("createdAt", nowMs\)/.test(CONTRACT));
ok('F4 editar preservado (editPatch updatedAt/updatedBy)',
  /fun editPatch\(i: Input, uid: String\?, nowMs: Long\)[\s\S]{0,160}put\("updatedAt", nowMs\); put\("updatedBy", uid\)/.test(CONTRACT));
ok('F5 iniciar/finalizar preservados (start/finishPatch)',
  /fun startPatch\([\s\S]{0,80}"startedAt" to nowMs/.test(CONTRACT) && /fun finishPatch\([\s\S]{0,80}"done" to true/.test(CONTRACT));
ok('F6 header Editar/Cancelar condicionais preservados (não cancelado; cancelar só !done)',
  /if \(canManage && evc != null && !EventStatus\.isCancelled\(evc\)\)/.test(DETAIL) && /if \(!evc\.done\) \{[\s\S]{0,120}Icons\.Outlined\.Cancel/.test(DETAIL));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
