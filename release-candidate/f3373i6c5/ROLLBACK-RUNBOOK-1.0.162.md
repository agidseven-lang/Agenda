# ROLLBACK RUNBOOK — Desktop 1.0.162 (produção controlada)

Procedimentos de reversão caso a 1.0.162 apresente falha crítica. **Documentação** —
nada aqui é executado nesta fase. Rebaixar **somente** com falha crítica e **reportando antes**.

## Quando fazer rollback
- Perda/corrupção de dado; crash recorrente; **exclusão indevida**; **notificação a usuário errado**;
  ou qualquer regressão que impeça o uso normal e não tenha correção rápida segura.

## 1) Rollback do Desktop → 1.0.159
Alvo oficial: **`desktop/v1.0.159-production`** (release preservada e intacta).
- EXE 1.0.159 SHA-256: `f772de61c8f11e444a5089a9dbdefb9370ecb03f9cf242c54f5dea1bcf9312f1`
- MSI 1.0.159 SHA-256: `a5aa9b5a9f75b914cd2ae7c361a951aa895d8b53ae7e31cfad721b3ed3a7c2f7`

Passos (por máquina autorizada):
1. Fechar o app 1.0.162 pela **bandeja → botão direito → Sair** (o X só minimiza).
2. Desinstalar a 1.0.162 (Painel de Controle / Configurações do Windows).
3. Baixar o instalador da release 1.0.159 e **conferir o SHA-256** (`certutil -hashfile <arquivo> SHA256`). Se divergir, **não instalar**.
4. Instalar a 1.0.159 (SmartScreen → "Mais informações" → "Executar assim mesmo").
5. Abrir e confirmar **1.0.159** em Configurações → Sobre / Perfil. Fazer login.
> Dados na nuvem (Firestore) **não** são afetados pela versão do cliente.

## 2) Rollback da própria publicação C6 (se necessário)
Apagar **somente** a release/tag criadas na C6, sem tocar em nenhuma outra:
```
# (executado por quem tiver permissão; NÃO nesta fase)
gh release delete desktop/v1.0.162-production -R agidseven-lang/Agenda --yes
gh api -X DELETE repos/agidseven-lang/Agenda/git/refs/tags/desktop/v1.0.162-production
```
Não toca 1.0.159/1.0.153 nem qualquer outra release/tag.

## 3) Rollback de Functions (só se o problema for do backend de notificação)
O único componente novo do backend é **`onEventDeleted`** (a exclusão física do cliente não depende dele).
- Rollback cirúrgico (para de notificar exclusão; exclusão física segue funcionando):
```
firebase functions:delete onEventDeleted --project agenda-id-seven --force
```
- `onEventCreated` / `onEventUpdated` (C1) permanecem intactos.
- Requer credencial de deploy via workflow autorizado (não manual). **Fora do escopo desta fase.**

## 4) Rollback do Android
- Não há publicação Android a reverter. Em teste interno, re-sideload do APK aprovado anterior (C3, run `29350963196`); desinstalar antes se a assinatura divergir.

## Pós-rollback
- Registrar no `MONITORING-CHECKLIST-D0-D7.md` (tabela de bugs) o motivo, a versão de destino e a confirmação de hash.
- Abrir fase de correção com o defeito reproduzido.
