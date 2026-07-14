package br.com.idseven.agenda.nativebeta.features.events

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.AddCircle
import androidx.compose.material.icons.outlined.AssignmentInd
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Cancel
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.data.EventRepo
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar
import br.com.idseven.agenda.nativebeta.designsystem.components.LoadingState
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.EventStatus
import br.com.idseven.agenda.nativebeta.domain.Types
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil
import kotlinx.coroutines.launch

@Composable
fun EventDetailScreen(
    id: String,
    users: List<UserLite>,
    canManage: Boolean,
    currentUid: String?,
    onBack: () -> Unit,
    onEdit: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val flow = remember(id) { EventRepo.event(id) }
    val event by flow.collectAsState(initial = null)
    var busy by remember { mutableStateOf(false) }
    var confirmCancel by remember { mutableStateOf(false) }
    // F3.3.73I6C3A — exclusão DEFINITIVA (admin) com confirmação FORTE: digitar "EXCLUIR".
    var confirmDelete by remember { mutableStateOf(false) }
    var delText by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        // Cabeçalho
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 14.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Detalhes", color = Tokens.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            // F3.3.73I6C3 — Editar/Cancelar condicionais ao estado: cancelado não mostra ações;
            // Cancelar (lógico) só em Agendado/Em andamento (não finalizado).
            val evc = event
            if (canManage && evc != null && !EventStatus.isCancelled(evc)) {
                IconBtn(Icons.Outlined.Edit, Tokens.Soft) { onEdit(evc.id) }
                Spacer(Modifier.width(6.dp))
                if (!evc.done) {
                    IconBtn(Icons.Outlined.Cancel, Tokens.Red) { confirmCancel = true }
                    Spacer(Modifier.width(6.dp))
                }
            }
            IconBtn(Icons.Outlined.Close, Tokens.Soft) { onBack() }
        }

        val ev = event
        if (ev == null) {
            LoadingState()
        } else {
        val type = Types.of(ev.type)
        val owner = ev.ownerId?.let { oid -> users.firstOrNull { it.id == oid } }
            ?: users.firstOrNull { (it.name ?: "").trim().equals((ev.owner ?: "").trim(), ignoreCase = true) }
        val oc = if (owner != null) UserColor.of(owner.id, owner.color) else type.color
        val creator = ev.by?.let { b -> users.firstOrNull { it.id == b } }
        val doneByUser = ev.doneBy?.let { b -> users.firstOrNull { it.id == b } }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            // Pill tipo
            Box(Modifier.padding(bottom = 14.dp).clip(RoundedCornerShape(9.dp)).background(type.color.copy(alpha = 0.16f)).padding(horizontal = 12.dp, vertical = 7.dp)) {
                Text(type.label.uppercase(), color = type.color, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.05.sp)
            }
            Text(ev.title?.ifBlank { null } ?: ev.client ?: "Sem título", color = Tokens.Ink, fontSize = 25.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(20.dp))

            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp))) {
                if (!ev.client.isNullOrBlank()) DetailRow(Icons.Outlined.Person, "Cliente / Empresa") { ValueText(ev.client) }
                if (owner != null) DetailRow(Icons.Outlined.AssignmentInd, "Responsável") {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(owner.photo, oc, owner.name, 30.dp)
                        Spacer(Modifier.width(10.dp))
                        Text(owner.name ?: "—", color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(9.dp))
                        Box(Modifier.size(10.dp).clip(CircleShape).background(oc))
                    }
                } else if (!ev.owner.isNullOrBlank()) DetailRow(Icons.Outlined.AssignmentInd, "Responsável") { ValueText(ev.owner) }
                ev.date?.takeIf { it.isNotBlank() }?.let { d -> DetailRow(Icons.Outlined.CalendarMonth, "Data") { ValueText("${DateUtil.dayLabel(d)} · ${DateUtil.dayShort(d)}") } }
                DetailRow(Icons.Outlined.Schedule, "Horário") {
                    ValueText(if (!ev.start.isNullOrBlank()) (if (!ev.end.isNullOrBlank()) "${ev.start} — ${ev.end}" else ev.start!!) else "—")
                }
                EventStatus.startMs(ev)?.let { ms -> DetailRow(Icons.Outlined.AddCircle, "Início previsto") { ValueText(DateUtil.fmtMs(ms)) } }
                EventStatus.dueMs(ev)?.let { ms -> DetailRow(Icons.Outlined.CalendarMonth, "Término previsto") { ValueText(DateUtil.fmtMs(ms)) } }
                EventStatus.status(ev)?.let { si ->
                    val col = if (si.kind == "cancelled" || si.late) Tokens.Red else if (si.kind == "run") Tokens.Amber else Tokens.Green
                    DetailRow(Icons.Outlined.Schedule, "Situação") { Text(si.text, color = col, fontSize = 14.5.sp, fontWeight = FontWeight.Bold) }
                }
                if (ev.startedAt != null && ev.startedAt > 0) DetailRow(Icons.Outlined.Schedule, "Iniciada em") { ValueText(DateUtil.fmtMs(ev.startedAt)) }
                if (ev.done && ev.doneAt != null) DetailRow(Icons.Outlined.CheckCircle, "Finalizada em") {
                    ValueText(DateUtil.fmtMs(ev.doneAt) + (doneByUser?.name?.let { " · $it" } ?: ""))
                }
                if (EventStatus.isCancelled(ev) && ev.cancelledAt != null) {
                    val cancelledByUser = ev.cancelledBy?.let { b -> users.firstOrNull { it.id == b } }
                    DetailRow(Icons.Outlined.Cancel, "Cancelada em") {
                        ValueText(DateUtil.fmtMs(ev.cancelledAt) + (cancelledByUser?.name?.let { " · $it" } ?: ""))
                    }
                }
                if (!ev.location.isNullOrBlank()) DetailRow(Icons.Outlined.Place, "Local") { ValueText(ev.location) }
                if (!ev.notes.isNullOrBlank()) DetailRow(Icons.Outlined.Notes, "Observações") { ValueText(ev.notes) }
                DetailRow(Icons.Outlined.Person, "Criado por", last = true) { ValueText(creator?.name ?: "—") }
            }

            // F3.3.73I6C3 — ações de lifecycle só quando NÃO cancelado (cancelado é terminal na agenda ativa).
            if (!EventStatus.isCancelled(ev)) {
                Spacer(Modifier.height(16.dp))
                if (!ev.done && (ev.startedAt == null || ev.startedAt <= 0)) {
                    BigButton("Iniciar agora", Icons.Filled.PlayArrow, Tokens.Amber, Tokens.Amber.copy(alpha = 0.12f), enabled = !busy) {
                        busy = true; scope.launch { EventRepo.start(ev.id, currentUid); busy = false }
                    }
                    Spacer(Modifier.height(11.dp))
                }
                if (!ev.done) {
                    BigButton("Finalizar agora", Icons.Outlined.Check, Tokens.Ink, Tokens.Surface, enabled = !busy) {
                        busy = true; scope.launch { EventRepo.finish(ev.id, currentUid); busy = false }
                    }
                } else {
                    BigButton("Serviço finalizado ✓ (tocar para reabrir)", Icons.Outlined.Check, Tokens.Green, Tokens.Green.copy(alpha = 0.1f), enabled = !busy) {
                        busy = true; scope.launch { EventRepo.reopen(ev.id); busy = false }
                    }
                }
            }
            // F3.3.73I6C3A — EXCLUIR DEFINITIVAMENTE (hard delete): só admin (canManage), em
            // QUALQUER estado (agendado/andamento/finalizado/cancelado). Fica FORA do bloco de
            // lifecycle acima (que se esconde quando cancelado), pois excluir vale para cancelados.
            if (canManage) {
                Spacer(Modifier.height(if (EventStatus.isCancelled(ev)) 16.dp else 11.dp))
                BigButton("Excluir definitivamente", Icons.Outlined.DeleteForever, Tokens.Red, Tokens.Red.copy(alpha = 0.10f), enabled = !busy) {
                    delText = ""; confirmDelete = true
                }
            }
            Spacer(Modifier.height(28.dp))
            }
        }
    }

    if (confirmCancel) {
        AlertDialog(
            onDismissRequest = { confirmCancel = false },
            title = { Text("Cancelar compromisso") },
            text = { Text("Cancelar este compromisso para toda a equipe? Ele sai da agenda ativa (não é apagado).") },
            confirmButton = {
                TextButton(onClick = {
                    confirmCancel = false
                    scope.launch { EventRepo.cancel(id, currentUid).onSuccess { onBack() } }
                }) { Text("Sim, cancelar", color = Tokens.Red) }
            },
            dismissButton = { TextButton(onClick = { confirmCancel = false }) { Text("Voltar") } },
        )
    }

    // F3.3.73I6C3A — confirmação FORTE de EXCLUSÃO DEFINITIVA: aviso de irreversibilidade +
    // exigir digitar "EXCLUIR". Só então EventRepo.remove (grava deletedBy/deletedAt e apaga).
    if (confirmDelete) {
        val armed = delText.trim() == "EXCLUIR"
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Excluir definitivamente") },
            text = {
                Column {
                    Text("Esta ação é permanente e não poderá ser desfeita. O compromisso será removido de events para toda a equipe.")
                    Spacer(Modifier.height(12.dp))
                    Text("Para confirmar, digite EXCLUIR", color = Tokens.Faint, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    OutlinedTextField(value = delText, onValueChange = { delText = it }, singleLine = true, placeholder = { Text("EXCLUIR") })
                }
            },
            confirmButton = {
                TextButton(
                    enabled = armed && !busy,
                    onClick = {
                        confirmDelete = false; busy = true
                        scope.launch { EventRepo.remove(id, currentUid).onSuccess { onBack() }; busy = false }
                    },
                ) { Text("Excluir definitivamente", color = Tokens.Red) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Voltar") } },
        )
    }
}

@Composable
private fun DetailRow(icon: ImageVector, label: String, last: Boolean = false, value: @Composable () -> Unit) {
    Column {
        Row(modifier = Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface2).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)),
                contentAlignment = Alignment.Center,
            ) { Icon(icon, contentDescription = null, tint = Tokens.Accent, modifier = Modifier.size(20.dp)) }
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f)) {
                Text(label.uppercase(), color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp)
                Spacer(Modifier.height(4.dp))
                value()
            }
        }
        if (!last) Box(Modifier.fillMaxWidth().padding(start = 68.dp).height(1.dp).background(Color(0xFF222633)))
    }
}

@Composable
private fun ValueText(text: String?) {
    Text(text ?: "—", color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
}

@Composable
private fun IconBtn(icon: ImageVector, tint: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp)) }
}

@Composable
private fun BigButton(text: String, icon: ImageVector, fg: Color, bg: Color, enabled: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(bg)
            .border(1.5.dp, fg.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
            .clickable(enabled = enabled) { onClick() }
            .padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Text(text, color = fg, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
    }
}
