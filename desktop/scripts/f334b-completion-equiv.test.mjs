#!/usr/bin/env node
/* F3.3.4 item A — PROVA DE EQUIVALÊNCIA da unificação de conclusão (read-side puro).
   Extrai isTaskCompleted + flowCompletedSignal REAIS do renderer e prova, para TODAS as 2^5
   combinações dos 5 campos de conclusão, que o resultado é IDÊNTICO à regra inline anterior.
   Garante que a unificação NÃO mudou comportamento. Não toca produção, não escreve, não deploya.
   Rodar: /opt/node22/bin/node desktop/scripts/f334b-completion-equiv.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED'); };

// extrai função por nome (chaves balanceadas) — mesmo método do e2e.
const fnDecl = (n) => { const m = html.match(new RegExp('function ' + n + '\\s*\\([^)]*\\)\\s*\\{')); if (!m) { console.error('::error:: não achei ' + n); process.exit(1); } let s = html.indexOf(m[0]), d = 0; for (let i = s + m[0].length - 1; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return html.slice(s, i + 1); } } return ''; };
const api = new Function(fnDecl('isTaskCompleted') + '\n' + fnDecl('flowCompletedSignal') + '\n;return { isTaskCompleted, flowCompletedSignal };')();
const { isTaskCompleted, flowCompletedSignal } = api;

// regra ORIGINAL (pré-mudança), copiada do inline que existia em flowCompletedSignal/clientCol.
const original = (t) => !!(t && (t.finalApprovalCompleted === true || t.clientApprovedFlag === true || t.operationalStatus === 'concluido' || t.cronStatus === 'aprovado_final' || t.clientFlowStatus === 'concluido'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.log('FAIL', n); } };

// 5 campos × valor gatilho / valor não-gatilho. Enumera 2^5 = 32 combinações + ruído.
const fields = [
  ['finalApprovalCompleted', true, false],
  ['clientApprovedFlag', true, false],
  ['operationalStatus', 'concluido', 'andamento'],
  ['cronStatus', 'aprovado_final', 'sent_to_designer'],
  ['clientFlowStatus', 'concluido', 'producao'],
];
let combos = 0, eq = 0, eqFlow = 0;
for (let mask = 0; mask < 32; mask++) {
  const t = { id: 'T' + mask, sector: 'cronograma', title: 'x', client: 'C', status: 'andamento' };
  for (let b = 0; b < 5; b++) { const [k, on, off] = fields[b]; t[k] = (mask & (1 << b)) ? on : off; }
  combos++;
  const o = original(t), a = isTaskCompleted(t), f = flowCompletedSignal(t);
  if (a === o) eq++; if (f === o) eqFlow++;
  ok('combo ' + mask + ' isTaskCompleted==original', a === o);
  ok('combo ' + mask + ' flowCompletedSignal==original', f === o);
}
ok('TODAS as 32 combinações: isTaskCompleted ≡ original', eq === 32);
ok('TODAS as 32 combinações: flowCompletedSignal ≡ original', eqFlow === 32);
// casos triviais
ok('vazio => não concluído', isTaskCompleted({}) === false && isTaskCompleted(null) === false);
ok('só finalApprovalCompleted => concluído', isTaskCompleted({ finalApprovalCompleted: true }) === true);
ok('só clientApprovedFlag (Worker) => concluído', isTaskCompleted({ clientApprovedFlag: true }) === true);

// estático: o roteamento foi aplicado e isFullyComplete NÃO foi alterado (mantém guardas + subconjunto).
ok('clientCol usa isTaskCompleted (roteado)', /function clientCol\(t\)\{[\s\S]*?if\(isTaskCompleted\(t\)\)return 'concluido';/.test(html));
ok('flowCompletedSignal usa isTaskCompleted (roteado)', /function flowCompletedSignal\(t\)\{return isTaskCompleted\(t\);\}/.test(html));
ok('isFullyComplete PRESERVADO (guardas duras + subconjunto, não roteado)', /function isFullyComplete\(t\)\{[\s\S]*?hasDesigner\(t\)&&!designerDelivered\(t\)\)return false;[\s\S]*?return !!\(t\.finalApprovalCompleted===true\|\|t\.operationalStatus==='concluido'\|\|t\.clientFlowStatus==='concluido'\);/.test(html) && !/function isFullyComplete\(t\)\{return isTaskCompleted/.test(html));

console.log(`\nF3.3.4-A EQUIV RESULT: ${pass} PASS / ${fail} FAIL  (32/32 combinações equivalentes: ${eq === 32 && eqFlow === 32})`);
if (fail) { console.error('::error::EQUIVALÊNCIA FALHOU — comportamento mudou'); process.exit(1); }
console.log('F3.3.4 item A OK — unificação de conclusão é BYTE-equivalente; isFullyComplete preservado; read-side puro.');
