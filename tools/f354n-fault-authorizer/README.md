# F3.5.4N — Autorizador local do fault-injection (ferramenta independente)

**NÃO faz parte do Agenda ID Seven.** Vive em `tools/` (fora de `desktop/`), **não é empacotada**
no aplicativo (o electron-builder só empacota `dist/**`, `src/renderer/**` e `package.json` de
`desktop/`) e **não é distribuída** aos usuários. Sem dependências externas — só o Node embutido.

Serve para o **owner**, numa **máquina Windows controlada da ID Seven**, gerar a chave definitiva e
emitir autorizações temporárias assinadas do fault-injection (mecanismo que interrompe de verdade a
assinatura ativa para provar a autocorreção do watchdog).

## Regras de segurança (obrigatórias)
- A **chave privada** é gerada e permanece **exclusivamente** nesta máquina. **Nunca** a envie por
  chat, log, repositório, release, artifact, workflow ou app.
- Envie ao Claude **somente a chave PÚBLICA** (para embutir no app). A pública **não é segredo**:
  só verifica assinaturas; não emite tokens.
- O aplicativo conterá **apenas a chave pública**. Sem token válido/assinado/não expirado/vinculado
  ao `deviceId`, o fault-injection permanece **inacessível** (fail-closed).

## Uso
Pré-requisito: Node.js instalado na máquina.

### 1) Gerar o par definitivo (uma vez)
```
node authorize.mjs keygen --out C:\idseven-keys
```
Grava `f354n-fault-private.pem` (guarde **offline**, nunca compartilhe) e `f354n-fault-public.pem`.
Copie o conteúdo da **pública** e envie ao Claude para embutir no app antes do build final.

### 2) Emitir uma autorização para a máquina de teste
Descubra o `deviceId` da máquina de teste em **Configurações → Notificações → Diagnóstico**
(campo "deviceId"; há botão *Copiar deviceId*).
```
node authorize.mjs sign --key C:\idseven-keys\f354n-fault-private.pem --device <deviceId> --ttl 15
```
Copie o **TOKEN** impresso e cole no app (máquina de teste), em
**Configurações → Notificações → Diagnóstico → Autorização administrativa**. O token:
- vale só para aquele `deviceId`;
- expira em minutos (`--ttl`, padrão 15, máx 120);
- tem `nonce` único (**uso único** — o app rejeita repetição);
- só libera a ação `listener.fault-injection`.

### 3) (Se precisar) reexportar a pública
```
node authorize.mjs pubkey --key C:\idseven-keys\f354n-fault-private.pem
```

## O que o app faz com o token
O app verifica a assinatura Ed25519 com a **pública embutida**, confere `deviceId`, expiração e
`nonce` não usado. Só então libera **uma** interrupção real da assinatura (mostra geração antiga →
nova) para comprovar a autocorreção. Em produção, sem token válido, nada disso aparece nem executa.
