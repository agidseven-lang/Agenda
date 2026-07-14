#!/usr/bin/env node
/* =====================================================================
   F3.3.73I2 — Testes HERMÉTICOS (texto/fonte) do CTA "Novo compromisso"
   na Agenda Android (lacuna reportada no owner-run físico da 73I):
     - AgendaScreen expõe onNewEvent e um botão VISÍVEL "Novo compromisso";
     - MainScaffold liga o CTA à rota eventForm já existente (EventFormScreen);
     - o form já era completo/validado (73F): título "Novo compromisso",
       valida cliente+data, grava via EventContract.create (contrato events);
     - eventos existentes preservados (nada apagado/migrado; só UI de acesso);
     - regressões 73C–73I1 intactas (Board/Copywriting-fora/Chat-fora/FCM/push).
   Lê Kotlin como TEXTO — NÃO compila, NÃO gera APK, NÃO chama rede, NÃO escreve.
   Vive em desktop/scripts/ (fora de android-native-beta/**) → não dispara workflow.
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AND = path.resolve(__dirname, "..", "..", "android-native-beta", "app");
const rd = (p) => fs.readFileSync(path.join(AND, p), "utf8");
const P = "src/main/java/br/com/idseven/agenda/nativebeta";
const AGENDA = rd(`${P}/features/agenda/AgendaScreen.kt`);
const SCAFFOLD = rd(`${P}/core/MainScaffold.kt`);
const EVFORM = rd(`${P}/features/events/EventFormScreen.kt`);
const CONTRACT = rd(`${P}/data/EventContract.kt`);
const REPO = rd(`${P}/data/EventRepo.kt`);
const TYPES = rd(`${P}/domain/Types.kt`);
const HUB = rd(`${P}/features/tasks/BoardsHubScreen.kt`);
const TASKFORM = rd(`${P}/features/tasks/TaskFormScreen.kt`);
const AUTH = rd(`${P}/data/AuthRepo.kt`);
const USERS = rd(`${P}/data/UsersRepo.kt`);
const FCMAPI = rd(`${P}/data/FcmApi.kt`);
const SVC = rd(`${P}/core/AppFirebaseMessagingService.kt`);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73I2 — CTA Novo compromisso na Agenda Android (hermético por texto)");

/* ── A: CTA visível na Agenda ── */
ok("A1 AgendaScreen recebe callback onNewEvent",
  /fun AgendaScreen\(eventsState: UiList<EventItem>, users: List<UserLite>, onEventClick: \(String\) -> Unit, onNewEvent: \(\) -> Unit\)/.test(AGENDA));
ok("A2 botão VISÍVEL 'Novo compromisso' na tela (accent, clicável, chama onNewEvent)",
  /Icons\.Filled\.Add/.test(AGENDA) && /"Novo compromisso"/.test(AGENDA) &&
  /\.clickable \{ onNewEvent\(\) \}/.test(AGENDA));
ok("A3 CTA fica ANTES da busca (descobrível no topo da Agenda)",
  AGENDA.indexOf('"Novo compromisso"') < AGENDA.indexOf('"Buscar compromisso…"'));
ok("A4 MainScaffold liga o CTA à rota eventForm existente",
  /AgendaScreen\(eventsState, users, onEventClick = \{ nav\.navigate\("event\/\$it"\) \}, onNewEvent = \{ nav\.navigate\("eventForm"\) \}\)/.test(SCAFFOLD));
ok("A5 rota eventForm existe e resolve EventFormScreen",
  /route = "eventForm\?id=\{id\}"/.test(SCAFFOLD) && /EventFormScreen\(/.test(SCAFFOLD));

/* ── B: form de evento já completo (nada novo criado; só acesso) ── */
ok("B1 EventFormScreen com título 'Novo compromisso' no modo criação",
  /if \(editId != null\) "Editar compromisso" else "Novo compromisso"/.test(EVFORM));
ok("B2 form valida cliente e data antes de gravar (evita dado inválido)",
  /Informe o cliente/.test(EVFORM) && /Escolha a data/.test(EVFORM));
ok("B3 grava via EventContract.create (contrato events; 14 campos ≤ size<50 das Rules)",
  /EventRepo\.create\(EventContract\.create\(input, currentUid/.test(EVFORM) &&
  (CONTRACT.match(/"\w+" to i\./g) || []).length === 10 &&
  (CONTRACT.slice(CONTRACT.indexOf('fun create('), CONTRACT.indexOf('fun editPatch')).match(/put\("/g) || []).length === 4);
ok("B4 responsável escolhido entre usuários ATIVOS (usersPublic)",
  /users\.filter \{ it\.isActive\(\) \}/.test(EVFORM));

/* ── C: eventos existentes preservados (só UI de acesso mudou) ── */
ok("C1 EventRepo intocado (leitura em tempo real + create/update/delete presentes)",
  /collection\("events"\)\.addSnapshotListener/.test(REPO) && /suspend fun create\(/.test(REPO) &&
  /suspend fun update\(/.test(REPO));
ok("C2 nenhuma exclusão/migração de eventos introduzida (patch é só CTA/UI)",
  !/delete\(|migra/i.test(AGENDA.replace(/\/\/[^\n]*/g, "")));
ok("C3 detalhe de evento continua acessível (onEventClick → event/{id})",
  /onEventClick\(ev\.id\)/.test(AGENDA) && /composable\("event\/\{id\}"\)/.test(SCAFFOLD));

/* ── D: regressões 73C–73I1 ── */
ok("D1 Board/Kanban canônico intacto",
  /COLUMNS = listOf\("afazer", "andamento", "revisao", "concluido"\)/.test(TYPES));
ok("D2 Copywriting fora do hub (73I1) e da criação (73E)",
  /items\(Sectors\.ALL\.filter \{ !it\.descontinuado \}, key = \{ it\.key \}\)/.test(HUB) &&
  /Sectors\.ALL\.filter \{ !it\.descontinuado \}\.forEach/.test(TASKFORM));
ok("D3 Chat fora do fluxo principal (sem aba, sem rota)",
  !/Tab\("chat"/.test(SCAFFOLD) && !/composable\("chat"\)/.test(SCAFFOLD));
ok("D4 login server-side + Equipe usersPublic intactos",
  /FN_LOGIN_URL/.test(AUTH) && /collection\("usersPublic"\)/.test(USERS));
ok("D5 FCM token server-side + push intactos",
  /REGISTER_FCM_TOKEN_URL/.test(FCMAPI) && /FcmApi\.register\(applicationContext, token\)/.test(SVC) &&
  /AppForeground\.isForeground && data\["type"\] == "task"/.test(SVC));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
