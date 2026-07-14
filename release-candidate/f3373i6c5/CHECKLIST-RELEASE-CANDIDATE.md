# CHECKLIST — Release Candidate (F3.3.73I6C5 → gate de publicação C6)

Marque cada item antes de qualquer publicação. **Esta fase C5 NÃO publica.** A publicação
controlada é decidida em **F3.3.73I6C6**. Itens `[x]` já verificados nesta fase (read-only);
itens `[ ]` são pendências para a C6 / decisão do owner.

## A. Artefatos e integridade
- [x] Desktop 1.0.162 buildado (run `29353487838`, success).
- [x] Artifacts Desktop disponíveis (installer `8319234363`, bundle `8319240131`; não expirados, expiram 2026-08-13).
- [x] SHA-256 EXE/MSI documentados (`HASHES-ARTIFACTS.md`).
- [x] APK Android buildado (run `29354162243`, success) e disponível (artifact `8319511469`, expira **2026-07-28**).
- [x] SHA-256 APK documentado.
- [ ] **Owner conferiu os hashes localmente** (após descompactar) — confirmar antes de distribuir.

## B. Escopo funcional aprovado (owner-run C4 = GO)
- [x] Criar / editar / iniciar / finalizar compromisso.
- [x] Cancelar lógico (não apaga) + Mostrar cancelados.
- [x] Excluir definitivamente + confirmação forte EXCLUIR.
- [x] Tempo real Desktop ↔ Android.
- [x] Notificações lifecycle + exclusão (server-side).
- [x] Chat removido / Copywriting removido preservados.

## C. Functions (backend)
- [x] `onEventCreated`, `onEventUpdated`, `onEventDeleted` deployadas e confirmadas (run `29354374188`).
- [x] Nenhum deploy de Functions nesta fase.

## D. Guard-rails (devem permanecer NÃO nesta fase)
- [x] Deploy de Hosting: **NÃO**.
- [x] Deploy de Rules: **NÃO**.
- [x] Firestore write manual: **NÃO**.
- [x] Worker / Card Premium tocado: **NÃO**.
- [x] PWA reativado / WebView: **NÃO**.
- [x] Tag final / latest / Play Store: **NÃO**.

## E. Desktop — prontidão de publicação (C6)
- [x] Instalador NSIS + MSI válido; gates tray-icon e prova-de-versão PASS.
- [ ] Decidir canal de distribuição controlada (link direto / pasta interna).
- [ ] Decidir **tag** (sugestão: `desktop-v1.0.162-rc` — criar só com autorização, C6).
- [ ] (Opcional) assinatura de código para evitar aviso SmartScreen — fora do escopo atual.

## F. Android — prontidão de publicação (C6) — DECISÃO PENDENTE
- [x] APK **debug** validado (bom para sideload/controlado interno).
- [ ] **Decisão:** distribuir o **APK debug** (controlado/sideload) **ou** produzir build **release** (loja/produção)?
- [ ] Se release: **bump `versionName`/`versionCode`** (refletir C3A) — mudança de código a autorizar.
- [ ] Se release: escolher assinatura (`idseven-test.keystore` versionado p/ controlado, ou upload key real p/ Play).
- [ ] Se release: `assembleRelease` (APK) ou `bundleRelease` (AAB p/ Play) + **re-validação física** do novo binário.
- [ ] Decidir **tag** Android (sugestão: `android-agenda-c3a-rc` — criar só com autorização, C6).

## G. Documentação de release (esta fase)
- [x] `RELEASE-NOTES-DESKTOP-1.0.162.md`
- [x] `RELEASE-NOTES-ANDROID-AGENDA-C3A.md`
- [x] `HASHES-ARTIFACTS.md`
- [x] `ROLLBACK-PLAN.md`
- [x] `OWNER-HANDOFF.md`
- [x] `CHECKLIST-RELEASE-CANDIDATE.md` (este arquivo)

## H. Sinal verde para publicar (somente em C6, com autorização explícita)
- [ ] Owner autoriza publicação controlada.
- [ ] Rollback plan revisado e aceito.
- [ ] Tags/latest só após autorização item-a-item.
