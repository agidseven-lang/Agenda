# Firestore Rules - BASELINE (somente documento)

> AVISO: este arquivo NAO e source-of-truth de deploy. firebase.json NAO aponta para este baseline. Nenhuma Rule e publicada por este baseline.

- Finalidade: baseline auditavel byte-exato das Rules live para hardening futuro (diff/rollback).
- rulesetName: projects/agenda-id-seven/rulesets/2ebfb400-c5d1-4d13-b0de-b24b00710799
- release: cloud.firestore
- SHA-256: 0f621e2f50f19e4f2bd4279735d450033c720939bbef3d1a4542d3d56f26bdf6
- linhas: 147 / bytes: 5592
- capturedAt: 2026-06-26T15:53:32.876Z / captureRunId: 28249260055
- verdict (audit): NO-GO / counts: {"HIGH":1,"INFO":20,"MEDIUM":8}

## Achado HIGH - users
Leitura direta aberta de users expoe PII/credenciais: pass, salt, fcmTokens, phone, email.

### Bloco match /users (verbatim do baseline)
```
match /users/{id}
```

## Risco
Fechar users nas Rules sem migrar a verificacao de senha para server-side QUEBRA o login (o cliente le users+pass+salt).

## Proxima fase
Design de auth server-side / projecao publica (usersPublic) / hardening.

## Rollback
O ruleset anterior segue LIVE; este baseline e somente documento (nada publicado).
