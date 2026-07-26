package br.com.idseven.agenda.features.tasks

import br.com.idseven.agenda.domain.Sectors
import br.com.idseven.agenda.domain.TaskItem
import br.com.idseven.agenda.domain.UserLite

// Visibilidade de tarefas por FUNÇÃO (Fase B) — FILTRO CLIENT-SIDE apenas.
// ATENÇÃO: NÃO é segurança. Qualquer cliente do app ainda lê a coleção `tasks`.
// O enforcement real (server-side) será feito em Firestore Rules numa FASE FUTURA.
//
// `role` no banco é TEXTO LIVRE (ex.: "Social media", "Designer", "Filmmaker").
// Por isso classificamos por palavra-chave normalizada + o booleano `admin`.
object TaskVisibility {
    enum class Cat { ADMIN, MANAGER, OPERATIONAL, UNKNOWN }

    // Palavras que indicam visão AMPLA (gestão/social media/admin).
    private val MANAGER_KW = listOf(
        "social", "gestor", "gerente", "diretor", "coordena", "supervisor",
        "admin", "dono", "owner", "ceo", "head",
    )

    private fun norm(s: String?): String = (s ?: "").lowercase()
        .replace('á', 'a').replace('â', 'a').replace('ã', 'a').replace('à', 'a')
        .replace('é', 'e').replace('ê', 'e').replace('í', 'i')
        .replace('ó', 'o').replace('ô', 'o').replace('õ', 'o')
        .replace('ú', 'u').replace('ç', 'c').trim()

    fun roleCategory(user: UserLite?): Cat {
        if (user == null) return Cat.UNKNOWN
        if (user.admin) return Cat.ADMIN
        val r = norm(user.role)
        if (r.isBlank()) return Cat.UNKNOWN
        if (MANAGER_KW.any { r.contains(it) }) return Cat.MANAGER
        return Cat.OPERATIONAL // designer, copywriter, roteirista, filmmaker, freelancer…
    }

    // Admin e gestão/social media veem TODOS os quadros e tarefas.
    fun canSeeAllBoards(user: UserLite?): Boolean =
        roleCategory(user).let { it == Cat.ADMIN || it == Cat.MANAGER }

    // Operacional/desconhecido: vê apenas o que é DELE (responsável ou criador).
    fun canSeeTask(user: UserLite?, task: TaskItem): Boolean {
        if (canSeeAllBoards(user)) return true
        val uid = user?.id ?: return false
        return task.assigneeId == uid || task.by == uid
    }

    // Tarefas visíveis ao usuário (aplica a regra acima).
    fun visibleTasks(user: UserLite?, tasks: List<TaskItem>): List<TaskItem> =
        if (canSeeAllBoards(user)) tasks else tasks.filter { canSeeTask(user, it) }

    // ===== EIXOS SEPARADOS cliente x designer (visibility-fix; espelha o Desktop) =====
    // Fluxo do DESIGNER: a tarefa foi ATRIBUÍDA a um designer.
    fun hasDesigner(t: TaskItem): Boolean = !t.assignedDesignerId.isNullOrBlank()
    fun isDesignerFlow(t: TaskItem): Boolean = hasDesigner(t)

    // Fluxo do CLIENTE: TODO cronograma vive no fluxo do cliente — INDEPENDENTE do designer.
    // Só "conclui" o fluxo do cliente na aprovação final (clientFlowStatus='concluido').
    fun isClientFlow(t: TaskItem): Boolean = Sectors.of(t.sector).key == "cronograma"

    // O designer "dono" da tarefa.
    fun designerOf(t: TaskItem): String? = t.assignedDesignerId?.ifBlank { null } ?: t.assigneeId

    // Colunas do FLUXO DO CLIENTE (eixo próprio, separado do designer).
    data class ClientCol(val key: String, val label: String)
    val CLIENT_COLS = listOf(
        ClientCol("afazer", "A Fazer"),
        ClientCol("enviado", "Temas enviados ao cliente"),
        ClientCol("aprovado", "Temas aprovados pelo cliente"),
        ClientCol("producao", "Em produção"),
        ClientCol("revisao", "Ajuste solicitado pelo cliente"),
        ClientCol("reenviado", "Reenviado ao cliente"),
        ClientCol("concluido", "Concluído final"),
    )
    private val CLIENT_KEYS = CLIENT_COLS.map { it.key }.toSet()

    // Coluna do cliente: usa clientFlowStatus (gravado por Worker/Desktop); senão deriva (compat).
    fun clientCol(t: TaskItem): String {
        val v = t.clientFlowStatus ?: ""
        if (CLIENT_KEYS.contains(v)) {
            // 'concluido' explícito só vale se o fluxo realmente encerrou; senão ainda é reenvio.
            if (v == "concluido" && !isFullyComplete(t)) return "reenviado"
            // V64.49: o fechamento é SÓ explícito (botão "Aprovar temas" → approveAll); o
            // estado "tudo aprovado com 'revisao' herdado" vira AGUARDANDO CONFIRMAÇÃO
            // (tratado em operationalCol/clientCol4/clientFacingStatusView/detailState).
            return v
        }
        val ws = t.cronStatus ?: ""  // workflowStage não está no modelo; usa cronStatus + review
        val cr = t.clientReview?.status ?: ""
        // CORREÇÃO (status-consistency): status BRUTO do kanban (t.status=='concluido') NÃO força
        // mais 'concluido'. Conclusão só via isFullyComplete (aprovação final real + sem pendências).
        if (isFullyComplete(t)) return "concluido"
        if (cr == "revisao" || ws == "em_revisao_cliente" || ws == "editado_cliente") return "revisao"
        if (ws == "ready_for_final_client_review" || ws == "reenviado_cliente") return "reenviado"
        if (hasDesigner(t) || ws == "sent_to_designer") return "producao"
        if (cr == "aprovado" || ws == "aprovado_cliente") return "aprovado"
        if (ws == "enviado_cliente" || !t.clientSentBy.isNullOrBlank()) return "enviado"
        return "afazer"
    }

    // Coluna do DESIGNER (eixo de trabalho do designer): designerFlowStatus; senão status.
    fun designerCol(t: TaskItem): String {
        val v = t.designerFlowStatus ?: ""
        if (v == "afazer" || v == "andamento" || v == "revisao" || v == "concluido") return v
        return t.status ?: "afazer"
    }

    // IDs de designers que possuem tarefas no fluxo de designer (para o hub de designers).
    fun designersWithFlow(tasks: List<TaskItem>): Map<String, Int> {
        val m = LinkedHashMap<String, Int>()
        tasks.forEach { t -> if (isDesignerFlow(t)) designerOf(t)?.let { id -> m[id] = (m[id] ?: 0) + 1 } }
        return m
    }

    // ===== EIXO SOCIAL (Social Medias) — espelha o Desktop 1.0.96 =====
    fun isSocialUser(u: UserLite?): Boolean = u != null && norm(u.role).contains("social")

    // Social Media "dona": socialOwnerId explícito; senão criador (by) se social; senão responsável se social.
    fun socialOf(t: TaskItem, users: List<UserLite>): String? {
        t.socialOwnerId?.ifBlank { null }?.let { return it }
        users.firstOrNull { it.id == t.by }?.let { if (isSocialUser(it)) return t.by }
        users.firstOrNull { it.id == t.assigneeId }?.let { if (isSocialUser(it)) return t.assigneeId }
        return null
    }

    // Social Medias ativas (para listar todas no hub mesmo sem tarefa).
    fun socialUsers(users: List<UserLite>): List<UserLite> =
        users.filter { it.isActive() && isSocialUser(it) }

    // Hub das Social Medias: todas as ativas + contagem de tarefas das quais cada uma é dona.
    fun socialsWithFlow(tasks: List<TaskItem>, users: List<UserLite>): Map<String, Int> {
        val m = LinkedHashMap<String, Int>()
        socialUsers(users).forEach { m[it.id] = 0 }
        tasks.forEach { t -> socialOf(t, users)?.let { id -> if (users.firstOrNull { u -> u.id == id }?.let { isSocialUser(it) } == true) m[id] = (m[id] ?: 0) + 1 } }
        return m
    }

    // Coluna do quadro da Social Media: cronograma deriva do eixo do cliente; demais usam status.
    fun socialCol(t: TaskItem): String {
        if (Sectors.of(t.sector).key == "cronograma") {
            return when (clientCol(t)) {
                "concluido" -> "concluido"; "revisao" -> "revisao"; "afazer" -> "afazer"
                else -> "andamento" // enviado/aprovado/producao/reenviado = em andamento
            }
        }
        return t.status ?: "afazer"
    }

    // ===== EIXO OPERACIONAL (status REAL da operação ≠ aprovação do cliente) — espelha o Desktop =====
    data class OpCol(val key: String, val label: String)
    val OPERATIONAL_COLS = listOf(
        OpCol("afazer", "A Fazer"),
        OpCol("producao", "Aguardando aprovação dos temas"),
        OpCol("aguardando_envio", "Aguardando envio ao designer"),
        // task-flow-fix (paridade Desktop 1.0.128): "enviado ao designer" ≠ "designer produzindo".
        OpCol("aguardando_designer_iniciar", "Aguardando designer iniciar"),
        OpCol("aguardando_designer", "Designer em produção"),
        // role-aware (paridade Desktop f96aa2e): designer corrigindo um ajuste (designerFlowStatus='revisao').
        OpCol("aguardando_designer_revisao", "Designer em revisão"),
        OpCol("aguardando_legenda", "Aguardando legendas e posts"),
        OpCol("aguardando_revisao", "Ajuste solicitado pelo cliente"),
        OpCol("aguardando_final", "Aguardando aprovação final"),
        OpCol("concluido", "Concluído final"),
    )
    fun pendingLegend(t: TaskItem): Boolean {
        val a = t.cronContents
        return a.isEmpty() || a.any { it.legenda.isNullOrBlank() }
    }
    fun pendingFeed(t: TaskItem): Boolean {
        val a = t.cronContents
        return a.isEmpty() || a.any { it.feedImageUrl.isNullOrBlank() }
    }
    // Story é OPCIONAL: só pendente se ALGUNS conteúdos têm story e outros não (incompleto).
    fun pendingStory(t: TaskItem): Boolean {
        val a = t.cronContents
        return a.any { !it.storyImageUrl.isNullOrBlank() } && a.any { it.storyImageUrl.isNullOrBlank() }
    }
    private fun pendingProduction(t: TaskItem) = pendingLegend(t) || pendingFeed(t)
    private fun designerDelivered(t: TaskItem) = hasDesigner(t) && designerCol(t) == "concluido"

    // ===== FONTE ÚNICA DA VERDADE — o fluxo está REALMENTE encerrado? (espelha o Desktop 1.0.99)
    // "Concluído" exige aprovação FINAL do cliente E zero pendências operacionais.
    // O status BRUTO do kanban (t.status) NUNCA, sozinho, conclui um cronograma.
    fun isFullyComplete(t: TaskItem): Boolean {
        if (Sectors.of(t.sector).key != "cronograma") return t.status == "concluido"
        if (hasDesigner(t) && !designerDelivered(t)) return false           // designer ainda produzindo
        if (pendingProduction(t)) return false                              // legenda/Feed pendente
        if (pendingStory(t)) return false                                   // Story pendente (quando aplicável)
        if (t.clientReview?.status == "revisao") return false               // revisão solicitada
        // Sinais DELIBERADOS de encerramento final (escritos só na aprovação final).
        return t.finalApprovalCompleted || t.operationalStatus == "concluido" ||
            t.clientFlowStatus == "concluido" || t.cronStatus == "aprovado_final"
    }

    // Status operacional REAL — DERIVADO. 'concluido' tem caminho ÚNICO: isFullyComplete.
    fun operationalCol(t: TaskItem): String {
        if (Sectors.of(t.sector).key != "cronograma") return t.status ?: "afazer"
        if (isFullyComplete(t)) return "concluido"                          // ÚNICO caminho para concluído
        val cf = clientCol(t)
        // V64.49: tudo aprovado com 'revisao' herdado = aguardando o cliente CONFIRMAR no
        // portal (botão "Aprovar temas") → Social vê "Aguardando aprovação dos temas".
        if (cf == "revisao" && !hasPendingItemRevision(t) && allPhaseItemsApproved(t)) return "producao"
        if (cf == "revisao") return "aguardando_revisao"
        if (cf == "reenviado") return "aguardando_final"
        if (hasDesigner(t)) {
            val dc = designerCol(t)
            if (dc == "concluido") return if (pendingProduction(t)) "aguardando_legenda" else "aguardando_final"
            // task-flow-fix (paridade Desktop 1.0.128): "Designer em produção" SÓ quando o designer
            // realmente iniciou (andamento) ou está retrabalhando (revisao). Recém-enviado (afazer/
            // vazio) NÃO antecipa produção — fica "Aguardando designer iniciar" até a transição real.
            // role-aware (paridade Desktop f96aa2e): andamento → em produção; revisao → em revisão; afazer → iniciar.
            if (dc == "andamento") return "aguardando_designer"
            if (dc == "revisao") return "aguardando_designer_revisao"
            return "aguardando_designer_iniciar"
        }
        // SEM designer atribuído: NUNCA mostrar produção/legenda/entrega.
        if (cf == "aprovado") return "aguardando_envio"   // temas aprovados → falta ENVIAR ao designer
        if (cf == "afazer") return "afazer"
        return "producao"                                 // enviado ao cliente, aguardando feedback
    }

    // Bucket de 4 colunas (afazer/andamento/revisao/concluido) para o quadro por papel e
    // "Meu quadro". Para CRONOGRAMA deriva do eixo OPERACIONAL — assim o status BRUTO nunca
    // coloca um cronograma em "Concluído" antes da aprovação final (paridade com o Desktop 1.0.100).
    fun boardCol4(t: TaskItem): String {
        if (Sectors.of(t.sector).key != "cronograma") return t.status ?: "afazer"
        return when (operationalCol(t)) {
            "concluido" -> "concluido"          // só quando isFullyComplete
            "aguardando_revisao" -> "revisao"
            "afazer" -> "afazer"
            else -> "andamento"                 // producao/aguardando_designer/legenda/final
        }
    }

    // 1.0.93 — COLUNAS POR CONTEXTO (espelha o Desktop 1.0.105). Reduz o excesso de colunas;
    // o detalhe operacional segue visível no card. Social=4, Designer=3, Cliente=4.
    val SOCIAL_COLS4 = listOf(
        OpCol("afazer", "A Fazer"), OpCol("andamento", "Em andamento"),
        OpCol("revisao", "Revisão"), OpCol("concluido", "Finalizado"),
    )
    // role-aware (paridade Desktop f96aa2e): o DESIGNER tem 4 colunas próprias (inclui Revisão/Ajuste).
    val DESIGNER_COLS4 = listOf(
        OpCol("afazer", "A Fazer"), OpCol("andamento", "Em andamento"),
        OpCol("revisao", "Revisão/Ajuste"), OpCol("entregue", "Entregue"),
    )
    val CLIENT_COLS4 = listOf(
        ClientCol("enviado", "Enviado"), ClientCol("analise", "Em análise"),
        ClientCol("revisao", "Revisão solicitada"), ClientCol("aprovado", "Aprovado"),
    )
    // Bucket de 4 colunas do DESIGNER (mantém a coluna própria de Revisão/Ajuste; não colapsa 'revisao').
    fun designerColView(t: TaskItem): String = when (designerCol(t)) {
        "concluido" -> "entregue"; "revisao" -> "revisao"; "afazer" -> "afazer"; else -> "andamento"
    }
    // "Próxima ação" CURTA na perspectiva do DESIGNER (o que ELE precisa fazer agora).
    fun designerNextShort(t: TaskItem): String = when (designerColView(t)) {
        "afazer" -> "Iniciar a produção"
        "andamento" -> "Finalizar e entregar"
        "revisao" -> "Corrigir o ajuste e reenviar"
        "entregue" -> "Entregue — aguardando a Social"
        else -> "Acompanhar"
    }
    // Status VISUAL do card do DESIGNER (reprovação 1.0.134): a COLUNA segue "Em andamento",
    // mas o badge do card é IGUAL ao que a Social vê — "Designer em produção" — leitura
    // idêntica da mesma etapa em todos os papéis (paridade Desktop designerStatusView).
    fun designerCardLabel(t: TaskItem): String {
        val k = designerColView(t)
        if (k == "andamento") return "Designer em produção"
        return DESIGNER_COLS4.firstOrNull { it.key == k }?.label ?: "A Fazer"
    }

    // Bucket de 4 colunas do CLIENTE (a partir do eixo do cliente).
    // REGRA DEFINITIVA (bug 1.0.133): a coluna "Aprovado" do quadro Cliente é SÓ a conclusão
    // REAL (clientCol 'concluido' via isFullyComplete). Temas aprovados é etapa INTERMEDIÁRIA
    // → fica em "Em análise" enquanto a produção anda (paridade Desktop clientCol4).
    fun clientCol4(t: TaskItem): String {
        val c = clientCol(t)
        // aguardando confirmação do cliente (tudo aprovado, sem o clique final) → Em análise
        if (c == "revisao" && allPhaseItemsApproved(t)) return "analise"
        return when (c) {
            "revisao" -> "revisao"
            "concluido" -> "aprovado"
            "aprovado", "producao", "reenviado" -> "analise"
            else -> "enviado"
        }
    }

    // Linguagem do QUADRO CLIENTE (bug 1.0.133): sem jargão operacional interno
    // ("Aguardando designer iniciar" etc.) — status simples, na perspectiva do cliente
    // (paridade Desktop clientFacingStatusView).
    data class ClientFacing(val key: String, val label: String, val colorHex: Long)
    fun clientFacingStatusView(t: TaskItem): ClientFacing = when (clientCol(t)) {
        "concluido" -> ClientFacing("concluido", "Cronograma concluído", 0xFF10B981)
        "revisao" ->
            if (allPhaseItemsApproved(t)) ClientFacing("aguarda_confirmacao", "Temas aprovados — aguardando confirmação", 0xFF22D3EE)
            else ClientFacing("revisao", "Ajuste solicitado — equipe corrigindo", 0xFFF59E0B)
        "reenviado" -> ClientFacing("final", "Versão final disponível para análise", 0xFF34D399)
        "aprovado", "producao" -> when (operationalCol(t)) {
            "aguardando_envio" -> ClientFacing("temas_ok", "Temas aprovados — produção em andamento", 0xFF34D399)
            "aguardando_legenda" -> ClientFacing("legendas", "Aguardando legendas e posts", 0xFF5B6CFF)
            "aguardando_final" -> ClientFacing("final", "Versão final disponível para análise", 0xFF34D399)
            else -> ClientFacing("producao", "A equipe está produzindo as artes", 0xFFA78BFA)
        }
        "enviado" -> ClientFacing("enviado", "Temas enviados — aguardando análise", 0xFF22D3EE)
        else -> ClientFacing("preparacao", "Em preparação", 0xFF6E7480)
    }
    // 1.0.93 — bucket de 4 colunas DERIVADO DO PAPEL DE QUEM VÊ. Se quem abre o quadro é o
    // DESIGNER atribuído à tarefa, usa o eixo de trabalho do designer — assim um cronograma
    // recém-enviado cai em "A Fazer" do designer (corrige o bug do teste real: tarefa do
    // designer não aparecia em "A Fazer" no celular). Senão, usa o eixo operacional.
    fun boardCol4For(t: TaskItem, uid: String?): String {
        if (Sectors.of(t.sector).key != "cronograma") return t.status ?: "afazer"
        if (!uid.isNullOrBlank() && hasDesigner(t) && designerOf(t) == uid) {
            return when (designerCol(t)) {
                "concluido" -> "concluido"; "revisao" -> "revisao"
                "andamento" -> "andamento"; else -> "afazer"
            }
        }
        return boardCol4(t)
    }

    // "Próxima ação" em destaque para a Social/Admin.
    // FASE de aprovação do cliente (themes/production/final) — espelha o Worker V64.13.
    fun clientApprovalPhase(t: TaskItem): String {
        val e = t.clientApprovalPhase ?: ""
        if (e == "themes" || e == "production" || e == "final") return e
        if (t.finalApprovalCompleted) return "final"
        if (t.cronStatus == "ready_for_final_client_review") return "final"
        val arr = t.cronContents
        val total = arr.size
        if (total > 0) {
            val withLeg = arr.count { !it.legenda.isNullOrBlank() }
            val withFeed = arr.count { !it.feedImageUrl.isNullOrBlank() }
            if (withLeg == total && withFeed == total) return "production"
        }
        return "themes"
    }
    fun clientApprovalPhaseLabel(p: String): String = when (p) {
        "final" -> "Aprovação final"
        "production" -> "Aprovação de legendas/artes"
        else -> "Aprovação de temas"
    }

    // ═════════ detail-hierarchy-v2 — MÁQUINA DE ESTADOS DO DETALHE (espelho do Desktop) ═════════
    // PHASE-AWARE (espelho Worker V64.41): pendência de item só conta na FASE ATUAL.
    data class PendingItem(val idx: Int, val cs: String, val note: String)
    fun pendingClientItems(t: TaskItem): List<PendingItem> {
        val ph = clientApprovalPhase(t)
        return t.clientItems.entries.mapNotNull { (k, v) ->
            val m = Regex("^i(\\d+)$").find(k) ?: return@mapNotNull null
            val cs = v.cs ?: return@mapNotNull null
            if ((cs == "em_revisao" || cs == "editado") && v.phase == ph)
                PendingItem(m.groupValues[1].toInt(), cs, v.note ?: "") else null
        }.sortedBy { it.idx }
    }
    fun hasPendingItemRevision(t: TaskItem): Boolean = pendingClientItems(t).isNotEmpty()
    // equipe já corrigiu (teamAdjustedAt) e o cliente ainda não reanalisou?
    fun hasTeamAdjustedAwaiting(t: TaskItem): Boolean {
        if (pendingClientItems(t).isNotEmpty()) return false
        return t.clientItems.values.any { it.teamAdjustedAt != null && it.cs == null }
    }
    // V64.47 (bug 1.0.132) — TODOS os conteúdos da FASE ATUAL aprovados pelo cliente?
    // (espelho do fechamento de fase do Worker/Desktop; item legado sem phase NÃO conta).
    // Destrava docs com o global 'revisao' herdado do ciclo ajuste→correção→aprovação.
    fun allPhaseItemsApproved(t: TaskItem): Boolean {
        val total = t.cronContents.size
        if (total == 0 || t.clientItems.isEmpty()) return false
        val ph = clientApprovalPhase(t)
        for (i in 0 until total) {
            val it = t.clientItems["i$i"] ?: return false
            if (!(it.cs == "aprovado" && it.phase == ph)) return false
        }
        return true
    }
    private fun clientApprovedFlag(t: TaskItem): Boolean =
        t.cronStatus == "aprovado_cliente" || t.clientReview?.status == "aprovado"

    // Estado ÚNICO do detalhe: 1 status principal + próxima ação + responsável + ações por fase.
    // Hierarquia aprovada (mockup): nunca 5 status concorrentes; linguagem humana.
    data class DetailState(
        val key: String, val label: String, val sub: String, val next: String,
        val owner: String,           // social | designer | cliente | none | assignee
        val colorHex: Long,          // cor do status principal (Compose Color(colorHex))
        val actions: List<String>,   // chaves de ações relevantes da fase (informativo no Android)
    )
    fun detailState(t: TaskItem): DetailState {
        if (Sectors.of(t.sector).key != "cronograma") {
            return DetailState("task_" + (t.status ?: "afazer"), "", "", "", "assignee", 0xFF6E7480, emptyList())
        }
        val cc = clientCol(t)
        val pend = pendingClientItems(t)
        if (isFullyComplete(t)) return DetailState(
            "concluido", "Concluído ✓",
            "O cliente aprovou a versão final. Cronograma encerrado.",
            "Nada a fazer — aprovação final registrada.",
            "none", 0xFF34D399, listOf("clientview"))
        // V64.49: cliente aprovou TODOS os itens mas falta a confirmação final no portal
        // (botão "Aprovar temas") — globais seguem 'revisao' herdado. NÃO é ajuste pendente.
        if (cc == "revisao" && pend.isEmpty() && allPhaseItemsApproved(t)) return DetailState(
            "aguardando_confirmacao", "Temas aprovados — aguardando confirmação",
            "O cliente aprovou todos os temas. Falta a confirmação final no portal (botão “Aprovar temas”).",
            "Aguardar o cliente confirmar a aprovação no portal. Nenhuma ação necessária agora.",
            "cliente", 0xFF22D3EE, listOf("clientview"))
        if (pend.isNotEmpty() || (cc == "revisao" && !hasTeamAdjustedAwaiting(t))) return DetailState(
            "cliente_ajuste", "Cliente pediu ajuste",
            if (pend.isNotEmpty()) "Ajuste solicitado no Conteúdo " + pend.joinToString(", ") { "${it.idx + 1}" } +
                (pend.firstOrNull()?.note?.takeIf { it.isNotBlank() }?.let { ": “$it”" } ?: ".")
            else "O cliente pediu uma revisão geral.",
            "Corrigir o conteúdo e marcar como corrigido — o cliente será avisado.",
            "social", 0xFFFB7185, listOf("fix", "teamfix", "clientview"))
        if (cc == "revisao" && hasTeamAdjustedAwaiting(t)) return DetailState(
            "ajuste_aguardando", "Ajuste realizado — aguardando o cliente",
            "A correção foi feita e o cliente vai revisar no mesmo link.",
            "Aguardar o cliente revisar o conteúdo corrigido. Nenhuma ação necessária agora.",
            "cliente", 0xFF5B9BFF, listOf("clientview"))
        if (cc == "reenviado") return DetailState(
            "aguardando_final", "Aguardando aprovação final",
            "Legendas e posts foram enviados. O cliente foi avisado.",
            "Aguardar o cliente aprovar a versão final no portal.",
            "cliente", 0xFF5B9BFF, listOf("clientview"))
        if (hasDesigner(t) && !designerDelivered(t)) {
            return when (designerCol(t)) {
                "afazer" -> DetailState(
                    "designer_aguardando", "Aguardando designer iniciar",
                    "A tarefa está no quadro do designer, em “A Fazer”.",
                    "Aguardar o designer iniciar a produção. Ele já foi notificado.",
                    "designer", 0xFFB9A4FF, listOf("dboard"))
                "revisao" -> DetailState(
                    "designer_revisao", "Designer em revisão",
                    "O designer está revisando/ajustando as artes.",
                    "Aguardar o designer finalizar a revisão e entregar.",
                    "designer", 0xFF60A5FA, listOf("dboard"))
                else -> DetailState(
                    "designer_producao", "Designer em produção",
                    "O designer está produzindo as artes do cronograma.",
                    "Aguardar a entrega das artes pelo designer.",
                    "designer", 0xFFF5A524, listOf("dboard"))
            }
        }
        if (designerDelivered(t)) return DetailState(
            "designer_entregou", "Designer entregou",
            "As artes foram entregues. Falta legenda e post para a aprovação final.",
            "Revisar as artes, adicionar legendas e posts e enviar ao cliente (no Desktop).",
            "social", 0xFF22D3B8, listOf("prod", "sendclient"))
        if ((cc == "aprovado" || cc == "producao") && clientApprovedFlag(t) && !hasDesigner(t)) return DetailState(
            "temas_aprovados", "Temas aprovados",
            "O cliente aprovou todos os temas. Produção liberada.",
            "Escolher o designer para produzir as artes (a atribuição é feita no Desktop).",
            "social", 0xFF34D399, listOf("senddesigner", "clientview"))
        if (cc == "enviado") return DetailState(
            "aguardando_temas", "Aguardando aprovação dos temas",
            "Os temas foram enviados. O cliente foi avisado.",
            "Aguardar o cliente analisar os temas no portal.",
            "cliente", 0xFF22D3EE, listOf("clientview"))
        return DetailState(
            "preparacao", "Em preparação",
            "O cronograma ainda não foi enviado ao cliente.",
            "Preencher os temas e enviar ao cliente para aprovação.",
            "social", 0xFF6E7480, listOf("edit"))
    }

    fun nextActionText(t: TaskItem): String = when (operationalCol(t)) {
        "afazer" -> "Criar o cronograma e enviar ao cliente."
        "producao" -> "Enviado ao cliente. Próxima etapa: aguardar o feedback do cliente sobre os temas."
        "aguardando_envio" -> "Temas aprovados. Próxima etapa: enviar o cronograma ao designer."
        "aguardando_designer_iniciar" -> "Enviado ao designer. Próxima etapa: aguardar o designer iniciar a produção."
        "aguardando_designer" -> "Designer produzindo. Próxima etapa: aguardar a entrega do designer."
        "aguardando_designer_revisao" -> "Designer corrigindo um ajuste. Próxima etapa: aguardar a nova entrega do designer."
        "aguardando_legenda" -> "Designer entregou. Próxima etapa: revisar, adicionar legenda e posts (Feed/Story)."
        "aguardando_revisao" -> "Cliente pediu ajuste. Próxima etapa: corrigir o conteúdo e reenviar pelo mesmo link."
        "aguardando_final" -> "Tudo pronto. Próxima etapa: reenviar ao cliente e aguardar a aprovação final."
        "concluido" -> "Aprovação final concluída. Tarefa encerrada operacionalmente."
        else -> "Acompanhar o andamento."
    }
}
