# BASELINE FREEZE — Desktop 1.0.163 (sem code signing)

Fase **F3.3.73I6C12** — congelamento oficial do estado atual por decisão do owner.
**Somente documentação** — sem build, deploy, release, tag, código.

## Decisão do owner
- **Não** pagar certificação; **não** usar Azure Trusted Signing; **não** comprar OV/EV; **não** avançar com assinatura de EXE.
- **Manter o sistema como está.**
- **Versão atual de trabalho/validação: Desktop 1.0.163.**
- **Qualquer** correção/ajuste/atualização futura **deve subir para Desktop 1.0.164.**
- **Frente de code signing: ENCERRADA.**

## Estado congelado (referência)
| Item | Valor |
|---|---|
| **Baseline atual (uso/validação)** | **Desktop 1.0.163** — build **diagnóstico** (auth/logout diag + fix do tray), **não** publicado como release |
| Procedência da 1.0.163 | run `29408726906` · fonte `7a45d90` (`desktop/f3373i6c11-auth-logout-tray-1.0.163`) |
| EXE 1.0.163 (SHA-256) | `5e366ca1b494aedf4c6a9e8f33c09967efdeb721822c9bc28b610be4034b4ea4` |
| MSI 1.0.163 (SHA-256) | `f0ea829fbb12271399b736089069ed0e3bcabd8a7c6934430a5c0abbaa3b3949` |
| Artifacts 1.0.163 | installer `8340227290` · bundle `8340232405` (retenção 30d) |
| **Última RELEASE publicada** | **Desktop 1.0.162** (`desktop/v1.0.162-production`, id 354094216) — produção controlada |
| Rollback de release | 1.0.159 (`desktop/v1.0.159-production`) |
| **Próxima versão obrigatória** | **Desktop 1.0.164** (para qualquer mudança futura) |

> Nota: a 1.0.163 é um build de **diagnóstico/validação** (não passou por publicação de release). A release oficial publicada segue sendo a 1.0.162. O owner adota a 1.0.163 como a versão atual em uso.

## Limitação conhecida — EXE não assinado (aceita pelo owner)
- O instalador **EXE não é assinado** (Authenticode). Consequência: **Mark-of-the-Web + SmartScreen/Defender** escaneiam o EXE antes de criar o processo → o **1º duplo clique pode não abrir de imediato** (às vezes exige aguardar/repetir). Causa raiz diagnosticada em F3.3.73I6C11A; o único fix real seria **assinatura de código** — **fora do escopo por decisão do owner**.
- **Mitigações operacionais (válidas e recomendadas):**
  1. **Usar o MSI** (`Agenda-ID-Seven-Desktop-1.0.163-x64.msi`) — roda por `msiexec` (assinado pela Microsoft), mais confiável.
  2. Com o EXE: **descompactar o ZIP** → clique-direito no `.exe` → **Propriedades → Desbloquear → OK** → **um** duplo clique e aguardar 10–30 s (não clicar de novo).
  3. Nunca executar o EXE de dentro do ZIP.
- SmartScreen também exibe "Publisher Unknown" / aviso na 1ª execução — **esperado** sem assinatura.

## Item aberto (não reaberto aqui)
- A investigação do **auto-login após logout** (F3.3.73I6C11) continua pendente da **evidência de campo**: o owner instalar a 1.0.163 (via MSI/desbloqueio) → reproduzir → enviar o log `idseven-notif-diag.log` (em `%APPDATA%\Agenda ID Seven Desktop\`). Só então a causa é localizada e corrigida (na 1.0.164). O log **não** contém senha/token.

## Regra para próximas fases
- Qualquer nova correção/ajuste/atualização do Desktop → **versão 1.0.164** (nunca reusar 1.0.163).
- Frente de code signing permanece **encerrada** até nova decisão explícita do owner.
