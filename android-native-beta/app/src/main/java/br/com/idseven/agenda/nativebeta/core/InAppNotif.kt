package br.com.idseven.agenda.nativebeta.core

import br.com.idseven.agenda.nativebeta.domain.FlowEngine
import br.com.idseven.agenda.nativebeta.domain.SlaContract
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.TaskPhase
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.features.tasks.TaskVisibility
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* ============================================================================
 * F3.3.6-C — DERIVAÇÃO LOCAL (read-side) das notificações in-app Android.
 * Espelha o Desktop (resolveNotificationTargets / notifScanSla / notifScanFlow):
 *   - SLA pessoal (laranja/vermelho/crítico) → SOMENTE o designer responsável;
 *   - Fluxo/status → EQUIPE (designer + autor + atribuído + supervisão que vê tudo).
 * SEM Worker, SEM FCM, SEM Firestore write. Usa só os StateFlows já em memória.
 * Determinístico/puro — fácil de testar (f337-android-parity).
 * ========================================================================== */

data class InAppNotifItem(
    val key: String,          // dedup estável
    val kind: String,         // "sla" | "flow"
    val sev: String,          // laranja | vermelho | azul
    val critical: Boolean,
    val kicker: String,       // "SLA · PRAZO PRÓXIMO" / "FLUXO · DESIGNER EM PRODUÇÃO"
    val metric: String,       // "Vence em 29:43" / "Atrasada há 6 min" / "" (fluxo)
    val actorName: String?,   // fluxo: quem agiu (subtítulo)
    val actorPhoto: String?,
    val title: String,        // título da tarefa (completo, sem reticências essenciais)
    val client: String,
    val respName: String?,    // responsável (designer)
    val respPhoto: String?,
    val avatarPhoto: String?, // avatar grande (fluxo = ator; sla = responsável)
    val context: String,      // "Conclua até HH:mm" / "agora · equipe"
    val deepLink: String,     // "task:<id>"
    val taskId: String,
    val anchorMs: Long,
)

object InAppNotif {
    private fun firstName(s: String?): String? = s?.trim()?.split(" ")?.firstOrNull()?.ifBlank { null }
    private fun photoOf(users: List<UserLite>, id: String?): String? =
        id?.let { uid -> users.firstOrNull { it.id == uid }?.photo }
    private fun nameOf(users: List<UserLite>, id: String?): String? =
        id?.let { uid -> users.firstOrNull { it.id == uid }?.name }

    // currentUser pertence à EQUIPE da tarefa? designer + autor + atribuído + supervisão (canSeeAll).
    fun teamCanSee(user: UserLite?, t: TaskItem): Boolean {
        if (user == null) return false
        if (TaskVisibility.canSeeAllBoards(user)) return true
        val uid = user.id
        return t.assigneeId == uid || t.by == uid || t.designerAssignment?.designerId == uid
    }

    // SLA pessoal — SOMENTE quando o currentUser É o designer responsável (paridade Desktop).
    fun slaItems(
        user: UserLite?, tasks: List<TaskItem>, users: List<UserLite>,
        nowMs: Long = System.currentTimeMillis(),
    ): List<InAppNotifItem> {
        if (user == null) return emptyList()
        val hm = SimpleDateFormat("HH:mm", Locale.getDefault())
        val out = ArrayList<InAppNotifItem>()
        for (t in tasks) {
            val respId = (t.designerAssignment?.designerId ?: t.assigneeId) ?: continue
            if (respId != user.id) continue                       // só o designer responsável recebe SLA pessoal
            val d = SlaContract.resolve(t, nowMs)
            if (!d.inPanel) continue                              // só laranja/vermelho/crítico
            val pd = d.finishMs
            val kicker: String; val metric: String; val ctx: String; val ev: String
            if (d.critical) {
                kicker = "SLA · ATRASO CRÍTICO"; metric = "Atrasada há ${d.overdueMin} min"
                ctx = "Conclua imediatamente ou sinalize atraso"; ev = "critical"
            } else if (d.sev == "vermelho") {
                kicker = "SLA · PRAZO ENCERRADO"; metric = "Atrasada há ${d.overdueMin} min"
                ctx = "Vencia ${hm.format(Date(pd))} · conclua já"; ev = "overdue"
            } else {
                kicker = "SLA · PRAZO PRÓXIMO"; metric = "Vence em ${mmss(pd - nowMs)}"
                ctx = "Conclua até ${hm.format(Date(pd))}"; ev = "warning"
            }
            val respName = firstName(nameOf(users, respId) ?: t.designerAssignment?.designerName) ?: "—"
            val respPhoto = photoOf(users, respId) ?: t.designerAssignment?.designerAvatar
            out.add(
                InAppNotifItem(
                    key = "${t.id}__sla_${ev}__$pd", kind = "sla", sev = d.sev, critical = d.critical,
                    kicker = kicker, metric = metric, actorName = null, actorPhoto = null,
                    title = t.title ?: t.id, client = t.client ?: "",
                    respName = "$respName (você)", respPhoto = respPhoto, avatarPhoto = respPhoto,
                    context = ctx, deepLink = "task:${t.id}", taskId = t.id, anchorMs = pd,
                ),
            )
        }
        out.sortWith(
            compareByDescending<InAppNotifItem> { it.critical }
                .thenByDescending { it.sev == "vermelho" }.thenBy { it.anchorMs },
        )
        return out
    }

    // Mapa fase atual por tarefa visível à EQUIPE — base para detectar transição entre snapshots.
    fun phaseMap(user: UserLite?, tasks: List<TaskItem>): Map<String, TaskPhase> {
        val m = HashMap<String, TaskPhase>()
        for (t in tasks) if (teamCanSee(user, t)) m[t.id] = FlowEngine.derivePhase(t)
        return m
    }

    // Fluxo/status — EQUIPE. Dispara só na TRANSIÇÃO de fase (prev → atual). Sem prev → nada (1º load).
    fun flowItems(
        user: UserLite?, tasks: List<TaskItem>, users: List<UserLite>,
        prev: Map<String, TaskPhase>, nowMs: Long = System.currentTimeMillis(),
    ): List<InAppNotifItem> {
        if (user == null) return emptyList()
        val out = ArrayList<InAppNotifItem>()
        for (t in tasks) {
            if (!teamCanSee(user, t)) continue
            val phase = FlowEngine.derivePhase(t)
            val before = prev[t.id] ?: continue                  // sem estado anterior → não dispara
            if (before == phase) continue                        // sem transição
            val actorId = (t.designerAssignment?.designerId ?: t.assigneeId) ?: t.by
            val actorName = firstName(nameOf(users, actorId))
            val actorPhoto = photoOf(users, actorId)
            val respId = t.designerAssignment?.designerId ?: t.assigneeId
            out.add(
                InAppNotifItem(
                    key = "${t.id}__flow_${phase.name}", kind = "flow", sev = "azul", critical = false,
                    kicker = "FLUXO · ${phaseTeamLabel(phase)}", metric = "",
                    actorName = actorName?.let { "$it ${actorVerb(phase)}" } ?: actorVerb(phase),
                    actorPhoto = actorPhoto,
                    title = t.title ?: t.id, client = t.client ?: "",
                    respName = firstName(nameOf(users, respId)), respPhoto = photoOf(users, respId),
                    avatarPhoto = actorPhoto ?: photoOf(users, respId),
                    context = "agora · equipe", deepLink = "task:${t.id}", taskId = t.id, anchorMs = nowMs,
                ),
            )
        }
        return out
    }

    private fun phaseTeamLabel(p: TaskPhase): String = when (p) {
        TaskPhase.PLANNING -> "EM PLANEJAMENTO"
        TaskPhase.AWAITING_DESIGNER -> "AGUARDANDO DESIGNER"
        TaskPhase.DESIGNER_PRODUCING -> "DESIGNER EM PRODUÇÃO"
        TaskPhase.DESIGNER_REVISING -> "DESIGNER EM REVISÃO"
        TaskPhase.DESIGNER_DELIVERED -> "DESIGNER ENTREGOU"
        TaskPhase.AWAITING_CLIENT_APPROVAL -> "AGUARDANDO CLIENTE"
        TaskPhase.CLIENT_REQUESTED_CHANGES -> "CLIENTE PEDIU AJUSTE"
        TaskPhase.COMPLETED -> "CONCLUÍDO FINAL"
    }

    private fun actorVerb(p: TaskPhase): String = when (p) {
        TaskPhase.DESIGNER_PRODUCING -> "iniciou a produção"
        TaskPhase.DESIGNER_REVISING -> "enviou para revisão"
        TaskPhase.DESIGNER_DELIVERED -> "entregou a arte"
        TaskPhase.AWAITING_CLIENT_APPROVAL -> "enviou ao cliente"
        TaskPhase.CLIENT_REQUESTED_CHANGES -> "registrou ajuste do cliente"
        TaskPhase.COMPLETED -> "concluiu o cronograma"
        TaskPhase.AWAITING_DESIGNER -> "atribuiu ao designer"
        TaskPhase.PLANNING -> "atualizou a tarefa"
    }

    // MM:SS (ceil nos segundos — paridade c/ slaCount do Desktop). Para a métrica "Vence em".
    private fun mmss(ms: Long): String {
        val s = kotlin.math.ceil(ms.coerceAtLeast(0L) / 1000.0).toLong()
        return "%02d:%02d".format(s / 60, s % 60)
    }
}
