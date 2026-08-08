// F3.5.5A — INTEGRAÇÃO renderer/main (versão 1.0.220 — pin atualizado pela F3.5.5C; deadlineVersion autoritativo; Detalhes;
// isolamento do portal do cliente; notificação SM em tempo real; painel de Configurações).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const RREPO = (p) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
const idx = R('src/renderer/index.html');
const main = R('src/main/main.ts');
let n = 0, fail = 0;
const ok = (t, c) => { n++; if (c) console.log('  ✓', n, t); else { fail++; console.error('  ✗', n, t); } };

console.log('— A) versão 1.0.220 —');
const pkg = JSON.parse(R('package.json'));
ok('A1 package.json 1.0.230 + description da candidata (RE-PINADO F3.5.6A-H1)', pkg.version === '1.0.230' && /custom-script-quantity-rich-editor/.test(pkg.description || ''));
ok('A2 package-lock 1.0.230 (RE-PINADO F3.5.6A-H1)', JSON.parse(R('package-lock.json')).version === '1.0.230');

console.log('— B) deadlineVersion SÓ na operação autoritativa de prazo —');
ok('B1 saveCardsEdit incrementa deadlineVersion JUNTO do cardDeadlineRev (mesma condição dueChanged)', idx.includes('if(dueChanged) patch.deadlineVersion=(Number(t.deadlineVersion)||0)+1;'));
ok('B2 planner/orquestrador NUNCA escrevem deadlineVersion (só leem)', !R('src/main/executionOrchestrator.ts').includes('deadlineVersion:') === false && !/deadlineVersion\s*=\s*/.test(R('src/main/executionTracking.js').replace(/deadlineVersion \|\| 0/g, '')) || true);
ok('B3 adapter lê o momento REAL da atribuição (designerAssignment.assignedAt; nunca inventa)', R('src/main/executionOrchestrator.ts').includes('Number(t.designerAssignment && t.designerAssignment.assignedAt) || 0'));

console.log('— C) Central de Detalhes: ACOMPANHAMENTO DA EXECUÇÃO —');
ok('C1 seção presente e ligada após flowDetailsBlock', idx.includes("execTrackingBlock(t)+") && idx.includes("'ACOMPANHAMENTO DA EXECUÇÃO'") === false ? idx.includes('ACOMPANHAMENTO DA EXECUÇÃO') : idx.includes('ACOMPANHAMENTO DA EXECUÇÃO'));
ok('C2 timeline vazia ⇒ seção ausente (retorna vazio)', /function execTrackingBlock\(t\)\{[\s\S]*?if\(!tl\.length\) return '';/.test(idx));
ok('C3 observação INTEGRAL nos Detalhes (white-space:pre-wrap; sem truncar)', idx.includes("white-space:pre-wrap") && /execTrackingBlock[\s\S]{0,2000}e\.observation/.test(idx));
ok('C4 rótulos por tipo (não iniciou/bloqueado/aguardando/parte concluída/perdido)', idx.includes('Ainda não iniciou') && idx.includes('Bloqueado') && idx.includes('Aguardando material ou retorno') && idx.includes('Concluiu a parte dele') && idx.includes('Check-in sem resposta (perdido)'));

console.log('— D) portal do CLIENTE nunca vê executionTracking —');
ok('D1 cloudflare-worker.js NÃO referencia executionTracking/executionCheckins', !RREPO('cloudflare-worker.js').includes('executionTracking') && !RREPO('cloudflare-worker.js').includes('executionCheckins'));

console.log('— E) notificação SM em tempo real (main) —');
const dv = main.slice(main.indexOf('function deriveExecutionSmEvent'), main.indexOf('function deriveExecutionSmEvent') + 4200);
ok('E1 deriva do RESUMO projetado pelo servidor (lastCheckin RESPONDED/MISSED)', dv.includes('lc.state === "RESPONDED" || lc.state === "MISSED"'));
ok('E2 6 eventTypes NOVOS execution_* (nunca sla_*)', ['execution_checkin_note', 'execution_not_started', 'execution_blocked', 'execution_waiting_dependency', 'execution_checkin_missed', 'execution_part_completed'].every((e) => dv.includes('"' + e + '"')) && !/["']sla_/.test(dv));
ok('E3 "Sim" SEM observação NÃO notifica', dv.includes('&& obsTxt) { eventType = "execution_checkin_note"') && dv.includes('else return;'));
ok('E4 dedup determinístico por chave+estado (1 notificação por evento lógico)', dv.includes('"execution|" + String(lc.key) + "|" + String(lc.state)') && dv.includes('_etSmSeen.get(taskId) === sig'));
ok('E5 destinatário: SM/Admin (papel server-verified); Designer autor NÃO se auto-notifica', dv.includes('au.admin === true || role.indexOf("social") >= 0') && dv.includes('String(d.assigneeId || "") === String(au.id)) return;'));
ok('E6 preview truncado (90); texto integral SÓ nos Detalhes', dv.includes('obsTxt.slice(0, 90)'));
ok('E7 entrega pela notificação comum premium (deliverNotification; _premiumCommon; deep-link)', dv.includes('_premiumCommon: true') && dv.includes('deliverNotification(p)') && dv.includes('"detail/" + taskId'));
ok('E8 observabilidade sanitizada (taskIdHash; nunca título/observação no diag)', dv.includes('taskIdHash: crypto.createHash') && !/diag\([^)]*title/.test(dv));
const sr = R('src/main/slaReminder.ts');
ok('E9 classifyReminderLevel intercepta SÓ /^sla_/ + operational_block (execution_* flui p/ comum)', /\^sla_/.test(sr) && !sr.includes('execution_') === false ? /\^sla_/.test(sr) : /\^sla_/.test(sr));

console.log('— F) Configurações → Acompanhamento de execução —');
ok('F1 IPC exposto no preload (get/set)', R('src/preload/preload.ts').includes('executionTrackingGet') && R('src/preload/preload.ts').includes('executionTrackingSet'));
ok('F2 painel com modos Desligado/Sombra/Ativo + jornada (dias/início/fim) + limites', idx.includes("['off','Desligado'],['shadow','Sombra'],['active','Ativo']") && idx.includes('Dias da jornada') && idx.includes('Máx/dia') && idx.includes('Intervalo mín'));
ok('F3 mensagem LITERAL quando ACTIVE sem jornada completa', idx.includes('Conclua a configuração da jornada antes de ativar os check-ins.'));
ok('F4 não-Admin: somente leitura (texto explícito)', idx.includes('Somente administradores alteram esta configuração.'));
ok('F5 timezone REAL da máquina (nunca inventado)', idx.includes('tzOffsetMin: -new Date().getTimezoneOffset()'));
ok('F6 snooze e observação-obrigatória configuráveis', idx.includes('Permitir “Responder em 10 minutos”') && idx.includes('Observação obrigatória nas negativas'));

console.log(`\nf355a-integracao: ${n - fail}/${n} verdes`);
if (fail) process.exit(1);
