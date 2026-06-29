# Runbook do operador — Web Push REAL canário (F3.3.21-B3.40M)

> **Operador responsável: Miercohévisk.** Este runbook cobre a **parte física** da
> validação Web Push real, que **não** pode ser automatizada por um agente em nuvem.
> O agente automatizado **não fabrica** resultado: a confirmação visual de
> recebimento é responsabilidade do operador humano. Execute somente na **janela
> autorizada (2026-06-29T16:00:00-03:00, America/Fortaleza)** e somente após o
> mecanismo (PR B3.40M) estar mergeado e o envio único autorizado em fase própria.

## Pré-condições
- Escopo: **1 usuário / 1 dispositivo** — sem exceções.
- `fcm_token_server` permanece **OFF**; `users` read permanece **ABERTO** (não fechar).
- Nenhum token/segredo deve ser colado em chat/log/print. Trate o token FCM como sensível.

## Passos
1. Pegar o **Samsung Galaxy Note 20 Ultra** (dispositivo canário único).
2. Confirmar e **informar a versão do Android** (valor real, não placeholder) em Configurações › Sobre o telefone.
3. Abrir o **Chrome Android**.
4. Acessar **https://agenda-id-seven.web.app**.
5. Fazer login **somente** com **teste.webpush@idseven.com.br** (usuário canário).
6. **Permitir notificações manualmente** quando o navegador solicitar.
7. Confirmar que **este é o único dispositivo** canário em teste.
8. Confirmar que **a base inteira NÃO será alvo** (envio será para 1 token só).
9. **Foreground:** com o site aberto em 1º plano, acionar o envio único autorizado e
   confirmar que a notificação/evento é **recebido e visível**.
10. **Background:** colocar o Chrome em 2º plano e confirmar que a notificação
    **aparece no Android**.
11. **App/site fechado:** fechar o Chrome/aba e confirmar a entrega via
    Service Worker/FCM (**notificação aparece**).
12. **Lockscreen:** bloquear a tela do A54 e confirmar que a notificação
    **aparece na tela de bloqueio**.
13. **Confirmar visualmente** cada um dos 4 recebimentos (registrar OK/NOK por etapa,
    sem colar o token).
14. **Autorizar o cleanup** do token canário.
15. Confirmar a **remoção do token** (via `removeMyFcmToken` na sessão do canário ou
    fluxo legacy documentado) e registrar "token removido".

## Critério de parada imediata
Pare e acione o responsável se: aparecer mais de 1 alvo/dispositivo; um usuário
não-canário for envolvido; qualquer token/segredo/sessão/senha/hash/salt vazar em
log/print; houver Firestore write fora do cleanup; erro de permissão; endpoint fora
do escopo; qualquer indício de envio à base inteira; tentativa de ligar
`fcm_token_server`; tentativa de fechar `users` read; ou Hosting/deploy disparar.

## Registro de resultado (preencher)
| Etapa | Resultado (OK/NOK) | Observação (sem token/segredo) |
|---|---|---|
| Foreground | | |
| Background | | |
| App/site fechado | | |
| Lockscreen | | |
| Cleanup (token removido) | | |

## Importante
O agente automatizado pode disparar o **envio único** (fase futura, gated, com
secret) e registrar o **status HTTP sanitizado**, mas **a confirmação de
recebimento no aparelho é feita e atestada pelo operador humano**. Não há
fabricação de resultado pelo agente.
