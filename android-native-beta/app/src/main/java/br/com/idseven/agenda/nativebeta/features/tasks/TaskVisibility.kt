package br.com.idseven.agenda.nativebeta.features.tasks

import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.UserLite

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
        ClientCol("enviado", "Enviado ao cliente"),
        ClientCol("aprovado", "Aprovado pelo cliente"),
        ClientCol("producao", "Em produção"),
        ClientCol("revisao", "Revisão"),
        ClientCol("reenviado", "Reenviado ao cliente"),
        ClientCol("concluido", "Concluído"),
    )
    private val CLIENT_KEYS = CLIENT_COLS.map { it.key }.toSet()

    // Coluna do cliente: usa clientFlowStatus (gravado por Worker/Desktop); senão deriva (compat).
    fun clientCol(t: TaskItem): String {
        val v = t.clientFlowStatus ?: ""
        if (CLIENT_KEYS.contains(v)) {
            // 'concluido' explícito só vale se o fluxo realmente encerrou; senão ainda é reenvio.
            if (v == "concluido" && !isFullyComplete(t)) return "reenviado"
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
        OpCol("producao", "Em produção"),
        OpCol("aguardando_envio", "Aguardando envio ao designer"),
        OpCol("aguardando_designer", "Aguardando designer"),
        OpCol("aguardando_legenda", "Aguardando legenda/post"),
        OpCol("aguardando_revisao", "Revisão do cliente"),
        OpCol("aguardando_final", "Aguardando aprov. final"),
        OpCol("concluido", "Concluído"),
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
        if (cf == "revisao") return "aguardando_revisao"
        if (cf == "reenviado") return "aguardando_final"
        if (hasDesigner(t)) {
            if (designerCol(t) != "concluido") return "aguardando_designer"
            return if (pendingProduction(t)) "aguardando_legenda" else "aguardando_final"
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

    fun nextActionText(t: TaskItem): String = when (operationalCol(t)) {
        "afazer" -> "Criar o cronograma e enviar ao cliente."
        "producao" -> "Enviado ao cliente. Próxima etapa: aguardar o feedback do cliente sobre os temas."
        "aguardando_envio" -> "Temas aprovados. Próxima etapa: enviar o cronograma ao designer."
        "aguardando_designer" -> "Designer produzindo. Próxima etapa: aguardar a entrega do designer."
        "aguardando_legenda" -> "Designer entregou. Próxima etapa: revisar, adicionar legenda e posts (Feed/Story)."
        "aguardando_revisao" -> "Cliente pediu ajuste. Próxima etapa: corrigir o conteúdo e reenviar pelo mesmo link."
        "aguardando_final" -> "Tudo pronto. Próxima etapa: reenviar ao cliente e aguardar a aprovação final."
        "concluido" -> "Aprovação final concluída. Tarefa encerrada operacionalmente."
        else -> "Acompanhar o andamento."
    }
}
