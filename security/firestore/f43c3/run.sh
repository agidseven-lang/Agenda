#!/usr/bin/env bash
# =====================================================================
# F4.3C3 — Runner do Emulator Suite (local + CI). SEM deploy, SEM produção.
# Sobe o Firestore Emulator (JAR standalone), roda os testes das Rules e
# derruba o emulador. Project ID FICTÍCIO: demo-agenda-id-seven-f43c3.
# NUNCA usa credenciais de produção / service account real / dados reais.
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")"

PROJECT_ID="demo-agenda-id-seven-f43c3"
HOST="127.0.0.1"
PORT="8080"
JAR="firestore-emu.jar"
EMU_VER="1.19.8"
JAR_URL="https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v${EMU_VER}.jar"

# Guard: jamais rodar com credenciais reais no ambiente.
if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  echo "::error:: GOOGLE_APPLICATION_CREDENTIALS presente — abortando (esta fase é emulador-only, sem produção)."; exit 1
fi
export FIRESTORE_EMULATOR_HOST="${HOST}:${PORT}"
export GCLOUD_PROJECT="$PROJECT_ID"

if [ ! -f "$JAR" ]; then
  echo "[run] baixando emulator JAR v${EMU_VER}..."
  curl -fsSL --max-time 180 -o "$JAR" "$JAR_URL" || { echo "::error:: falha ao baixar o JAR do emulador"; exit 1; }
fi

echo "[run] iniciando Firestore Emulator em ${HOST}:${PORT} (project ${PROJECT_ID})..."
java -jar "$JAR" --host "$HOST" --port "$PORT" >emulator.log 2>&1 &
EMU_PID=$!
cleanup() { kill "$EMU_PID" 2>/dev/null; wait "$EMU_PID" 2>/dev/null; }
trap cleanup EXIT

up=0
for i in $(seq 1 60); do
  if curl -fsS --max-time 2 -o /dev/null "http://${HOST}:${PORT}/" 2>/dev/null; then up=1; echo "[run] emulador no ar após ${i}s"; break; fi
  sleep 1
done
[ "$up" = "1" ] || { echo "::error:: emulador não subiu"; tail -20 emulator.log; exit 1; }

echo "[run] executando testes das Rules..."
node tests/run-all.mjs
RC=$?
echo "[run] RC=$RC"
exit $RC
