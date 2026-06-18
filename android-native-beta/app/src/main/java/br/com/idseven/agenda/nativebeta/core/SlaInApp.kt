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

object SlaInApp {
    private const val FINISH_WARN_MS = 30 * 60000L

    fun items(user: UserLite?, tasks: List<TaskItem>, nowMs: Long = System.currentTimeMillis()): List<SlaInAppItem> {
        val vis = TaskVisibility.visibleTasks(user, tasks)
        val hm = SimpleDateFormat("HH:mm", Locale.getDefault())
        val out = ArrayList<SlaInAppItem>()
        for (t in vis) {
            val ds = t.designerSla
            val finished = ds?.finishedAt ?: t.doneAt
            val delivered = (finished != null && finished > 0L) ||
                t.designerFlowStatus == "entregue" || t.designerFlowStatus == "concluido" || t.status == "concluido"
            if (delivered) continue
            val pd = ds?.planDueAt ?: continue
            if (pd <= 0L) continue
            val event: String; val sev: String; val label: String; val text: String
            if (nowMs > pd) {
                val over = kotlin.math.max(1L, Math.round((nowMs - pd) / 60000.0))
                event = "designer_finish_overdue"; sev = "vermelho"; label = "Prazo encerrado"
                text = "Prazo ultrapassado há $over min. Conclua imediatamente."
            } else if (nowMs >= pd - FINISH_WARN_MS) {
                val left = kotlin.math.max(1L, Math.round((pd - nowMs) / 60000.0))
                event = "designer_finish_warning"; sev = "laranja"; label = "Prazo próximo"
                text = "Faltam $left min — conclua até ${hm.format(Date(pd))}."
            } else {
                continue
            }
            out.add(
                SlaInAppItem(
                    taskId = t.id, eventType = event, sev = sev, label = label, text = text,
                    client = t.client ?: "", title = t.title ?: t.id, anchorMs = pd, key = "${t.id}__${event}__$pd",
                ),
            )
        }
        out.sortWith(compareByDescending<SlaInAppItem> { it.sev == "vermelho" }.thenBy { it.anchorMs })
        return out
    }
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
