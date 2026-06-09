package br.com.idseven.agenda.nativebeta.domain

// Modelos de domínio — espelham EXATAMENTE o schema do PWA (sem campo inventado).

data class EventItem(
    val id: String,
    val type: String?,
    val title: String?,
    val client: String?,
    val location: String?,
    val notes: String?,
    val date: String?,      // "YYYY-MM-DD"
    val start: String?,     // "HH:MM"
    val end: String?,       // "HH:MM"
    val owner: String?,
    val ownerId: String?,
    val by: String?,
    val done: Boolean,
    val startedAt: Long?,
    val startedBy: String?,
    val doneAt: Long?,
    val doneBy: String?,
)

data class UserLite(
    val id: String,
    val name: String?,
    val role: String?,
    val color: String?,
    val photo: String?,
    val status: String?,
    val admin: Boolean,
    val email: String? = null,
    val phone: String? = null,
    val createdAt: Long? = null,
    val fcmTokens: List<String> = emptyList(),
) {
    fun isActive(): Boolean = status != "pendente" && status != "removido" && status != "excluido"
}

data class TaskItem(
    val id: String,
    val title: String?,
    val client: String?,
    val sector: String?,
    val desc: String?,
    val status: String?,        // afazer | andamento | concluido
    val assignee: String?,
    val assigneeId: String? = null,  // uid do responsável (aditivo; compatível com dados antigos)
    val link: String?,
    val priority: Boolean,
    val startDate: String?,
    val startTime: String?,
    val dueDate: String?,       // "YYYY-MM-DD"
    val dueTime: String?,       // "HH:MM"
    val by: String?,
    val createdAt: Long?,
    val startedAt: Long?,
    val doneAt: Long?,
    val doneBy: String?,
    val checklist: List<ChecklistItem>,
    val history: List<TaskHistory>,
    // Fluxo Cronograma -> Cliente (aditivos; escritos pelo Desktop. Compat: null em tarefas antigas).
    val cronStatus: String? = null,
    val clientReview: ClientReview? = null,
    val clientSentBy: String? = null,
    // Atribuição ao DESIGNER (aditivo; escrito pelo Desktop em designerAssignment{...}).
    // Compat: null em tarefas que nunca foram enviadas a um designer.
    val assignedDesignerId: String? = null,
    val assignedDesignerName: String? = null,
    // EIXOS SEPARADOS (visibility-fix): status do fluxo do CLIENTE e do DESIGNER,
    // independentes de `status`. A tarefa fica no fluxo do cliente até a aprovação final.
    val clientFlowStatus: String? = null,
    val designerFlowStatus: String? = null,
    // EIXO SOCIAL (aditivo): dona Social Media da tarefa — preservada ao enviar ao designer.
    val socialOwnerId: String? = null,
    val socialOwnerName: String? = null,
    val socialFlowStatus: String? = null,
    // EIXO OPERACIONAL (aditivo): status REAL da operação (≠ aprovação do cliente).
    val operationalStatus: String? = null,
    val finalApprovalCompleted: Boolean = false,
    // FASE de aprovação do cliente: 'themes' | 'production' | 'final'.
    val clientApprovalPhase: String? = null,
    // prazos do designer (para exibir término no card/detalhe do fluxo).
    val designerEndDate: String? = null,
    val designerEndTime: String? = null,
    // Conteúdos do cronograma (temas/legendas/artes) — escritos pelo Desktop.
    // Aceita `cronContents` (atual) e o alias legado `contents`. Compat: lista vazia em tarefas antigas.
    val cronContents: List<CronContent> = emptyList(),
    // detail-hierarchy-v2 (aditivo): estado POR ITEM do cliente (clientItems.iX no Firestore,
    // escrito pelo Worker V64.41+ com tag de fase). Compat: mapa vazio em tarefas antigas.
    val clientItems: Map<String, ClientItemState> = emptyMap(),
    // timestamp da aprovação FINAL do cliente (escrito pelo Worker na conclusão).
    val clientFinalApprovedAt: Long? = null,
)

// detail-hierarchy-v2 — estado de UM conteúdo na visão do cliente (espelha clientItems.iX).
// cs: 'em_revisao' | 'editado' | 'aprovado' | null (sem pendência). phase: themes/production/final.
data class ClientItemState(
    val cs: String? = null,
    val phase: String? = null,
    val note: String? = null,
    val teamAdjustedAt: Long? = null,
)

// Um conteúdo do cronograma (um "tema" da semana/quinzena/mês). Aditivo, espelha o Desktop.
data class CronContent(
    val tema: String? = null,
    val legenda: String? = null,
    val feedImageUrl: String? = null,
    val storyImageUrl: String? = null,
)

data class ChecklistItem(val t: String, val d: Boolean)

data class TaskHistory(val kind: String, val at: Long?, val byId: String?, val from: String?, val to: String?)

// Resposta do cliente na avaliação do cronograma (aditivo). status: aprovado | revisao | editado
data class ClientReview(val status: String, val note: String?, val at: Long?, val byName: String?)
