# Firestore Rules - BASELINE (somente documento)

> AVISO: este arquivo NAO e source-of-truth de deploy. firebase.json NAO aponta para este baseline. Nenhuma Rule e publicada por este baseline.

- Finalidade: baseline auditavel byte-exato das Rules live para hardening futuro (diff/rollback).
- rulesetName: projects/agenda-id-seven/rulesets/809204d1-ee1b-444f-9b1b-2d6e0cb15132
- release: cloud.firestore
- SHA-256: 527d4a3cb9091c374d54a0edf6b96ac8e05d2650f7d4e28aed2c438a671cb7ee
- linhas: 161 / bytes: 6131
- capturedAt: 2026-07-13T18:28:44.616Z / captureRunId: 29274544566
- verdict (audit): GO / counts: {"INFO":22,"MEDIUM":9}

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
