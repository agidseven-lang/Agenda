# idseven-presence-canary — Threat Model

Serviço CANÁRIO de presença, **totalmente isolado** do Worker J6 (`idseven-push`). Não altera Cloud Run, Firestore, Firebase Auth ou Rules.

## Ativos
- **Token de sessão** do usuário (autoridade: Cloud Run `getUserSelf`). Vive só no main-process do Desktop.
- **Identidade** do usuário (id, nome, cargo, foto).
- **Estado de presença** agregado (online/offline por usuário) + revision.

## Fronteiras de confiança
1. **Desktop main → Worker `/auth`** (HTTPS): o main envia `Authorization: Bearer <sessionToken>`.
2. **Worker → Cloud Run `getUserSelf`** (HTTPS, server-to-server): valida o token. **Read-only** (POST `{}`; não muta).
3. **Worker → Durable Object** (interno ao serviço): identidade já validada, passada em header.
4. **DO ↔ Desktop** (WebSocket seguro): eventos sanitizados.

## Ameaças e mitigações (STRIDE)
| Ameaça | Mitigação |
|---|---|
| **Spoofing** (A finge ser B) | Identidade vem SÓ do `sub` retornado pelo `getUserSelf`. `userId` do body é **ignorado**. O DO só aceita identidade no header assinado pelo Worker (que já validou o ticket). |
| **Tampering** (forjar ticket/evento) | Ticket HS256 assinado por `PRESENCE_TICKET_SECRET` (próprio, separado do J6) + `aud=idseven-presence` + `exp` 60s + `nonce`. WSS (TLS) fim-a-fim. |
| **Replay** | Ticket efêmero (60s) + `nonce`; `transitionRevision` impede efeito duplicado; alarm idempotente. |
| **Info disclosure** | Presença é estado **server-side no DO** (sem coleção pública). Eventos/baseline sanitizados: **nunca** token, IP, hostname, deviceId, localização, dados de SO. O `deviceId` é usado só internamente para agregação, jamais transmitido. |
| **DoS** | Ticket obrigatório (gate `getUserSelf`); WS só com `PRESENCE_WS_ENABLED`; hibernação → custo ocioso ~0; alarm único (sem loop). Cap de conexões por usuário: a implementar antes de produção. |
| **Elevation** | Sem caminho de privilégio; contagem de sessões (Equipe) é só leitura para admin, não é privilégio. |
| **Token theft** | Token trafega SÓ no `/auth` (TLS), nunca no WS, **nunca** no DO, **nunca** logado (o log de `/auth` registra status/duração/válido/campos — jamais o token), **nunca** ao renderer. |

## Não-objetivos / limites conhecidos (canário)
- Sem `onDisconnect` (não há RTDB) → crash/queda detectados por **heartbeat + TTL** (varredura do alarm). TTL canário = 90s (a calibrar em teste físico).
- Máquina encerrada por "Sair" (processo morto) não recebe notificações (esperado).
- Um único DO global "hub": consistência forte para o time canário; sharding é caminho futuro se escalar.

## Flags de segurança do primeiro deploy
`PRESENCE_AUTH_ENABLED=true`, `PRESENCE_WS_ENABLED=false`, `PRESENCE_BROADCAST_ENABLED=false` → só `/health` e `/auth`. Nenhum WebSocket/estado/broadcast antes da prova real do `getUserSelf`.
