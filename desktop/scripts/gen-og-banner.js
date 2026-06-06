const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
function logo(x,y,s){return `<g transform="translate(${x},${y}) scale(${s/96})">
<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#c64bd8"/></linearGradient></defs>
<circle cx="48" cy="48" r="43" fill="none" stroke="url(#lg)" stroke-width="7"/><circle cx="48" cy="48" r="29" fill="#22d3b8"/>
<rect x="34" y="38" width="28" height="20" rx="3" fill="#fff"/><rect x="42" y="60" width="12" height="3" rx="1.5" fill="#fff"/>
<rect x="38" y="43" width="20" height="2.4" rx="1.2" fill="#0c2f2a"/><rect x="38" y="47.5" width="14" height="2.4" rx="1.2" fill="#0c2f2a"/><rect x="38" y="52" width="17" height="2.4" rx="1.2" fill="#0c2f2a"/></g>`;}
function check(cx,cy){return `<path d="M ${cx-9} ${cy} l 6 7 l 12 -15" fill="none" stroke="#34D399" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;}
function lock(x,y){return `<g transform="translate(${x},${y})"><rect x="0" y="9" width="22" height="16" rx="3.5" fill="#cdd6ff"/><path d="M4 9 V6 a7 7 0 0 1 14 0 V9" fill="none" stroke="#cdd6ff" stroke-width="3"/><circle cx="11" cy="16.5" r="2.6" fill="#0d1226"/></g>`;}
function banner(cliente, tipo){
  const FF='Liberation Sans';
  const nameLine = cliente ? `<text x="80" y="368" font-family="${FF}" font-size="50" font-weight="bold" fill="#d8fff4">${cliente}</text>` : '';
  const subY = cliente ? 422 : 372;
  const rows = ['Tema 1','Tema 2','Tema 3'].map((t,i)=>{const ry=220+i*58;return `
    <rect x="836" y="${ry}" width="260" height="46" rx="12" fill="#ffffff" fill-opacity="0.07"/>
    <rect x="850" y="${ry+10}" width="26" height="26" rx="8" fill="#7c5cff"/>
    <text x="890" y="${ry+30}" font-family="${FF}" font-size="17" font-weight="bold" fill="#eef1ff">${t}</text>
    ${check(1068,ry+23)}`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d5cff"/><stop offset="0.45" stop-color="#8b3df0"/><stop offset="1" stop-color="#1fb6c9"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="-40" r="380" fill="#ffffff" fill-opacity="0.08"/>
  <circle cx="120" cy="660" r="320" fill="#000000" fill-opacity="0.10"/>
  ${logo(80,56,80)}
  <text x="178" y="92" font-family="${FF}" font-size="30" font-weight="bold" fill="#ffffff">Agenda ID Seven</text>
  <text x="178" y="120" font-family="${FF}" font-size="18" fill="#e7ecff">Visão do Cliente</text>
  <rect x="80" y="168" width="372" height="46" rx="23" fill="#ffffff" fill-opacity="0.16"/>
  <text x="103" y="198" font-family="${FF}" font-size="17" font-weight="bold" fill="#ffffff">APROVAÇÃO DE CRONOGRAMA</text>
  <text x="80" y="298" font-family="${FF}" font-size="62" font-weight="bold" fill="#ffffff">Aprovar cronograma</text>
  ${nameLine}
  <text x="80" y="${subY}" font-family="${FF}" font-size="25" fill="#eef1ff">Sua área de aprovação está pronta.</text>
  <text x="80" y="${subY+34}" font-family="${FF}" font-size="25" fill="#eef1ff">Revise os temas, aprove e solicite ajustes.</text>
  <rect x="80" y="${subY+62}" width="366" height="72" rx="16" fill="#ffffff"/>
  <text x="110" y="${subY+108}" font-family="${FF}" font-size="26" font-weight="bold" fill="#5b2bd0">Revisar e aprovar  →</text>
  <rect x="812" y="150" width="308" height="332" rx="24" fill="#0d1226" fill-opacity="0.93" stroke="#ffffff" stroke-opacity="0.18"/>
  ${lock(840,168)} <text x="872" y="192" font-family="${FF}" font-size="17" font-weight="bold" fill="#cdd6ff">Visão do Cliente</text>
  ${rows}
  </svg>`;
}
function render(svg,out){const r=new Resvg(svg,{fitTo:{mode:'width',value:1200},font:{loadSystemFonts:true}});const png=r.render().asPng();fs.writeFileSync(out,png);return png.length;}
const out='/home/user/Agenda/desktop/scripts';
console.log('named:',render(banner('Hospital Visão','semanal'),out+'/og-banner-named.png'),'generic:',render(banner('','semanal'),out+'/og-banner-generic.png'));
