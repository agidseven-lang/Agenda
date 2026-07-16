#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C18H — Testes HERMÉTICOS do TOKEN ESTÁVEL de aprovação:
     - mesma tarefa NUNCA rotaciona token em reenvio/edição/reabertura;
     - fonte (Firestore) é consultada ANTES de gerar (anti-overwrite);
     - shareToken legado (Web/PWA) é REUSADO sem escrita;
     - precedência de leitura: clientReviewToken PRIMEIRO (ordem do Worker);
     - single-flight: cliques simultâneos => UM token, UMA persistência;
     - corrida multi-máquina: read-back divergente ADOTA o vencedor;
     - token NUNCA aparece em log; formato = o MESMO aceito pelo Worker.
   Micro-exec REAL das funções extraídas do renderer (fetchless, db stub).
   Evidência SAME/CHANGED usa hash sha256 de tokens FAKE — nunca reais.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };
const h8 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
const cmp = (label, before, after) => {
  const r = before === after ? 'SAME' : 'CHANGED';
  console.log(`    ${label}: beforeHash=${h8(before)} afterHash=${h8(after)} result=${r}`);
  return r;
};

function fnSrc(name) {
  const re = new RegExp('(?:async )?function ' + name + '\\s*\\(');
  const m = HTML.match(re); if (!m) throw new Error('fn ' + name);
  let st = HTML.indexOf(m[0]), d = 0, i = HTML.indexOf('{', st);
  for (let j = i; j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(st, j + 1); } }
  throw new Error('sem fecho ' + name);
}

const SRC_VALID = fnSrc('isValidReviewToken');
const SRC_GEN = fnSrc('genReviewToken');
const SRC_ENSURE = fnSrc('ensureStableClientReviewToken');
const SRC_ALIAS = fnSrc('ensureReviewToken');
const CORE = SRC_VALID + '\nconst _tokenFlight=new Map();\n' + SRC_GEN + '\n' + SRC_ENSURE + '\n' + SRC_ALIAS + '\n';

console.log('F3.3.73I6C18H — token estável de aprovação (hermético)');

/* ── sandbox ── */
let seq = 0;
function mkEnv(docData, opts) {
  const o = opts || {};
  const calls = { get: 0, set: 0, payloads: [] };
  let store = docData ? Object.assign({}, docData) : null;
  const snap = () => { const s = store ? Object.assign({}, store) : null; return { exists: s != null, get: (k) => (s ? s[k] : undefined) }; };
  const db = { collection: () => ({ doc: () => ({
    get: async () => { calls.get++; return snap(); },
    set: async (payload, _opts) => {
      calls.set++; calls.payloads.push(payload);
      if (o.raceWinner) { store = Object.assign(store || {}, { clientReviewToken: o.raceWinner, clientReviewUrl: 'URL(' + o.raceWinner + ')' }); }
      else if (o.setFails) { /* servidor "perde" a escrita: store fica como está */ }
      else { store = Object.assign(store || {}, payload); }
    },
  }) }) };
  const state = { tasks: o.localTask ? [o.localTask] : [] };
  const selfStub = { crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (seq++) % 256; return a; } } };
  const api = new Function('state', 'db', 'buildPublicClientUrl', 'self', 'window',
    CORE + 'return { ensureStableClientReviewToken, ensureReviewToken, isValidReviewToken, genReviewToken };')(
    state, db, (tok) => 'URL(' + tok + ')', selfStub, undefined);
  return { api, calls, state, store: () => store };
}

/* ── A: validação de formato (mesma regra da rota do Worker) ── */
{
  const { api } = mkEnv(null);
  ok('A1 token gerado é cripto (48 hex) e passa na validação do Worker', (() => {
    const t = api.genReviewToken(); return /^[0-9a-f]{48}$/.test(t) && api.isValidReviewToken(t);
  })());
  ok('A2 vazio/null/undefined/curto/charset inválido são rejeitados',
    !api.isValidReviewToken('') && !api.isValidReviewToken(null) && !api.isValidReviewToken(undefined) &&
    !api.isValidReviewToken('ab') && !api.isValidReviewToken('tem espaco aqui') && !api.isValidReviewToken('a'.repeat(129)));
  ok('A3 sem Math.random no gerador (crypto.getRandomValues preservado)',
    !/Math\.random/.test(SRC_GEN) && /getRandomValues/.test(SRC_GEN));
}

/* ── B: gates funcionais 1..7 (mesma tarefa nunca rotaciona) ── */
{
  const env = mkEnv(null);
  const t1 = await env.api.ensureReviewToken('task1');
  ok('B1 [gate1] tarefa sem token recebe token válido e persiste UMA vez',
    env.api.isValidReviewToken(t1) && env.calls.set === 1 && env.store().clientReviewToken === t1 && env.store().clientReviewUrl === 'URL(' + t1 + ')');
  const t2 = await env.api.ensureReviewToken('task1');
  const t3 = await env.api.ensureReviewToken('task1');
  ok('B2 [gates2-4] segundo e terceiro envio retornam SAME sem nova persistência',
    cmp('2º envio', t1, t2) === 'SAME' && cmp('3º envio', t1, t3) === 'SAME' && env.calls.set === 1);
}
{
  // anti-overwrite (o BUG original): cache local VAZIO, servidor COM token → reusa, nunca gera
  const env = mkEnv({ clientReviewToken: 'servertokenAAAA1111', clientReviewUrl: 'URL(servertokenAAAA1111)' });
  const before = 'servertokenAAAA1111';
  const after = await env.api.ensureReviewToken('taskX');
  ok('B3 [BUG ORIGINAL] cache local vazio + token no servidor => reusa (SAME), zero overwrite',
    cmp('cache frio', before, after) === 'SAME' && env.calls.set === 0 && env.calls.get === 1);
}
{
  // cache local quente → zero rede
  const env = mkEnv({ clientReviewToken: 'qualquercoisa' }, { localTask: { id: 'taskY', clientReviewToken: 'localtokenBBBB2222' } });
  const after = await env.api.ensureReviewToken('taskY');
  ok('B4 cache local com token válido => reusa sem NENHUMA chamada de rede',
    after === 'localtokenBBBB2222' && env.calls.get === 0 && env.calls.set === 0);
}
{
  // gates 5-6: edição de título/conteúdos não rotaciona
  const doc = { clientReviewToken: 'stabletokenCCCC3333', title: 'A', cronContents: [] };
  const env = mkEnv(doc);
  const before = await env.api.ensureReviewToken('taskE');
  doc.title = 'B (editado)'; doc.cronContents = [{ tema: 'novo' }];   // edição via update() aditivo não toca token
  const after = await env.api.ensureReviewToken('taskE');
  ok('B5 [gates5-6] editar título/conteúdos retorna SAME',
    cmp('edição', before, after) === 'SAME' && env.calls.set === 0);
}
{
  // gate 7: fechar/reabrir (novo processo => cache local zerado; servidor mantém)
  const persisted = { clientReviewToken: 'reopentokenDDDD4444' };
  const env1 = mkEnv(persisted);
  const before = await env1.api.ensureReviewToken('taskR');
  const env2 = mkEnv(persisted);   // "reaberto": outro sandbox, mesmo doc
  const after = await env2.api.ensureReviewToken('taskR');
  ok('B6 [gate7] fechar/reabrir o Desktop mantém o mesmo link (SAME)',
    cmp('reabertura', before, after) === 'SAME' && env2.calls.set === 0);
}
{
  // gates 8-9: cronograma e roteiro seguem a MESMA lógica (helper independe de sector)
  const c = mkEnv({ sector: 'cronograma', clientReviewToken: 'crontokenEEEE5555' });
  const r = mkEnv({ sector: 'roteiro', clientReviewToken: 'rottokenFFFF6666' });
  ok('B7 [gates8-9] cronograma e roteiro preservam token igualmente',
    (await c.api.ensureReviewToken('tc')) === 'crontokenEEEE5555' && c.calls.set === 0 &&
    (await r.api.ensureReviewToken('tr')) === 'rottokenFFFF6666' && r.calls.set === 0 &&
    !/sector/.test(SRC_ENSURE));
}

/* ── C: concorrência (gate 10) ── */
{
  const env = mkEnv(null);
  const [x, y, z] = await Promise.all([
    env.api.ensureReviewToken('taskC'), env.api.ensureReviewToken('taskC'), env.api.ensureReviewToken('taskC'),
  ]);
  ok('C1 [gate10] 3 cliques simultâneos => UM único token e UMA persistência',
    x === y && y === z && env.api.isValidReviewToken(x) && env.calls.set === 1);
  ok('C2 single-flight limpa o voo após concluir (próxima chamada reusa via fonte, sem gerar)',
    await (async () => { const w = await env.api.ensureReviewToken('taskC'); return w === x && env.calls.set === 1; })());
}

/* ── D: compatibilidade dos 5 estados (precedência documentada) ── */
{
  const env = mkEnv({ shareToken: 'legacyshareGGGG7777' });
  const got = await env.api.ensureReviewToken('taskL');
  ok('D1 só shareToken (legado Web/PWA) => REUSA sem escrever nada',
    got === 'legacyshareGGGG7777' && env.calls.set === 0);
  ok('D2 [gate12] shareToken não é apagado nem sobrescrito',
    env.store().shareToken === 'legacyshareGGGG7777' && env.calls.payloads.every(p => !('shareToken' in p)));
}
{
  const env = mkEnv({ clientReviewToken: 'primaryHHHH8888', shareToken: 'secondaryIIII9999' });
  const got = await env.api.ensureReviewToken('taskB');
  ok('D3 ambos diferentes => precedência clientReviewToken (mesma ordem de leitura do Worker)',
    got === 'primaryHHHH8888' && env.calls.set === 0);
}
{
  const env = mkEnv({ clientReviewToken: 'equaltokenJJJJ0000', shareToken: 'equaltokenJJJJ0000' });
  ok('D4 ambos iguais => reusa, zero escrita',
    (await env.api.ensureReviewToken('taskQ')) === 'equaltokenJJJJ0000' && env.calls.set === 0);
}
{
  const env = mkEnv({ clientReviewToken: '', shareToken: 'ab' });   // ambos inválidos
  const got = await env.api.ensureReviewToken('taskI');
  ok('D5 valores inválidos (vazio/curto) não são reusados => gera token novo válido',
    env.api.isValidReviewToken(got) && got !== 'ab' && env.calls.set === 1);
  ok('D6 [gate11] clientReviewToken nunca é apagado (payload sempre com token válido)',
    env.calls.payloads.every(p => env.api.isValidReviewToken(p.clientReviewToken)));
}

/* ── E: corrida multi-máquina e falha de persistência ── */
{
  const env = mkEnv(null, { raceWinner: 'winnertokenKKKK1111' });
  const got = await env.api.ensureReviewToken('taskW');
  ok('E1 read-back divergente com vencedor VÁLIDO => adota o vencedor (nunca sobrescreve)',
    got === 'winnertokenKKKK1111' && env.store().clientReviewToken === 'winnertokenKKKK1111');
}
{
  const env = mkEnv(null, { setFails: true });
  let threw = false;
  try { await env.api.ensureReviewToken('taskF'); } catch (e) { threw = /nao confirmado/.test(String(e && e.message)); }
  ok('E2 persistência não confirmada e sem vencedor => LANÇA (nunca link órfão)', threw);
}

/* ── F: link/mensagem usam o MESMO token (gates 13-15) ── */
ok('F1 [gate13] /share e /cliente montados a partir do MESMO token (formato do link intacto)',
  HTML.includes("'/share/cronograma/'") && HTML.includes("'/cliente/cronograma/'") &&
  /token:o\.clientReviewToken\|\|null/.test(HTML));
ok('F2 [gate14] portal/leitores continuam com precedência clientReviewToken||shareToken',
  /t\.clientReviewToken\|\|t\.shareToken\|\|''/.test(HTML) && /\(t&&\(t\.clientReviewToken\|\|t\.shareToken\)\)\|\|''/.test(HTML.replace(/\s+/g, ' ')) || /t&&\(t\.clientReviewToken\|\|t\.shareToken\)\|\|''/.test(HTML));
ok('F3 [gate15] fluxo de aprovação intacto (clientReviewAction preservado)',
  /function\s+clientReviewAction|clientReviewAction\(/.test(HTML));

/* ── G: segurança de logs (gates 16-17) ── */
ok('G1 [gate16] helper novo não loga NADA (nenhum console.* dentro do ensure)',
  !/console\./.test(SRC_ENSURE) && !/diagLog/.test(SRC_ENSURE));
ok('G2 [gate17] call sites de warn existentes não recebem token (apenas o Error)',
  /console\.warn\('ensureReviewToken \(modal\)',e\)/.test(HTML) &&
  /console\.warn\('ensureReviewToken \(openwa\)',e\)/.test(HTML) &&
  /console\.warn\('ensureReviewToken \(resend\)',e\)/.test(HTML) &&
  !/console\.\w+\([^)]*clientReviewToken/.test(HTML));

/* ── H: fiação e versão (gates 18-20) ── */
ok('H1 alias ensureReviewToken delega para o helper estável (call sites intactos)',
  /async function ensureReviewToken\(taskId\)\{return ensureStableClientReviewToken\(taskId\);\}/.test(HTML));
ok('H2 single-flight declarado (Map por tarefa)', /const _tokenFlight=new Map\(\);/.test(HTML));
ok('H3 [gate20] versão da candidata QA (1.0.174-QA — 74E restore)', PKG.version === '1.0.174-QA');
ok('H4 fonte consultada ANTES de gerar (get antecede genReviewToken no fluxo frio)', (() => {
  const iGet = SRC_ENSURE.indexOf('await ref.get()');
  const iGen = SRC_ENSURE.indexOf('genReviewToken()');
  return iGet >= 0 && iGen >= 0 && iGet < iGen;
})());
ok('H5 read-back preservado (HOTFIX link órfão mantido)',
  SRC_ENSURE.includes('const chk=await ref.get();') && SRC_ENSURE.includes('nao confirmado no Firestore'));

console.log(`\nRESULTADO: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
