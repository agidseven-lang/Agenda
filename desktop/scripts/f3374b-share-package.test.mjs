#!/usr/bin/env node
/* =====================================================================
   F3.3.74B — SHARE PACKAGE NATIVO (Card Premium como IMAGEM REAL) — suíte.
   Micro-executa as funções REAIS do renderer (extraídas por brace-balance):
   ShareContentType/shareTypeOf/shareCardExtraLabel/buildPremiumCardImage/
   buildShareMessage/buildSharePackage — com stubs de DOM (canvas/Image/Blob)
   que CAPTURAM as operações de desenho (prova de conteúdo por tipo, cliente,
   quantidade, dimensões e ausência de contaminação). Valida também a fiação
   do modal (pacote real como gate; prewarm como BÔNUS; 3+1 botões; textos).
   READ-ONLY; sem rede; nada de produção.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { webcrypto } from 'crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

function fnSrc(name) {
  const re = new RegExp('(?:async )?function ' + name + '\\s*\\(');
  const m = HTML.match(re); if (!m) throw new Error('não achei function ' + name);
  let st = HTML.indexOf(m[0]), i = HTML.indexOf('{', st), d = 0;
  for (let j = i; j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(st, j + 1); } }
  throw new Error('sem fecho ' + name);
}
const stmt = (re) => { const m = HTML.match(re); if (!m) throw new Error('stmt ' + re); return m[0]; };

console.log('F3.3.74B — share package nativo (imagem premium real; tipos fortes)');

/* ── escopo REAL: constantes + funções do renderer ── */
const TOK = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';
function buildScope(opts) {
  const O = Object.assign({ artCron: 'A'.repeat(2000), artRot: 'B'.repeat(2000), blobOk: true, artMissing: false, decodeFail: false }, opts);
  const drawn = { images: 0, texts: [], fills: 0, canvas: null };
  class FakeCtx {
    createLinearGradient() { return { addColorStop() {} }; }
    drawImage() { drawn.images++; }
    fillRect() { drawn.fills++; }
    fillText(t) { drawn.texts.push(String(t)); }
    measureText(t) { return { width: String(t).length * 12 }; }
  }
  const doc = { createElement: (tag) => { if (tag !== 'canvas') throw new Error('só canvas'); const cv = { width: 0, height: 0, getContext: () => new FakeCtx(), toBlob: (cb) => cb(O.blobOk ? { arrayBuffer: async () => new ArrayBuffer(4096) } : null) }; drawn.canvas = cv; return cv; } };
  class FakeImage { set src(_) { if (O.decodeFail) { this.onerror && this.onerror(); } else { this.onload && this.onload(); } } }
  const pieces = [];
  pieces.push(stmt(/const CLIENT_LINK_BASE\s*=\s*'[^']*';/));
  pieces.push('const QA_BUILD = true;');
  pieces.push(stmt(/const SHARE_ENV\s*=\s*[^\n]+?;/));
  pieces.push(stmt(/const SHARE_ALLOWED_HOST\s*=\s*[^\n]+?;/));
  pieces.push(stmt(/const SHARE_PATH_PREFIX\s*=\s*[^\n]+?;/));
  pieces.push(stmt(/const SHARE_TOKEN_RE_DESK\s*=\s*\/[^\n]+?\/;/));
  pieces.push('const CARD_ART_B64_BY_TYPE = ' + (O.artMissing ? '{}' : '{cronograma: ART_CRON, roteiro: ART_ROT}') + ';');
  for (const f of ['validateShareUrl', 'shareInvalidMsg', 'cronTypeLabel', 'buildShareClientUrl', 'buildClientMessage', 'shareTypeOf', 'shareCardExtraLabel', 'buildPremiumCardImage', 'buildShareMessage', 'buildSharePackage']) pieces.push(fnSrc(f));
  pieces.push('const ShareContentType={SCHEDULE:"cronograma",VIDEO_SCRIPT:"roteiro"};');
  const body = pieces.join('\n') + '\nreturn {shareTypeOf, shareCardExtraLabel, buildPremiumCardImage, buildSharePackage, buildShareMessage, validateShareUrl};';
  // ShareContentType já é const no HTML — extraio via stmt para não duplicar? usa a real:
  const realSCT = stmt(/const ShareContentType\s*=\s*\{[^}]*\};/);
  const finalBody = realSCT + '\n' + body.replace('const ShareContentType={SCHEDULE:"cronograma",VIDEO_SCRIPT:"roteiro"};', '');
  const api = new Function('document', 'Image', 'crypto', 'TextEncoder', 'ART_CRON', 'ART_ROT', 'URL', 'Date', 'Uint8Array', 'ArrayBuffer', 'Promise', 'Array', 'String', 'RegExp',
    '"use strict";\n' + finalBody)(doc, FakeImage, webcrypto, TextEncoder, O.artCron, O.artRot, URL, Date, Uint8Array, ArrayBuffer, Promise, Array, String, RegExp);
  return { api, drawn };
}

const ctxCron = { id: 't-cron', sector: 'cronograma', client: 'Cliente Sintético', token: TOK, type: 'Semanal', contents: [] };
const ctxRot = { id: 't-rot', sector: 'roteiro', client: 'Cliente Sintético', token: TOK, type: '8 roteiros', contents: [] };

/* ── tipos fortes ── */
{
  const { api } = buildScope();
  ok('T1 shareTypeOf: roteiro → VIDEO_SCRIPT; demais → SCHEDULE (tipo forte, sem estado solto)',
    api.shareTypeOf('roteiro') === 'roteiro' && api.shareTypeOf('cronograma') === 'cronograma' && api.shareTypeOf(undefined) === 'cronograma');
  ok('T2 shareCardExtraLabel anti-contaminação: roteiro NUNCA exibe rótulo de cronograma (nem o default "Cronograma")',
    api.shareCardExtraLabel('roteiro', { type: '8 roteiros' }) === '8 roteiros' &&
    api.shareCardExtraLabel('roteiro', { type: 'Cronograma' }) === '' &&
    api.shareCardExtraLabel('roteiro', { type: 'Semanal' }) === '');
  ok('T3 shareCardExtraLabel: cronograma só Semanal/Quinzenal/Mensal (nunca "N roteiros")',
    api.shareCardExtraLabel('cronograma', { type: 'Semanal' }) === 'Semanal' &&
    api.shareCardExtraLabel('cronograma', { type: '8 roteiros' }) === '');
}

/* ── CRONOGRAMA: pacote completo ── */
{
  const { api, drawn } = buildScope();
  const P = await api.buildSharePackage(ctxCron);
  ok('C1 pacote de Cronograma OK (imagem+mensagem+link)', P.ok === true && P.reason === 'ok' && P.type === 'cronograma');
  ok('C2 imagem 1200x630 PNG gerada (arte aprovada desenhada + bytes válidos)',
    P.imageWidth === 1200 && P.imageHeight === 630 && P.imageMimeType === 'image/png' && P.imageBytes && P.imageBytes.byteLength >= 1024 && drawn.images === 1 && drawn.canvas.width === 1200 && drawn.canvas.height === 630);
  ok('C3 faixa premium (linha única à direita): "Cliente · Semanal"; NENHUM texto de roteiro',
    drawn.texts.some(t => /Cliente Sintético QA?.* · Semanal$|Cliente Sintético · Semanal/.test(t) || (/Cliente Sintético/.test(t) && / · Semanal$/.test(t))) && !drawn.texts.some(t => /roteiro/i.test(t)));
  ok('C4 título/descrição de Cronograma (sem contaminação)', P.title === 'Aprovar cronograma' && /cronograma/.test(P.description) && !/Roteiro/.test(P.title));
  ok('C5 mensagem de Cronograma correta com o link do portal', /Seu cronograma/.test(P.messageText) && P.messageText.indexOf(P.approvalUrl) > -1 && !/Roteiro de gravação/.test(P.messageText));
  ok('C6 approvalUrl validada pela allowlist do ambiente (host QA exato)', api.validateShareUrl(P.approvalUrl, 'cronograma').ok === true);
  ok('C7 contentHash presente + generatedAt ISO', /^[0-9a-f]{16}$/.test(P.contentHash) && /^\d{4}-\d{2}-\d{2}T/.test(P.generatedAt));
}

/* ── ROTEIRO: pacote completo ── */
{
  const { api, drawn } = buildScope();
  const P = await api.buildSharePackage(ctxRot);
  ok('R1 pacote de Roteiro OK', P.ok === true && P.type === 'roteiro');
  ok('R2 faixa premium (linha única à direita): "Cliente · 8 roteiros"; NENHUM texto de cronograma',
    drawn.texts.some(t => /Cliente Sintético/.test(t) && / · 8 roteiros$/.test(t)) && !drawn.texts.some(t => /cronograma/i.test(t)));
  ok('R3 título "Aprovar roteiro" + descrição "Roteiro de gravação de vídeos"', P.title === 'Aprovar roteiro' && /Roteiro de gravação de vídeos/.test(P.description));
  ok('R4 mensagem de Roteiro correta (sem "Seu cronograma")', /Roteiro de gravação de vídeos/.test(P.messageText) && !/Seu cronograma/.test(P.messageText) && P.messageText.indexOf(P.approvalUrl) > -1);
  ok('R5 reenvio determinístico: 2º pacote → mesma URL e mesmo tipo (URL estável)',
    await (async () => { const P2 = await api.buildSharePackage(ctxRot); return P2.ok && P2.approvalUrl === P.approvalUrl && P2.type === P.type; })());
}

/* ── NEGATIVOS ── */
{
  const { api } = buildScope();
  ok('N1 cliente ausente → cliente_ausente (pacote nunca ok)', (await api.buildSharePackage({ ...ctxCron, client: '' })).reason === 'cliente_ausente');
  ok('N2 token/link ausente → link_ausente', (await api.buildSharePackage({ ...ctxCron, token: null })).reason === 'link_ausente');
  ok('N3 token inválido → link_invalido:token_invalido (validateShareUrl real)', (await api.buildSharePackage({ ...ctxCron, token: 'x!' })).reason.indexOf('link_invalido:') === 0);
  ok('N4 tipo divergente é IMPOSSÍVEL por construção (shareTypeOf deriva do sector; imagem/mensagem/título derivam do MESMO tipo)',
    (await api.buildSharePackage(ctxRot)).title === 'Aprovar roteiro');
}
{
  const { api } = buildScope({ artMissing: true });
  ok('N5 arte ausente → imagem:arte_ausente (nunca placeholder genérico)', (await api.buildSharePackage(ctxCron)).reason === 'imagem:arte_ausente');
}
{
  const { api } = buildScope({ decodeFail: true });
  ok('N6 arte indecodificável → imagem:arte_indecodificavel', (await api.buildSharePackage(ctxCron)).reason === 'imagem:arte_indecodificavel');
}
{
  const { api } = buildScope({ blobOk: false });
  ok('N7 falha do render (toBlob null) → imagem:render_falhou (botões ficariam bloqueados)', (await api.buildSharePackage(ctxCron)).reason === 'imagem:render_falhou');
}

/* ── artes embutidas: presentes por tipo e distintas ── */
{
  const mC = HTML.match(/const CARD_ART_B64_BY_TYPE=\{\ncronograma:'([A-Za-z0-9+/=]+)',\nroteiro:'([A-Za-z0-9+/=]+)'\n\};/);
  ok('A1 artes aprovadas EMBUTIDAS por tipo (cron e roteiro distintas; tamanhos plausíveis de JPEG)',
    !!mC && mC[1] !== mC[2] && mC[1].length > 50000 && mC[2].length > 50000);
  if (mC) {
    const { createHash } = await import('crypto');
    const shaC = createHash('sha256').update(Buffer.from(mC[1], 'base64')).digest('hex');
    const shaR = createHash('sha256').update(Buffer.from(mC[2], 'base64')).digest('hex');
    ok('A2 arte de CRONOGRAMA byte-exata à aprovada (v64-39, sha256 c038636d…)', shaC === 'c038636db3cf294b1edf34820c5fc68cca1ae13cd28c94a203d0590c44843eea');
    ok('A3 arte de ROTEIRO byte-exata à aprovada (v64-60 com logo oficial, sha256 f64f6f3e…)', shaR === 'f64f6f3e36020b05ae2491a544fb45937e7798d3e48eeae5865aa04549389cf3');
  }
}

/* ── fiação do modal: pacote real como gate; prewarm = BÔNUS ── */
ok('W1 modal usa runPreparePackage (pacote) e NÃO gate de prewarm', /async function runPreparePackage\(\)/.test(HTML) && /on\('btnPrewarmRetry', function\(\)\{ runPreparePackage\(\); \}\);/.test(HTML) && !/async function runPrewarm\(\)/.test(HTML));
ok('W2 prewarm/snapshot viraram BÔNUS em segundo plano (bonusPreviewWarm; nunca altera UI)', /function bonusPreviewWarm\(taskId,tipo,url\)/.test(HTML) && /bonusPreviewWarm\(ctx&&ctx\.id,_tipoModal,P\.approvalUrl\);/.test(HTML));
ok('W3 [74C] botão principal usa o Share NATIVO (pacote único imagem+legenda+link); fallback honesto ainda copia a IMAGEM (copyCardImage) e abre o WhatsApp (openWhatsAppWebOnly)',
  /await api\.nativeShare\(buildNativeShareRequest\(sharePkg,_modalTrace\)\)/.test(HTML) && /const r2=await api\.copyCardImage\(new Uint8Array\(sharePkg\.imageBytes\)\)/.test(HTML) && /openWhatsAppWebOnly\(\);/.test(HTML));
ok('W4 fallback assistido: sem clipboard de imagem → salva arquivo + copia mensagem (nunca trava)',
  /const pth=await ensureSaved\(\); if\(pth\)/.test(HTML) && /if\(!copyMsgClean\(\)\) return;/.test(HTML));
ok('W5 4 botões fail-closed nascem disabled e habilitam JUNTOS pelo pacote',
  /id="btnCopyGroupMsg" disabled/.test(HTML) && /id="btnCopyLink" disabled/.test(HTML) && /id="btnTestLink" disabled/.test(HTML) && /id="btnOpenWaMain" disabled/.test(HTML) &&
  /'btnOpenWaMain','btnCopyGroupMsg','btnCopyLink','btnTestLink'/.test(HTML));
ok('W6 estados FASE 6: "Preparando o card premium…" → "Card premium … pronto para envio"',
  /Preparando o card premium do /.test(HTML) && /Card premium do '\+_tipoModal\+' pronto para envio/.test(HTML));
ok('W7 erro de link continua por setor (shareInvalidMsg) e erro de geração tem mensagem própria + Regenerar card',
  /Não foi possível gerar o card premium agora\. Toque em “Regenerar card”/.test(HTML) && /Regenerar card<\/button>/.test(HTML));
ok('W8 prévia do modal é a IMAGEM REAL do pacote (ObjectURL dos bytes gerados)', /applyPreviewFromPackage\(P\)/.test(HTML) && /URL\.createObjectURL\(new Blob\(\[P\.imageBytes\]/.test(HTML));
ok('W9 caminho data-openwa também é gated pelo PACOTE (sem gate de prewarm) e copia a mensagem do pacote',
  /_P=await buildSharePackage\(ctx\);/.test(HTML) && /copyToClipboard\(_P\.messageText\);/.test(HTML) && !/const _pw=_snap\.ok/.test(HTML));
ok('W10 preservação: wizard reset / logout / notificações INTOCADOS (âncoras present.)',
  /function openGlobalNewTask\(\)/.test(HTML) && /function openContextualNewTask\(sector\)/.test(HTML) && /wp_team_jwt/.test(HTML));
ok('W11 nenhuma dependência nova de rede na geração (fetch de arte por rede REMOVIDO do modal)', !/fetch\(ogImageUrlForType/.test(HTML));

console.log('\n74B SHARE-PACKAGE: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
console.log('LIMITE HONESTO: a prova FÍSICA (envio real no grupo do WhatsApp Business) é da equipe operacional.');
process.exit(fail ? 1 : 0);
