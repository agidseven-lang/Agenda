/**
 * F3.5.4L — gerador DETERMINÍSTICO dos dois sons locais do lembrete central de SLA.
 * =====================================================================================
 * Produz src/renderer/sounds/sla-warning.wav e sla-critical.wav como WAV PCM 16-bit mono
 * 44.1 kHz, a partir de sequências de tons senoidais com envelope (fade in/out curto p/ não
 * estourar). SEM IA generativa, SEM voz humana, SEM rede — matemática pura e reprodutível
 * (mesma entrada ⇒ mesmos bytes). Rodar: `node scripts/f354l-gen-sounds.mjs`.
 *
 * Identidade sonora:
 *  - AVISO (amarelo): dois toques suaves ascendentes/descendentes (740→600 Hz) — "atenção".
 *  - CRÍTICO (vermelho): três toques mais firmes e um pouco mais altos (880→660→880 Hz) — "urgente".
 * Ambos curtos (≈0,6–0,9 s), tocados UMA vez pela janela ao abrir/promover (o loop é proibido).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "src", "renderer", "sounds");

const SR = 44100;      // sample rate
const AMP = 0.62;      // pico (headroom p/ não clipar)

// Gera amostras (Float) de uma sequência de segmentos {freq, ms, gap?}.
function synth(segments) {
  const samples = [];
  for (const seg of segments) {
    const n = Math.round((seg.ms / 1000) * SR);
    const fadeN = Math.min(Math.round(0.008 * SR), Math.floor(n / 2)); // 8ms fade in/out
    for (let i = 0; i < n; i++) {
      let env = 1;
      if (i < fadeN) env = i / fadeN;
      else if (i > n - fadeN) env = (n - i) / fadeN;
      // envelope de decaimento suave ao longo do tom (mais "sino", menos "buzina")
      const decay = Math.exp(-3 * (i / n));
      const s = Math.sin(2 * Math.PI * seg.freq * (i / SR)) * AMP * env * decay;
      samples.push(s);
    }
    const gap = Math.round(((seg.gap || 0) / 1000) * SR);
    for (let i = 0; i < gap; i++) samples.push(0);
  }
  return samples;
}

function toWavBuffer(samples) {
  const dataLen = samples.length * 2; // 16-bit
  const buf = Buffer.alloc(44 + dataLen);
  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  // fmt chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);          // PCM chunk size
  buf.writeUInt16LE(1, 20);           // PCM format
  buf.writeUInt16LE(1, 22);           // mono
  buf.writeUInt32LE(SR, 24);          // sample rate
  buf.writeUInt32LE(SR * 2, 28);      // byte rate (SR * blockAlign)
  buf.writeUInt16LE(2, 32);           // block align (mono * 16-bit)
  buf.writeUInt16LE(16, 34);          // bits per sample
  // data chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    let v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), off);
    off += 2;
  }
  return buf;
}

const WARNING = [
  { freq: 740, ms: 180, gap: 70 },
  { freq: 600, ms: 240, gap: 0 },
];
const CRITICAL = [
  { freq: 880, ms: 160, gap: 60 },
  { freq: 660, ms: 160, gap: 60 },
  { freq: 880, ms: 300, gap: 0 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const warnBuf = toWavBuffer(synth(WARNING));
const critBuf = toWavBuffer(synth(CRITICAL));
fs.writeFileSync(path.join(OUT_DIR, "sla-warning.wav"), warnBuf);
fs.writeFileSync(path.join(OUT_DIR, "sla-critical.wav"), critBuf);
console.log("sla-warning.wav  bytes=" + warnBuf.length);
console.log("sla-critical.wav bytes=" + critBuf.length);
console.log("OK: sons locais gerados em " + OUT_DIR);
