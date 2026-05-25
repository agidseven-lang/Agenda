package br.com.idseven.agenda.nativebeta.features.events

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.data.EventContract
import br.com.idseven.agenda.nativebeta.data.EventRepo
import br.com.idseven.agenda.nativebeta.designsystem.components.AppTextField
import br.com.idseven.agenda.nativebeta.designsystem.components.MessageBanner
import br.com.idseven.agenda.nativebeta.designsystem.components.PrimaryButton
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.Types
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.Calendar

@Composable
fun EventFormScreen(
    editId: String?,
    users: List<UserLite>,
    currentUid: String?,
    onDone: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var type by remember { mutableStateOf("gravacao") }
    var client by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(DateUtil.todayIso()) }
    var start by remember { mutableStateOf("") }
    var end by remember { mutableStateOf("") }
    var ownerId by remember { mutableStateOf<String?>(null) }
    var ownerName by remember { mutableStateOf("") }
    var ownerMenu by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(editId) {
        if (editId != null) {
            val ev = EventRepo.event(editId).first()
            if (ev != null) {
                type = ev.type ?: "gravacao"; client = ev.client ?: ""; title = ev.title ?: ""
                location = ev.location ?: ""; notes = ev.notes ?: ""
                date = ev.date ?: date; start = ev.start ?: ""; end = ev.end ?: ""
                ownerId = ev.ownerId; ownerName = ev.owner ?: ""
            }
        }
    }

    fun showDate() {
        val c = Calendar.getInstance()
        Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(date)?.let {
            c.set(it.groupValues[1].toInt(), it.groupValues[2].toInt() - 1, it.groupValues[3].toInt())
        }
        android.app.DatePickerDialog(context, { _, y, m, d ->
            date = "%04d-%02d-%02d".format(y, m + 1, d)
        }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show()
    }

    fun showTime(initial: String, onSet: (String) -> Unit) {
        var hh = 9; var mm = 0
        Regex("^(\\d{1,2}):(\\d{2})$").find(initial)?.let { hh = it.groupValues[1].toInt(); mm = it.groupValues[2].toInt() }
        android.app.TimePickerDialog(context, { _, h, m -> onSet("%02d:%02d".format(h, m)) }, hh, mm, true).show()
    }

    fun save() {
        error = null
        if (client.trim().isEmpty()) { error = "Informe o cliente / empresa"; return }
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(date)) { error = "Escolha a data"; return }
        val input = EventContract.Input(
            type = type, client = client.trim(), title = title.trim(), location = location.trim(),
            date = date, start = start, end = end, owner = ownerName.trim(), ownerId = ownerId, notes = notes.trim(),
        )
        busy = true
        scope.launch {
            val res: Result<Any?> = if (editId != null) EventRepo.update(editId, EventContract.base(input))
            else EventRepo.create(EventContract.create(input, currentUid, System.currentTimeMillis()))
            res.onSuccess { onDone() }.onFailure { error = it.message ?: "Erro ao salvar"; busy = false }
        }
    }

    val activeUsers = users.filter { it.isActive() }.sortedBy { (it.name ?: "").lowercase() }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 14.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(if (editId != null) "Editar compromisso" else "Novo compromisso", color = Tokens.Ink, fontSize = 21.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Box(
                modifier = Modifier.height(40.dp).clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onBack() }.padding(10.dp),
            ) { Icon(Icons.Outlined.Close, contentDescription = "Fechar", tint = Tokens.Soft, modifier = Modifier.size(20.dp)) }
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp)) {
            error?.let { MessageBanner(it, isError = true); Spacer(Modifier.height(14.dp)) }

            FieldLabel("Tipo")
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                Types.ALL.forEach { t ->
                    FilterChip(
                        selected = type == t.key,
                        onClick = { type = t.key },
                        label = { Text(t.label) },
                        modifier = Modifier.padding(end = 8.dp),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = t.color.copy(alpha = 0.18f),
                            selectedLabelColor = t.color,
                        ),
                    )
                }
            }
            Spacer(Modifier.height(16.dp))

            FieldLabel("Cliente / Empresa")
            AppTextField(client, { client = it }, "Ex.: Hospital Visão")
            Spacer(Modifier.height(14.dp))

            FieldLabel("Título")
            AppTextField(title, { title = it }, "Ex.: Gravação de vídeos")
            Spacer(Modifier.height(14.dp))

            FieldLabel("Local")
            AppTextField(location, { location = it }, "Estúdio, endereço ou link")
            Spacer(Modifier.height(14.dp))

            FieldLabel("Data")
            PickerField(if (date.isNotBlank()) "${DateUtil.dayLabel(date)} · ${DateUtil.dayShort(date)}" else "Escolher data") { showDate() }
            Spacer(Modifier.height(14.dp))

            Row {
                Column(Modifier.weight(1f)) {
                    FieldLabel("Início")
                    PickerField(start.ifBlank { "--:--" }) { showTime(start) { start = it } }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    FieldLabel("Término")
                    PickerField(end.ifBlank { "--:--" }) { showTime(end) { end = it } }
                }
            }
            Spacer(Modifier.height(14.dp))

            FieldLabel("Responsável")
            Box {
                PickerField(ownerName.ifBlank { "Selecionar da equipe" }) { ownerMenu = true }
                DropdownMenu(expanded = ownerMenu, onDismissRequest = { ownerMenu = false }) {
                    DropdownMenuItem(text = { Text("— Ninguém —") }, onClick = { ownerId = null; ownerName = ""; ownerMenu = false })
                    activeUsers.forEach { u ->
                        DropdownMenuItem(text = { Text(u.name ?: "—") }, onClick = { ownerId = u.id; ownerName = u.name ?: ""; ownerMenu = false })
                    }
                }
            }
            Spacer(Modifier.height(14.dp))

            FieldLabel("Observações")
            AppTextField(notes, { notes = it }, "Roteiro, equipamentos, briefing…")
            Spacer(Modifier.height(24.dp))

            PrimaryButton(if (editId != null) "Salvar alterações" else "Criar compromisso", loading = busy) { save() }
            Spacer(Modifier.height(28.dp))
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text.uppercase(), color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp, modifier = Modifier.padding(bottom = 6.dp))
}

@Composable
private fun PickerField(value: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onClick() }.padding(horizontal = 14.dp, vertical = 15.dp),
    ) { Text(value, color = Tokens.Ink, fontSize = 14.5.sp) }
}
