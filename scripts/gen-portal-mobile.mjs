// Gera o PORTAL REAL (renderClientHtml extraído do Worker V64.51) para teste mobile local.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
const SRC = readFileSync(new URL('../cloudflare-worker.js',import.meta.url),'utf8');
function fn(name){
  const re=new RegExp('(?:async )?function '+name+'\\s*\\([^)]*\\)\\s*\\{');
  const m=SRC.match(re); if(!m)throw new Error('FN NF '+name);
  let s=SRC.indexOf(m[0]),d=0;
  for(let i=s+m[0].length-1;i<SRC.length;i++){const c=SRC[i];if(c==='{')d++;else if(c==='}'){d--;if(d===0)return SRC.slice(s,i+1);}}
}
function cobj(name){ // const X = {...};
  const re=new RegExp('const '+name+' = \\{');
  const m=SRC.match(re); if(!m)throw new Error('CONST NF '+name);
  let s=SRC.indexOf(m[0]),d=0;
  for(let i=s+m[0].length-1;i<SRC.length;i++){const c=SRC[i];if(c==='{')d++;else if(c==='}'){d--;if(d===0)return SRC.slice(s,i+2);}}
}
function ctpl(name){ // const X = `...`;
  const re=new RegExp('const '+name+' = `');
  const m=SRC.match(re); if(!m)throw new Error('TPL NF '+name);
  const s=SRC.indexOf(m[0]);
  const e=SRC.indexOf('`;',s+m[0].length);
  return SRC.slice(s,e+2);
}
const CV_LOGO_LINE=(SRC.match(/const CV_LOGO = '[^\n]*';/)||[])[0];
const OGDEF=(SRC.match(/const OG_IMG_PATH = '[^\n]*';/)||['const OG_IMG_PATH="/og/wa-card-v64-38.jpg";'])[0];
const pieces=[OGDEF,
  cobj('ICN'), CV_LOGO_LINE, ctpl('CV_CSS'), ctpl('CV_JS'),
  fn('escapeHtml'), fn('frequencyLabel'), fn('clientPhase'), fn('statusLabel'),
  fn('phaseCopy'), fn('clientAckedPhase'), fn('ogClientBase'), fn('ogClientMeta'),
  fn('renderClientHtml'),
].join('\n');
const mod=new Function(pieces+'\nreturn {renderClientHtml};')();
const task={
  id:'t-mobile', client:'Hospital Visão', title:'Cronograma Semanal · Feed',
  clientApprovalPhase:'themes', clientFlowStatus:'enviado', cronStatus:'enviado_cliente',
  clientReviewToken:'tok_mobile_e2e_123', clientSentBy:'jm',
  cronContents:[{tema:'Catarata'},{tema:'Lentes premium'},{tema:'Glaucoma'}],
  clientItems:{}, history:[], updatedAt:Date.now(),
};
const env={ENABLE_CLIENT_WEB_PUSH:'true', VAPID_PUBLIC_KEY:'B'+'x'.repeat(86)};
const html=mod.renderClientHtml(task,'tok_mobile_e2e_123',env,'https://aprovar.agendaidseven.com.br');
writeFileSync('/tmp/audit/portal-mobile.html',html);
console.log('OK portal real gerado:',html.length,'bytes | gate JS?',html.includes('pushGateShow'),'| 3-estados?',html.includes('reviewNext'),'| pointer-events?',html.includes('pointer-events:none'));
