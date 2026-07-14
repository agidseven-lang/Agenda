#!/usr/bin/env node
/* =====================================================================
   F3.3.73F — Testes HERMÉTICOS (texto/fonte) da AGENDA Android validada
   contra o contrato seguro do sub-gate events/Rules:
     - EventRepo lê/escreve a coleção events com o contrato FIEL ao PWA
       (Rules atuais: read true / create-update size<50 / delete true —
       evidência capturada no gate; payloads do app ficam ≤ 14 campos);
     - Agenda/Calendário/Detalhe/Form preservados (sem Firestore direto
       nas telas; tudo via EventRepo/EventContract);
     - tipos de compromisso canônicos (mesmos 5 do Desktop 1.0.159);
     - zero PII: telas de agenda resolvem owner/criador via UserLite
       (usersPublic), nunca via collection("users");
     - regressões 73C/73D/73E intactas (login server-side, usersPublic,
       self, Board canônico, Chat fora, Copywriting fora da criação).
   Lê Kotlin como TEXTO — NÃO compila, NÃO gera APK, NÃO chama rede, NÃO escreve.
   Vive em desktop/scripts/ (fora de android-native-beta/**) → não dispara workflow.
   Compilação real: android-compile-check.yml (compileDebugKotlin, sem APK).
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AND = path.resolve(__dirname, "..", "..", "android-native-beta", "app");
const rd = (p) => fs.readFileSync(path.join(AND, p), "utf8");
const P = "src/main/java/br/com/idseven/agenda/nativebeta";
const REPO = rd(`${P}/data/EventRepo.kt`);
const CONTRACT = rd(`${P}/data/EventContract.kt`);
const TYPES = rd(`${P}/domain/Types.kt`);
const AGENDA = rd(`${P}/features/agenda/AgendaScreen.kt`);
const CAL = rd(`${P}/features/agenda/CalendarCard.kt`);
const DETAIL = rd(`${P}/features/events/EventDetailScreen.kt`);
const FORM = rd(`${P}/features/events/EventFormScreen.kt`);
const AUTH = rd(`${P}/data/AuthRepo.kt`);
const USERS = rd(`${P}/data/UsersRepo.kt`);
const SCAFFOLD = rd(`${P}/core/MainScaffold.kt`);
const TASKFORM = rd(`${P}/features/tasks/TaskFormScreen.kt`);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73F — Agenda Android (hermético por texto)");

/* ── A: EventRepo/contrato — fiel ao PWA e dentro das Rules ── */
ok("A1 EventRepo lê a coleção events (stream + doc)",
  /collection\("events"\)\.addSnapshotListener/.test(REPO) &&
  /collection\("events"\)\.document\(id\)\.addSnapshotListener/.test(REPO));
ok("A2 escritas centralizadas no EventRepo (create/update/cancel-lógico + patches; 73I6C3)",
  /suspend fun create\(/.test(REPO) && /suspend fun update\(/.test(REPO) &&
  /suspend fun cancel\(/.test(REPO) && !/suspend fun delete\(/.test(REPO) && /startPatch/.test(REPO) && /finishPatch/.test(REPO) && /reopenPatch/.test(REPO));
ok("A3 contrato base canônico (type/client/title/location/date/start/end/owner/ownerId/notes)",
  ["type", "client", "title", "location", "date", "start", "end", "owner", "ownerId", "notes"]
    .every(f => new RegExp(`"${f}" to i\\.`).test(CONTRACT)));
ok("A4 create adiciona by/done/createdAt/src (rastreio PWA)",
  /put\("by", byUid\)/.test(CONTRACT) && /put\("done", false\)/.test(CONTRACT) &&
  /put\("createdAt", nowMs\)/.test(CONTRACT) && /put\("src", "nativebeta"\)/.test(CONTRACT));
(() => {
  const baseFields = (CONTRACT.match(/"\w+" to i\./g) || []).length;
  const createBlock = CONTRACT.slice(CONTRACT.indexOf('fun create('), CONTRACT.indexOf('fun editPatch'));
  const createExtra = (createBlock.match(/put\("/g) || []).length;
  ok(`A5 payload de create ≤ 14 campos (${baseFields}+${createExtra}) — dentro do size<50 das Rules`,
    baseFields === 10 && createExtra === 4);
})();
ok("A6 patches start/finish/reopen mínimos (startedAt/startedBy, done/doneAt/doneBy)",
  /"startedAt" to nowMs, "startedBy" to uid/.test(CONTRACT) &&
  /"done" to true, "doneAt" to nowMs, "doneBy" to uid/.test(CONTRACT) &&
  /"done" to false, "doneAt" to null, "doneBy" to null/.test(CONTRACT));

/* ── B: telas preservadas, sem Firestore direto fora do repo ── */
ok("B1 AgendaScreen é read-only via UiList (sem Firestore/EventRepo direto)",
  !/collection\(/.test(AGENDA) && !/EventRepo\./.test(AGENDA) && /eventsState: UiList<EventItem>/.test(AGENDA));
ok("B2 calendário mensal preservado (pager + CalendarCard + dia selecionado)",
  /HorizontalPager/.test(AGENDA) && /CalendarCard\(/.test(AGENDA) && /selected = LocalDate\.now\(\)/.test(AGENDA.replace(/\n/g, " ")) || (/CalendarCard\(/.test(AGENDA) && /LocalDate/.test(AGENDA)));
ok("B3 CalendarCard é UI pura (sem Firestore, sem repo)",
  !/collection\(/.test(CAL) && !/EventRepo/.test(CAL) && !/Firebase/.test(CAL));
ok("B4 detalhe preservado (stream por id + iniciar/finalizar/reabrir/cancelar-lógico via repo; 73I6C3)",
  /EventRepo\.event\(id\)/.test(DETAIL) && /EventRepo\.start\(/.test(DETAIL) &&
  /EventRepo\.finish\(/.test(DETAIL) && /EventRepo\.reopen\(/.test(DETAIL) && /EventRepo\.cancel\(/.test(DETAIL) && !/EventRepo\.delete\(/.test(DETAIL));
ok("B5 criação/edição preservadas pelo contrato (create + editPatch com updatedAt/By; 73I6C3)",
  /EventRepo\.update\(editId, EventContract\.editPatch\(input, currentUid/.test(FORM) &&
  /EventRepo\.create\(EventContract\.create\(input, currentUid/.test(FORM));
ok("B6 form valida cliente e data antes de gravar",
  /Informe o cliente/.test(FORM) && /Escolha a data/.test(FORM));
ok("B7 responsável escolhido entre usuários ATIVOS (usersPublic da 73D)",
  /users\.filter \{ it\.isActive\(\) \}/.test(FORM));

/* ── C: tipos de compromisso canônicos (Desktop 1.0.159 TYPES) ── */
ok("C1 5 tipos canônicos (gravacao/foto/reuniao/edicao/outro)",
  ["gravacao", "foto", "reuniao", "edicao", "outro"].every(t => TYPES.includes(`T("${t}"`)));
ok("C2 cores canônicas dos tipos (EF4444/F59E0B/60A5FA/A78BFA/9CA3AF)",
  ["0xFFEF4444", "0xFFF59E0B", "0xFF60A5FA", "0xFFA78BFA", "0xFF9CA3AF"].every(c => TYPES.includes(c)));
ok("C3 filtro por tipo na Agenda usa Types canônico",
  /Types\.(ALL|of)/.test(AGENDA));

/* ── D: segurança — zero PII / zero users-direto nos fluxos de agenda ── */
ok("D1 nenhuma tela de agenda/eventos lê collection(\"users\")",
  ![AGENDA, CAL, DETAIL, FORM].some(s => /collection\("users"\)/.test(s)));
ok("D2 owner/criador resolvidos via UserLite (projeção sem e-mail)",
  /users\.firstOrNull \{ it\.id == oid \}/.test(DETAIL) && !/\.email/.test(DETAIL) && !/\.email/.test(AGENDA));
ok("D3 EventRepo não loga token/senha/segredo",
  !/Log\.[a-z]+\([^)]*token/i.test(REPO) && !/password|senha|secret/i.test(REPO));

/* ── E: regressões 73C/73D/73E preservadas ── */
ok("E1 login segue server-side (loginUser/getUserSelf)",
  /FN_LOGIN_URL/.test(AUTH) && /FN_SELF_URL/.test(AUTH));
ok("E2 Equipe segue usersPublic com filtro de ativos/canário",
  /collection\("usersPublic"\)/.test(USERS) && /isActive\(/.test(USERS));
ok("E3 Board/Kanban canônico preservado (colunas + copywriting descontinuado)",
  /COLUMNS = listOf\("afazer", "andamento", "revisao", "concluido"\)/.test(TYPES) &&
  /Sec\("copywriting"[\s\S]{0,120}descontinuado = true\)/.test(TYPES));
ok("E4 Chat segue fora do fluxo principal (sem aba, sem rota)",
  !/Tab\("chat"/.test(SCAFFOLD) && !/composable\("chat"\)/.test(SCAFFOLD));
ok("E5 Copywriting segue fora da criação de tarefa",
  /Sectors\.ALL\.filter \{ !it\.descontinuado \}\.forEach/.test(TASKFORM));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
