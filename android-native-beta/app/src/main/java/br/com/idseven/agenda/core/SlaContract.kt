package br.com.idseven.agenda.core

/**
 * DESIGNER SLA ENGINE — CONTRATO (FASE 4.1, autorização limitada).
 *
 * SOMENTE CONSTANTES: nenhum comportamento, nenhuma UI, nenhum listener é
 * alterado nesta fase. Este arquivo fixa, no codebase Kotlin nativo real, os
 * MESMOS nomes de flags/campos/eventos usados pelo Worker (cloudflare-worker.js,
 * __slaCore) e pelo Desktop (SLA_CONTRACT no renderer) — paridade de contrato
 * para as fases seguintes (UI mobile, FCM laranja/vermelho, bloqueio) que
 * exigem nova autorização explícita.
 *
 * Flags: TODAS OFF por padrão. O estado vivo morará em appConfig/flags.
 */
object SlaContract {
    // feature flags (default OFF — espelho de SLA_FLAG_DEFAULTS do Worker)
    const val FLAG_SLA_ENGINE = "slaEngine"
    const val FLAG_SLA_NOTIFICATIONS = "slaNotifications"
    const val FLAG_OPERATIONAL_BLOCKING = "operationalBlocking"
    const val FLAG_WIP_LIMITS = "wipLimits"
    const val FLAG_SLA_PANEL = "slaPanel"
    const val FLAG_SLA_CARD_BADGES = "slaCardBadges"
    val FLAG_DEFAULTS: Map<String, Boolean> = mapOf(
        FLAG_SLA_ENGINE to false, FLAG_SLA_NOTIFICATIONS to false,
        FLAG_OPERATIONAL_BLOCKING to false, FLAG_WIP_LIMITS to false,
        FLAG_SLA_PANEL to false, FLAG_SLA_CARD_BADGES to false,
    )

    // defaults autorizados
    const val START_WARNING_MINUTES = 30
    const val FINISH_WARNING_MINUTES = 30
    const val WIP_HARD_PER_DESIGNER = 2

    // campo aditivo no doc da tarefa (mapa) + subcampos lidos pelo app nas fases futuras
    const val FIELD_DESIGNER_SLA = "designerSla"
    const val SLA_STATUS = "slaStatus"               // aguardando_inicio|inicio_proximo|inicio_atrasado|em_producao|entrega_proxima|entrega_atrasada|entregue|cancelada
    const val SLA_SEVERITY = "slaSeverity"           // ok|laranja|vermelho
    const val SLA_PLANNED_START_AT = "plannedStartAt"
    const val SLA_PLANNED_FINISH_AT = "plannedFinishAt"
    const val SLA_IS_BLOCKED = "isBlocked"           // bloqueio REAL — OFF nesta fase
    const val SLA_BLOCKED_CANDIDATE = "blockedCandidate" // simulação registrada pelo Worker

    // coleções novas (aditivas)
    const val COLL_SLA_EVENTS = "slaEvents"
    const val COLL_DESIGNER_LOCKS = "designerLocks"
    const val COLL_WIP_LIMITS = "wipLimits"
    const val COLL_ADMIN_OVERRIDES = "adminOverrides"
    const val COLL_METRICS_DAILY = "kanbanMetricsDaily"

    // tipos de evento autorizados (espelho de SLA_EVENT_TYPES do Worker)
    val EVENT_TYPES = listOf(
        "designer_task_assigned", "designer_task_started", "designer_task_completed",
        "designer_start_warning", "designer_start_overdue",
        "designer_finish_warning", "designer_finish_overdue",
        "designer_blocked_by_overdue", "designer_unblocked",
        "designer_admin_override", "designer_wip_limit_reached",
    )
}
