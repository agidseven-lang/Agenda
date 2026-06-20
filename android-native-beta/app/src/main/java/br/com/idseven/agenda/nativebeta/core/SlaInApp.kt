package br.com.idseven.agenda.nativebeta.core

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextOverflow
import br.com.idseven.agenda.nativebeta.domain.SlaContract
import br.com.idseven.agenda.nativebeta.domain.TaskDisplayState
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.features.tasks.TaskVisibility
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* ============================================================================
 * F3.2.4 — SLA IN-APP (READ-SIDE / LOCAL) — paridade com o Desktop.
 * CONCEITO: o sino é SLA OPERACIONAL por PRAZO FINAL (designerSla.planDueAt):
 *   laranja  = faltam <= 30min para o término (designer_finish_warning);
 *   vermelho = término ultrapassado (designer_finish_overdue).
 * NÃO é por início: start_* é status de FLUXO (fica no card), nunca no sino.
 * NÃO envia FCM/push, NÃO lê slaEvents, NÃO escreve no Firestore, NÃO cria
 * coleção, NÃO altera o fluxo de tarefas. Estado lido = LOCAL (SharedPreferences).
 * ========================================================================== */

data class SlaInAppItem(
    val taskId: String, val eventType: String, val sev: String, val label: String,
    val text: String, val client: String, val title: String, val anchorMs: Long, val key: String,
)

// F3.3.2 — linha do PAINEL OPERACIONAL (read-side). Mesma regra/severidade do sino.
data class SlaOpRow(
    val taskId: String, val sev: String, val bucket: String, val finishMs: Long,
    val remainingMin: Long, val overdueMin: Long, val title: String, val client: String, val responsavel: String,
    val critical: Boolean = false,
)
data class SlaOpData(val overdue: List<SlaOpRow>, val warning: List<SlaOpRow>, val total: Int)

// F3.3.2 — RBAC do "Editar prazo": Social Media + Admin (espelha canSeeAll do Desktop).
// Designer comum / Cliente NÃO podem. (admin == true) OU cargo contém palavra de gestão.
object SlaRbac {
    private val MANAGER_KW = listOf("social", "gestor", "gerente", "diretor", "coordena", "supervisor", "admin", "dono", "owner", "ceo", "head")
    fun canEditPrazo(u: UserLite?): Boolean {
        if (u == null) return false
        if (u.admin) return true
        val r = (u.role ?: "").lowercase()
        return MANAGER_KW.any { r.contains(it) }
    }
}

object SlaInApp {
    /* F3.3.2 — prazo final e exclusões vêm da FONTE ÚNICA (SlaContract), igual ao chip do card
       e ao detalhe (paridade c/ Desktop resolveTaskDisplayState). Sem reimplementar limiares aqui. */
    fun finishMs(t: TaskItem): Long = SlaContract.finishMs(t)

    fun items(user: UserLite?, tasks: List<TaskItem>, nowMs: Long = System.currentTimeMillis()): List<SlaInAppItem> {
        val vis = TaskVisibility.visibleTasks(user, tasks)
        val hm = SimpleDateFormat("HH:mm", Locale.getDefault())
        val out = ArrayList<SlaInAppItem>()
        for (t in vis) {
            (t.designerAssignment?.designerId ?: t.assigneeId) ?: continue         // sem designer responsável
            val d = SlaContract.resolve(t, nowMs)                                  // FONTE ÚNICA
            if (!d.inPanel) continue                                               // só vermelho/laranja entram no sino
            val pd = d.finishMs
            val event: String; val text: String
            if (d.critical) {
                event = "designer_finish_critical"
                text = "Atraso crítico há ${d.overdueMin} min. Conclua imediatamente ou sinalize."
            } else if (d.sev == "vermelho") {
                event = "designer_finish_overdue"
                text = "Prazo ultrapassado há ${d.overdueMin} min. Conclua imediatamente."
            } else {
                event = "designer_finish_warning"
                text = "Faltam ${d.remainingMin} min — conclua até ${hm.format(Date(pd))}."
            }
            out.add(
                SlaInAppItem(
                    taskId = t.id, eventType = event, sev = d.sev, label = d.label, text = text,
                    client = t.client ?: "", title = t.title ?: t.id, anchorMs = pd, key = "${t.id}__${event}__$pd",
                ),
            )
        }
        out.sortWith(compareByDescending<SlaInAppItem> { it.sev == "vermelho" }.thenBy { it.anchorMs })
        return out
    }

    /* F3.3.2 — derivação do PAINEL OPERACIONAL por PRAZO FINAL (FONTE ÚNICA SlaContract.resolve).
       Duas seções: Atrasadas (vermelho) e Prazo próximo (laranja). Vermelho antes. READ-SIDE puro. */
    fun panel(
        user: UserLite?, tasks: List<TaskItem>, users: List<UserLite>,
        nowMs: Long = System.currentTimeMillis(),
    ): SlaOpData {
        val vis = TaskVisibility.visibleTasks(user, tasks)
        val rows = ArrayList<SlaOpRow>()
        for (t in vis) {
            // F3.3.2 (regra de fluxo): SLA só começa no ENVIO ao designer (semente designerSla).
            val designerId = (t.designerAssignment?.designerId ?: t.assigneeId) ?: continue
            val d = SlaContract.resolve(t, nowMs)                                  // FONTE ÚNICA
            if (!d.inPanel) continue
            val resp = users.firstOrNull { it.id == designerId }?.name?.trim()
                ?.split(" ")?.firstOrNull()?.ifBlank { null }
                ?: t.designerAssignment?.designerName?.trim()?.split(" ")?.firstOrNull() ?: "—"
            rows.add(SlaOpRow(t.id, d.sev, d.bucketOf(), d.finishMs, d.remainingMin, d.overdueMin, t.title ?: t.id, t.client ?: "", resp, d.critical))
        }
        rows.sortWith(compareByDescending<SlaOpRow> { it.sev == "vermelho" }.thenBy { it.finishMs })
        return SlaOpData(rows.filter { it.sev == "vermelho" }, rows.filter { it.sev == "laranja" }, rows.size)
    }

    private fun TaskDisplayState.bucketOf(): String = if (sev == "vermelho") "overdue" else "warning"

    fun hm(ms: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))
}

object SlaReadStore {
    private const val PREFS = "idseven_sla_inapp"
    private const val KEY = "read"
    fun read(ctx: Context): Set<String> =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(KEY, emptySet()) ?: emptySet()
    fun markRead(ctx: Context, key: String) {
        val cur = HashSet(read(ctx)); cur.add(key)
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY, cur).apply()
    }
    fun markAll(ctx: Context, keys: List<String>) {
        val cur = HashSet(read(ctx)); cur.addAll(keys)
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY, cur).apply()
    }
}

@Composable
fun SlaBell(unread: Int, onClick: () -> Unit, modifier: Modifier = Modifier) {
    // Box EXTERNO sem clip: o recorte circular fica só no disco do sino, NUNCA no badge
    // (antes o .clip(CircleShape) do Box externo cortava o contador no canto → "cortado").
    Box(modifier.size(40.dp).clickable { onClick() }, contentAlignment = Alignment.Center) {
        Box(
            Modifier.matchParentSize().clip(CircleShape).background(Color(0xFF1B2030)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.Notifications, contentDescription = "Alertas de SLA", tint = Color(0xFFE8ECF4), modifier = Modifier.size(21.dp))
        }
        if (unread > 0) {
            Box(
                Modifier.align(Alignment.TopEnd).size(17.dp).clip(CircleShape)
                    .background(Color(0xFFFF6B61)).border(2.dp, Color(0xFF0B0E14), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (unread > 9) "9+" else unread.toString(), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun SlaAlertsScreen(
    tasks: List<TaskItem>, currentUser: UserLite?,
    onOpenTask: (String) -> Unit, onBack: () -> Unit, onChanged: () -> Unit,
) {
    val ctx = LocalContext.current
    var bump by remember { mutableStateOf(0) }
    // Tempo real (read-side, sem backend): recomputa a cada 30s p/ atualizar contagem
    // regressiva e a transição laranja→vermelho mesmo sem mudança nas tarefas.
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(30_000); bump++ } }
    val read = remember(bump) { SlaReadStore.read(ctx) }
    val alerts = remember(tasks, currentUser, bump) { SlaInApp.items(currentUser, tasks) }
    Column(Modifier.fillMaxSize().background(Color(0xFF0B0E14))) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Voltar", color = Color(0xFF9FB0C8), fontSize = 13.sp, modifier = Modifier.clickable { onBack() })
            Spacer(Modifier.weight(1f))
            Text("Alertas de SLA", color = Color(0xFFEEF2F8), fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text(
                "Marcar todas", color = Color(0xFF9FB0C8), fontSize = 12.sp,
                modifier = Modifier.clickable { SlaReadStore.markAll(ctx, alerts.map { it.key }); bump++; onChanged() },
            )
        }
        if (alerts.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Sem alertas de SLA.", color = Color(0xFF8B97A8), fontSize = 13.sp)
            }
        } else {
            LazyColumn(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
                items(alerts, key = { it.key }) { a ->
                    val isRead = read.contains(a.key)
                    val dot = when (a.sev) {
                        "vermelho" -> Color(0xFFFF6B61); "laranja" -> Color(0xFFF2A93B); else -> Color(0xFF7FA6FF)
                    }
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                            .background(if (isRead) Color.Transparent else Color(0x107FA6FF))
                            .clickable { onOpenTask(a.taskId) }.padding(12.dp),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Box(Modifier.padding(top = 4.dp).size(9.dp).clip(CircleShape).background(dot))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(a.label.ifBlank { a.eventType }, color = Color(0xFFE8ECF4), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            if (a.text.isNotBlank()) {
                                Text(a.text, color = Color(0xFFCDD6E6), fontSize = 12.sp)
                            }
                            Text(
                                (if (a.client.isNotBlank()) a.client + " · " else "") + a.title,
                                color = Color(0xFF9FB0C8), fontSize = 12.sp, maxLines = 1,
                            )
                        }
                        if (!isRead) Text(
                            "Lida", color = Color(0xFFCCEEFF), fontSize = 11.sp,
                            modifier = Modifier.clickable { SlaReadStore.markRead(ctx, a.key); bump++; onChanged() },
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                }
            }
        }
    }
}

/* ============================================================================
 * F3.3.2 — PAINEL OPERACIONAL SLA (read-side) no TOPO do quadro do designer.
 * Por PRAZO FINAL: "Atrasadas" (vermelho) acima de "Prazo próximo" (laranja).
 * Contador dinâmico (ticker 30s). Não cobre cards (altura limitada), não envia
 * nada, não escreve, não toca navbar. Vazio ⇒ não renderiza (sem poluir).
 * ========================================================================== */
private val OP_RED = Color(0xFFFF6B61)
private val OP_AMBER = Color(0xFFF2A93B)
private val OP_GREEN = Color(0xFF37D196)

@Composable
fun SlaOpPanel(
    currentUser: UserLite?,
    tasks: List<TaskItem>,
    users: List<UserLite>,
    onOpenTask: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var bump by remember { mutableStateOf(0) }
    // Tempo real (read-side): recomputa a cada 30s p/ contagem regressiva e laranja→vermelho.
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(30_000); bump++ } }
    val data = remember(tasks, currentUser, users, bump) { SlaInApp.panel(currentUser, tasks, users) }
    // F3.3.2 (reteste owner): o painel APARECE SEMPRE no topo do quadro. Sem alertas ⇒ estado
    // vazio "Tudo em dia" (a área principal nunca some; só as listas internas).

    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF141A29))
            .border(1.dp, Color(0x16FFFFFF), RoundedCornerShape(16.dp)),
    ) {
        // Cabeçalho + contadores
        Row(
            Modifier.fillMaxWidth().padding(start = 14.dp, end = 12.dp, top = 11.dp, bottom = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(28.dp).clip(RoundedCornerShape(9.dp)).background(OP_AMBER.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                Text("⏱", fontSize = 14.sp)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Acompanhamento de prazos", color = Color(0xFFEEF2F8), fontSize = 13.5.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                // F3.3.2 (reteste): estado verde COMPACTO — mensagem inline no subtítulo (sem bloco extra).
                Text(
                    if (data.total == 0) "Nenhuma tarefa atrasada ou com prazo próximo." else "Prazo final das demandas — em tempo real",
                    color = Color(0xFF8B97A8), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            if (data.total == 0) OpPill("Tudo em dia", OP_GREEN)
            if (data.overdue.isNotEmpty()) OpPill("${data.overdue.size} atrasada" + (if (data.overdue.size == 1) "" else "s"), OP_RED)
            if (data.warning.isNotEmpty()) { Spacer(Modifier.width(6.dp)); OpPill("${data.warning.size} próx.", OP_AMBER) }
        }
        if (data.total > 0) {
            if (data.overdue.isNotEmpty()) OpSection("Atrasadas", OP_RED, data.overdue, onOpenTask)
            if (data.warning.isNotEmpty()) OpSection("Prazo próximo", OP_AMBER, data.warning, onOpenTask)
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun OpPill(text: String, color: Color) {
    Box(
        Modifier.clip(RoundedCornerShape(999.dp)).background(color.copy(alpha = 0.14f))
            .border(1.dp, color.copy(alpha = 0.34f), RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 5.dp),
    ) { Text(text, color = color, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, maxLines = 1) }
}

@Composable
private fun OpSection(title: String, color: Color, rows: List<SlaOpRow>, onOpenTask: (String) -> Unit) {
    val shown = rows.take(4)
    Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 2.dp)) {
        Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(7.dp))
            Text(title, color = color, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(7.dp))
            Box(Modifier.clip(RoundedCornerShape(7.dp)).background(Color(0x14FFFFFF)).padding(horizontal = 7.dp, vertical = 1.dp)) {
                Text("${rows.size}", color = Color(0xFFCDD6E6), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        shown.forEach { r -> OpRow(r, color, onOpenTask); Spacer(Modifier.height(6.dp)) }
        if (rows.size > shown.size) {
            Text("+${rows.size - shown.size} mais", color = Color(0xFF8B97A8), fontSize = 11.sp, modifier = Modifier.padding(start = 4.dp, bottom = 4.dp))
        }
    }
}

@Composable
private fun OpRow(r: SlaOpRow, color: Color, onOpenTask: (String) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp)).background(Color(0x09FFFFFF))
            .border(1.dp, Color(0x10FFFFFF), RoundedCornerShape(11.dp)).clickable { onOpenTask(r.taskId) }
            .padding(start = 9.dp, end = 9.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(4.dp).height(34.dp).clip(RoundedCornerShape(3.dp)).background(color))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(r.title.ifBlank { r.taskId }, color = Color(0xFFE8ECF4), fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                (if (r.client.isNotBlank()) r.client + " · " else "") + "resp. " + r.responsavel + " · prazo " + SlaInApp.hm(r.finishMs),
                color = Color(0xFF9FB0C8), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Text(
                if (r.critical) "Atraso crítico há ${r.overdueMin} min"
                else if (r.sev == "vermelho") "Atrasada há ${r.overdueMin} min"
                else "Faltam ${r.remainingMin} min",
                color = color, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            )
            if (r.sev == "vermelho") {
                Text(
                    if (r.critical) "Atraso crítico — conclua imediatamente ou sinalize."
                    else "Conclua em até 10 min ou sinalize atraso.",
                    color = Color(0xFFFFB0A8), fontSize = 10.5.sp, modifier = Modifier.padding(top = 1.dp),
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Box(
            Modifier.clip(RoundedCornerShape(9.dp)).background(Color(0x1A7FA6FF))
                .border(1.dp, Color(0x547FA6FF), RoundedCornerShape(9.dp)).clickable { onOpenTask(r.taskId) }
                .padding(horizontal = 10.dp, vertical = 7.dp),
        ) { Text("Abrir", color = Color(0xFFBCD0FF), fontSize = 11.5.sp, fontWeight = FontWeight.Bold) }
    }
}
