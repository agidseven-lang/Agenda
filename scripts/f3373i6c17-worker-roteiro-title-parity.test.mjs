#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C17 — Testes HERMÉTICOS (texto/fonte + micro-exec) da PARIDADE de
   TÍTULO do ROTEIRO no Worker/Card Premium/portal/OG:
     - premiumTypeOf(task) resolve o tipo pelos DADOS REAIS (task.sector) —
       nunca heurística de texto; sem task → cronograma (fallback byte-idêntico);
     - /share/cronograma/<token> e /cliente/cronograma/<token> PRESERVADOS
       (nenhuma rota nova; formato do link do Desktop 1.0.165 inalterado);
     - OG/portal/preview do ROTEIRO exibem "Roteiro de gravação de vídeos" /
       "Aprovar roteiro"; CRONOGRAMA preserva TODOS os textos EXATOS;
     - aprovação do cliente inalterada (mesmas ações/rotas/semântica);
     - versão V64.59-c17-roteiro-title-parity compatível com os gates do
       deploy-worker.yml (prefixo V64.59).
   Lê cloudflare-worker.js/wrangler.toml como TEXTO — NÃO rede, NÃO deploy,
   NÃO escreve. Micro-exec extrai funções puras reais (brace-balanced).
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'cloudflare-worker.js'), 'utf8');
const TOML = fs.readFileSync(path.resolve(__dirname, '..', 'wrangler.toml'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

// extratores (brace-balanced) — mesmos padrões dos harnesses da casa
function fnSrc(name) { const re = new RegExp('(?:async )?function ' + name + '\\s*\\('); const m = SRC.match(re); if (!m) throw new Error('fn ' + name);
  let st = SRC.indexOf(m[0]), d = 0, i = SRC.indexOf('{', st);
  for (let j = i; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); } } throw new Error('sem fecho ' + name); }
function constObj(name) { const st = SRC.indexOf('const ' + name + ' = {'); if (st < 0) throw new Error('const ' + name);
  let d = 0; for (let j = SRC.indexOf('{', st); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 2); } } throw new Error('sem fecho ' + name); }
const constLine = (name) => { const m = SRC.match(new RegExp('const ' + name + ' = "[^"]*";')); if (!m) throw new Error('const ' + name); return m[0]; };

console.log('F3.3.73I6C17 — Worker Roteiro ↔ Card Premium TITLE parity (hermético)');

/* ── A: versão compatível com os gates do deploy pinado ── */
ok('A1 versão V64.59-* no GET / (linha canônica; sufixo da fase atual = c20)', /version: "V64\.59-c20-golden-contract"/.test(SRC));
ok('A2 compatível com gate pré-deploy (grep version: "V64.59)', /version: *"V64\.59/.test(SRC));

/* ── B: resolução de tipo pelos DADOS REAIS (micro-exec) ── */
const CORE = constLine('OG_IMG_PATH') + '\n' + constLine('OG_IMG_PATH_ROTEIRO') + '\n' + constObj('PREMIUM_TYPES') + '\n' + fnSrc('premiumTypeOf') + '\n' +
  fnSrc('escapeHtml') + '\n' + fnSrc('ogClientBase') + '\n' + fnSrc('ogClientMeta') + '\n' +
  fnSrc('shareCardHtml') + '\n' + fnSrc('crawlerCardHtml') + '\n' + fnSrc('phaseCopy') + '\n' + fnSrc('frequencyLabel') + '\n';
const API = new Function(CORE + 'return {premiumTypeOf,PREMIUM_TYPES,shareCardHtml,crawlerCardHtml,phaseCopy,frequencyLabel,ogClientMeta};')();
ok('B1 premiumTypeOf({sector:"roteiro"}) = roteiro', API.premiumTypeOf({ sector: 'roteiro' }).key === 'roteiro');
ok('B2 premiumTypeOf({sector:"cronograma"}) = cronograma', API.premiumTypeOf({ sector: 'cronograma' }).key === 'cronograma');
ok('B3 sem task / sem sector / outros setores → cronograma (fallback seguro)',
  API.premiumTypeOf(null).key === 'cronograma' && API.premiumTypeOf({}).key === 'cronograma' &&
  API.premiumTypeOf({ sector: 'edicao_midia' }).key === 'cronograma');
ok('B4 tolera caixa/espaço ("  ROTEIRO ")', API.premiumTypeOf({ sector: '  ROTEIRO ' }).key === 'roteiro');
ok('B5 detecção pelos dados reais — NENHUMA heurística por texto de título', !/task\.title[^\n]*roteiro/i.test(SRC));

/* ── C: /share — OG do WhatsApp (micro-exec byte-parity) ── */
const shareCron = API.shareCardHtml('https://aprovar.agendaidseven.com.br', 'tok123');
ok('C1 cronograma PRESERVADO: og:title "Aprovar cronograma" (sem ptype = default)',
  shareCron.includes('<meta property="og:title" content="Aprovar cronograma"/>'));
ok('C2 cronograma PRESERVADO: desc EXATA "Seu cronograma está pronto para avaliação."',
  shareCron.includes('<meta property="og:description" content="Seu cronograma está pronto para avaliação."/>'));
ok('C3 cronograma PRESERVADO: og:image:alt EXATO', shareCron.includes('<meta property="og:image:alt" content="Agenda ID Seven — Aprovar cronograma"/>'));
const shareRot = API.shareCardHtml('https://aprovar.agendaidseven.com.br', 'tok123', API.PREMIUM_TYPES.roteiro);
ok('C4 roteiro: og:title "Aprovar roteiro"', shareRot.includes('<meta property="og:title" content="Aprovar roteiro"/>'));
ok('C5 roteiro: desc "Seu Roteiro de gravação de vídeos está pronto para avaliação."',
  shareRot.includes('<meta property="og:description" content="Seu Roteiro de gravação de vídeos está pronto para avaliação."/>'));
ok('C6 roteiro: og:image:alt "Agenda ID Seven — Aprovar roteiro"', shareRot.includes('og:image:alt" content="Agenda ID Seven — Aprovar roteiro"'));
ok('C7 /share via handleShareCard com CONTRATO C20 (resolved→card do tipo; not_found/error→página explícita, sem fallback de tipo)',
  /shareMatch && \(request\.method === "GET" \|\| request\.method === "HEAD"\)[\s\S]{0,400}handleShareCard\(request, env, ctx, url, shareMatch\[1\]\)/.test(SRC) &&
  /async function handleShareCard\(request, env, ctx, url, token\)[\s\S]{0,2400}queryTaskByToken\(env, at, token\)[\s\S]{0,2200}if \(!resolved\) \{[\s\S]{0,900}shareUnavailableHtml\(url\.origin, state\)/.test(SRC) &&
  /htmlResponseCacheable\(shareCardHtml\(url\.origin, token, ptype\), 200\)/.test(SRC));
ok('C8 rota /share/cronograma INALTERADA (mesmo regex; nenhuma rota nova de share)',
  /\/\^\\\/share\\\/cronograma\\\/\(\[A-Za-z0-9_-\]\{4,128\}\)\\\/\?\$\//.test(SRC) && !/share\\\/roteiro/.test(SRC));
ok('C9 cache do /share INALTERADO (public, max-age=600 no htmlResponseCacheable)',
  /"Cache-Control": "public, max-age=600"/.test(SRC));

/* ── D: crawler do /cliente (card premium com nome do cliente) ── */
const crawlCron = API.crawlerCardHtml('https://aprovar.agendaidseven.com.br', 'Hospital Visão', 'tok123');
ok('D1 cronograma PRESERVADO: título "Aprovar cronograma — <cliente>" + desc dos TEMAS exata',
  crawlCron.includes('og:title" content="Aprovar cronograma — Hospital Visão"') &&
  crawlCron.includes('Sua área de aprovação está pronta. Toque para revisar os temas, aprovar o que estiver correto e solicitar ajustes.'));
const crawlRot = API.crawlerCardHtml('https://aprovar.agendaidseven.com.br', 'Hospital Visão', 'tok123', API.PREMIUM_TYPES.roteiro);
ok('D2 roteiro: título "Aprovar roteiro — <cliente>" + desc "Roteiro de gravação de vídeos…roteiros"',
  crawlRot.includes('og:title" content="Aprovar roteiro — Hospital Visão"') &&
  crawlRot.includes('Seu Roteiro de gravação de vídeos está pronto. Toque para revisar os roteiros'));
ok('D3 handler do crawler resolve ptype da task carregada', /handleClientCronogramaCrawler[\s\S]{0,700}if \(task\) ptype = premiumTypeOf\(task\);[\s\S]{0,200}crawlerCardHtml\(origin, client, token, ptype\)/.test(SRC));

/* ── E: portal (renderClientHtml) — heading/título por tipo ── */
ok('E1 pt = premiumTypeOf(task) no renderClientHtml', /function renderClientHtml\(task, token, env, origin\) \{\n  const pt = premiumTypeOf\(task\);/.test(SRC));
ok('E2 ogTitle dinâmico + <title> com sufixo por tipo',
  /const ogTitleRaw = pt\.aprLabel \+ " — " \+ \(task\.client \|\| "Cliente"\);/.test(SRC) &&
  /<title>' \+ ogTitle \+ ' · ' \+ pt\.docSuffix \+ '<\/title>/.test(SRC));
ok('E3 phaseUi = phaseCopy(phase, pt) + pill Frequência/Quantidade por tipo',
  /const phaseUi = phaseCopy\(phase, pt\);/.test(SRC) && /<span class="mv">' \+ pt\.freqPill \+ '<\/span>/.test(SRC));
ok('E4 vocabulário PT injetado no JS do portal + default seguro no CV_JS',
  /var PT=' \+ JSON\.stringify\(\{ o: pt\.jsO, em: pt\.jsEm, de: pt\.jsDo, seu: pt\.jsSeu, deste: pt\.jsDeste, itens: pt\.itensWord \}\)/.test(SRC) &&
  /var PT=\(typeof PT==='object'&&PT&&PT\.o\)\?PT:\{o:'o cronograma',em:'no cronograma',de:'do cronograma',seu:'seu cronograma',deste:'deste cronograma',itens:'temas'\};/.test(SRC));
const pcCron = API.phaseCopy('themes'); const pcRot = API.phaseCopy('themes', API.PREMIUM_TYPES.roteiro);
const pfCron = API.phaseCopy('final'); const pfRot = API.phaseCopy('final', API.PREMIUM_TYPES.roteiro);
ok('E5 phaseCopy cronograma PRESERVADO (themes/final EXATOS)',
  pcCron.kicker === 'Aprovação de temas' && pcCron.cta === 'Aprovar temas' &&
  pcCron.sub === 'Você está aprovando apenas os temas. A equipe seguirá com a produção (designer + legendas + posts).' &&
  pfCron.title === 'Aprovação final do cronograma');
ok('E6 phaseCopy roteiro: heading exibe "Roteiro de gravação de vídeos" + CTA "Aprovar roteiros"',
  pcRot.title === 'Roteiro de gravação de vídeos' && pcRot.kicker === 'Aprovação de roteiros' && pcRot.cta === 'Aprovar roteiros' &&
  pfRot.title === 'Aprovação final do Roteiro de gravação de vídeos');
ok('E7 phaseCopy production INALTERADO p/ ambos', API.phaseCopy('production').title === 'Aprovação de legendas e artes' &&
  API.phaseCopy('production', API.PREMIUM_TYPES.roteiro).title === 'Aprovação de legendas e artes');
const fqC = API.frequencyLabel({ freq: 'semanal' }); const fqC2 = API.frequencyLabel({});
ok('E8 frequencyLabel cronograma PRESERVADO (Semanal; fallback "Cronograma")', fqC === 'Semanal' && fqC2 === 'Cronograma');
ok('E9 frequencyLabel roteiro: q4/q8/q12 → "N roteiros"; fallback "Roteiro"',
  API.frequencyLabel({ cronSub: 'q4' }, API.PREMIUM_TYPES.roteiro) === '4 roteiros' &&
  API.frequencyLabel({ cronSub: 'q12' }, API.PREMIUM_TYPES.roteiro) === '12 roteiros' &&
  API.frequencyLabel({}, API.PREMIUM_TYPES.roteiro) === 'Roteiro');

/* ── F: páginas de ack/sucesso + histórico ── */
ok('F1 ack: h2/msg/next por tipo (cronograma "Temas aprovados!" EXATO na tabela)',
  /ackH2Themes: "Temas aprovados!"/.test(SRC) && /ackH2Themes: "Roteiros aprovados!"/.test(SRC) &&
  /const h2 = isThemes \? pt\.ackH2Themes : "Legendas e artes aprovadas!";/.test(SRC));
ok('F2 sucesso: h1 por tipo (cronograma EXATO; roteiro "Roteiro de gravação de vídeos aprovado com sucesso!")',
  /successH1: "Cronograma aprovado com sucesso!"/.test(SRC) && /successH1: "Roteiro de gravação de vídeos aprovado com sucesso!"/.test(SRC) &&
  /'<h1>' \+ pt\.successH1 \+ '<\/h1>'/.test(SRC));
ok('F3 histórico do portal por tipo (Aprovou/Comentou + "Roteiro N")',
  /approve: \["hb-ok", ICN\.check, pt\.histApprove\]/.test(SRC) && /comment: \["hb-note", ICN\.note, pt\.histComment\]/.test(SRC) &&
  /pt\.itemName \+ " " \+ \(Number\(a\.contentIndex\) \+ 1\)/.test(SRC));

/* ── G: aprovação do cliente PRESERVADA (semântica intocada) ── */
ok('G1 ações permitidas INALTERADAS (approve/approveAll/revision/edit_request + granulares)',
  /"approve", "approveAll", "revision", "edit_request",/.test(SRC) && /"approveItem", "reviseItem", "editTheme", "editLegenda", "noteItem", "comment",/.test(SRC));
ok('G2 labels de histórico por TIPO na action (cronograma EXATO preservado)',
  /actApproveLabel: "Cliente aprovou os temas\/cronograma"/.test(SRC) && /actApproveLabel: "Cliente aprovou os roteiros"/.test(SRC) &&
  /label: _pt\.actApproveLabel/.test(SRC) && /label: _pt\.actCommentLabel/.test(SRC) &&
  /label: "Cliente aprovou a entrega final"/.test(SRC));
ok('G3 rotas do portal/action/state/team-action INALTERADAS',
  /\/\^\\\/cliente\\\/cronograma\\\/\(\[A-Za-z0-9_-\]\{4,128\}\)\\\/\?\$\//.test(SRC) &&
  /\\\/action\\\/\?\$\//.test(SRC) && /\\\/state\\\/\?\$\//.test(SRC) && /\\\/team-action\\\/\?\$\//.test(SRC) && !/cliente\\\/roteiro/.test(SRC));
ok('G4 gate de conclusão final INTOCADO (finalApprovalCompleted só em g.client==="concluido")',
  /if \(g\.client === "concluido"\) \{[\s\S]*?finalApprovalCompleted = \{ booleanValue: true \}/.test(SRC));

/* ── H: notificações do cliente por tipo (tabela canônica preservada) ── */
ok('H1 NOTIFY_EVENTS canônico EXATO preservado (2 âncoras do cronograma)',
  /themes_sent_to_client:\s*\{[^}]*title: "Cronograma disponível para análise"/.test(SRC) &&
  /final_approved_by_client:\s*\{[^}]*title: "Cronograma finalizado"/.test(SRC));
ok('H2 override por TIPO só p/ roteiro (Object.assign; fase/destino inalterados)',
  /const _ovr = premiumTypeOf\(task\)\.notif;/.test(SRC) && /if \(_ovr && _ovr\[eventType\]\) ev = Object\.assign\(\{\}, ev, _ovr\[eventType\]\);/.test(SRC) &&
  /title: "Roteiro finalizado", body: "Seu Roteiro de gravação de vídeos foi aprovado com sucesso\."/.test(SRC));

/* ── I: WhatsApp Cloud API (rota avançada) ── */
ok('I1 buildPremiumCaption por tipo: roteiro = "Roteiro de gravação de vídeos"; cronograma EXATO preservado',
  /const tdc = \(ptype && ptype\.key === "roteiro"\)\s*\n?\s*\? "Roteiro de gravação de vídeos"\s*\n?\s*: \(!t \? "cronograma" : \(t\.indexOf\("cronograma"\) >= 0 \? t : \("cronograma " \+ t\)\)\);/.test(SRC) &&
  /buildPremiumCaption\(clientName, tipo, link, premiumTypeOf\(task\)\)/.test(SRC));
ok('I2 contrato de erro do Desktop INALTERADO (CRONOGRAMA_NAO_ENCONTRADO)', /CRONOGRAMA_NAO_ENCONTRADO/.test(SRC));

/* ── J: escopo/beira de segurança ── */
ok('J1 wrangler.toml INTOCADO nesta fase (idseven-push + main + vars WhatsApp/VAPID presentes; sem SLA)',
  /name = "idseven-push"/.test(TOML) && /main = "cloudflare-worker\.js"/.test(TOML) &&
  /WHATSAPP_PHONE_NUMBER_ID/.test(TOML) && /VAPID_SUBJECT/.test(TOML) && !/SLA_ENGINE_ENABLED|SLA_WRITE|SLA_ACTIVATED_AT/.test(TOML));
ok('J2 rotas /sla-* seguem gated (403 sem env — deploy gate exige)', /sla-dryrun/.test(SRC) && /403/.test(SRC));
ok('J3 nenhum segredo novo/log de token (sem console.log de accessToken/privateKey)',
  !/console\.log\([^)]*accessToken/.test(SRC) && !/console\.log\([^)]*PRIVATE_KEY/.test(SRC));
ok('J4 detecção de tipo NÃO altera queryTaskByToken (clientReviewToken→shareToken preservado)',
  /for \(const field of \["clientReviewToken", "shareToken"\]\)/.test(SRC));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
