package br.com.idseven.agenda.nativebeta.features.chat

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.outlined.ListAlt
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Done
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material.icons.outlined.EmojiEmotions
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.data.ChatRepo
import br.com.idseven.agenda.nativebeta.data.UserSession
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.Message
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch

// Respostas rápidas LOCAIS/estáticas (sem Firestore, sem painel admin). Arquitetura
// preparada p/ no futuro virar editável por setor: basta trocar esta fonte por dados
// remotos mantendo a mesma estrutura (categoria -> textos).
private val QUICK_REPLIES: List<Pair<String, List<String>>> = listOf(
    "Saudação" to listOf(
        "Olá! Tudo bem? Como posso ajudar?",
    ),
    "Confirmação" to listOf(
        "Recebido. Vou verificar e retorno em instantes.",
        "Perfeito, combinado.",
    ),
    "Solicitação" to listOf(
        "Pode me enviar mais detalhes, por favor?",
    ),
    "Encaminhamento" to listOf(
        "Encaminhei sua solicitação para o responsável.",
        "Sua demanda foi registrada. Assim que houver atualização, aviso por aqui.",
    ),
    "Retorno" to listOf(
        "Obrigado pelo retorno.",
        "Vou acompanhar e te aviso assim que for concluído.",
    ),
)

private val EMOJIS = listOf(
    "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "🙏",
    "👍", "👏", "🙌", "💪", "🔥", "✅", "❌", "⚠️", "🎉", "❤️",
    "💜", "💙", "💚", "🧡", "⭐", "✨", "📅", "📌", "📎", "📷",
    "🎥", "🎙️", "💬", "👀", "😴", "😅", "😉", "🤝", "👋", "🚀",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatThreadScreen(session: UserSession, otherId: String, users: List<UserLite>, onBack: () -> Unit) {
    val me = session.uid
    val other = users.firstOrNull { it.id == otherId }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var chatId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(otherId) { ChatRepo.openOrCreate(me, otherId).onSuccess { chatId = it } }

    val messages by remember(chatId) {
        chatId?.let { ChatRepo.messages(it) } ?: flowOf(emptyList())
    }.collectAsState(initial = emptyList())

    LaunchedEffect(chatId, messages.size) { chatId?.let { ChatRepo.markRead(it, me) } }

    val listState = rememberLazyListState()
    LaunchedEffect(messages.size) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1) }

    var input by remember { mutableStateOf("") }
    var showEmoji by remember { mutableStateOf(false) }
    val emojiSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showQuickReplies by remember { mutableStateOf(false) }
    val quickSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    fun send() {
        val cid = chatId ?: return
        val text = input
        if (text.isBlank()) return
        input = ""
        scope.launch { ChatRepo.send(cid, me, otherId, text) }
    }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        // Cabeçalho
        Row(
            modifier = Modifier.fillMaxWidth().background(Tokens.Surface).padding(start = 12.dp, top = 12.dp, end = 14.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(38.dp).clip(CircleShape).clickable { onBack() }, contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Close, contentDescription = "Voltar", tint = Tokens.Soft, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(8.dp))
            Avatar(other?.photo, UserColor.of(otherId, other?.color), other?.name, 42.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(other?.name ?: "Conversa", color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(other?.role?.ifBlank { null } ?: "Equipe ID Seven", color = Tokens.Soft, fontSize = 12.sp, maxLines = 1)
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.Line))

        // Mensagens
        if (messages.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("Nenhuma mensagem ainda — diga olá 👋", color = Tokens.Faint, fontSize = 13.sp)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
                state = listState,
                contentPadding = PaddingValues(vertical = 12.dp),
            ) {
                itemsIndexed(messages, key = { _, m -> m.id }) { index, msg ->
                    val mine = msg.by == me
                    val grouped = index > 0 && messages[index - 1].by == msg.by
                    MessageBubble(msg, mine, grouped, readByOther = msg.readBy.containsKey(otherId))
                }
            }
        }

        // Barra de envio
        Column(Modifier.fillMaxWidth().background(Tokens.Surface)) {
            // Atalho de respostas rápidas (textos prontos) — insere no campo, não envia.
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(Tokens.Surface2)
                        .clickable { showQuickReplies = true }.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.AutoMirrored.Outlined.ListAlt, contentDescription = null, tint = Tokens.Accent, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Respostas", color = Tokens.Accent, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("Mensagem") },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(24.dp),
                maxLines = 5,
                leadingIcon = {
                    Box(Modifier.size(36.dp).clip(CircleShape).clickable { showEmoji = true }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.EmojiEmotions, contentDescription = "Inserir emoji", tint = Tokens.Accent, modifier = Modifier.size(24.dp))
                    }
                },
                trailingIcon = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.AttachFile, contentDescription = "Anexar", tint = Tokens.Soft, modifier = Modifier.size(22.dp).clickable { Toast.makeText(context, "Anexos em breve", Toast.LENGTH_SHORT).show() })
                        Spacer(Modifier.width(12.dp))
                        Icon(Icons.Outlined.PhotoCamera, contentDescription = "Câmera", tint = Tokens.Soft, modifier = Modifier.size(22.dp).clickable { Toast.makeText(context, "Câmera em breve", Toast.LENGTH_SHORT).show() })
                        Spacer(Modifier.width(6.dp))
                    }
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Tokens.Accent, unfocusedBorderColor = Tokens.Line,
                    focusedTextColor = Tokens.Ink, unfocusedTextColor = Tokens.Ink, cursorColor = Tokens.Accent,
                ),
            )
            Spacer(Modifier.width(8.dp))
            val canSend = input.isNotBlank() && chatId != null
            // Botão de ENVIAR (texto). Áudio foi descartado por decisão de produto:
            // sem microfone, sem gravação. Quando não há texto, o botão fica desabilitado.
            Box(
                modifier = Modifier.size(50.dp).clip(CircleShape)
                    .background(if (canSend) Tokens.Accent else Tokens.Surface2)
                    .then(if (canSend) Modifier.clickable { send() } else Modifier),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Enviar",
                    tint = if (canSend) Color.White else Tokens.Faint,
                    modifier = Modifier.size(22.dp),
                )
            }
            }
        }
    }

    if (showEmoji) {
        ModalBottomSheet(onDismissRequest = { showEmoji = false }, sheetState = emojiSheetState, containerColor = Tokens.Surface) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 20.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Emojis", color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text("Toque para inserir na mensagem", color = Tokens.Faint, fontSize = 12.sp)
                    }
                    TextButton(onClick = { showEmoji = false }) {
                        Text("Pronto", color = Tokens.Accent, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Surface2).padding(horizontal = 12.dp, vertical = 11.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        input.ifBlank { "Sua mensagem aparece aqui…" },
                        color = if (input.isBlank()) Tokens.Faint else Tokens.Ink,
                        fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                    )
                    if (input.isNotEmpty()) {
                        Spacer(Modifier.width(8.dp))
                        Box(Modifier.size(26.dp).clip(CircleShape).clickable { input = input.dropLast(1) }, contentAlignment = Alignment.Center) {
                            Icon(Icons.Outlined.Close, contentDescription = "Apagar", tint = Tokens.Soft, modifier = Modifier.size(16.dp))
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Column(Modifier.heightIn(max = 260.dp).verticalScroll(rememberScrollState())) {
                    EMOJIS.chunked(8).forEach { rowEmojis ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            rowEmojis.forEach { e ->
                                Box(Modifier.size(40.dp).clip(CircleShape).clickable { input += e }, contentAlignment = Alignment.Center) {
                                    Text(e, fontSize = 24.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showQuickReplies) {
        ModalBottomSheet(onDismissRequest = { showQuickReplies = false }, sheetState = quickSheetState, containerColor = Tokens.Surface) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 20.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Respostas rápidas", color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text("Toque para inserir no campo — você pode editar antes de enviar", color = Tokens.Faint, fontSize = 12.sp)
                    }
                    TextButton(onClick = { showQuickReplies = false }) {
                        Text("Fechar", color = Tokens.Accent, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Column(Modifier.heightIn(max = 380.dp).verticalScroll(rememberScrollState())) {
                    QUICK_REPLIES.forEach { (categoria, textos) ->
                        Text(
                            categoria.uppercase(),
                            color = Tokens.Faint, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                        )
                        textos.forEach { texto ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                                    .clip(RoundedCornerShape(12.dp)).background(Tokens.Surface2)
                                    .clickable {
                                        // Insere no campo (NÃO envia). Se já houver texto,
                                        // acrescenta ao final com separação segura.
                                        input = if (input.isBlank()) texto else (input.trimEnd() + " " + texto)
                                        showQuickReplies = false
                                    }
                                    .padding(horizontal = 13.dp, vertical = 11.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(texto, color = Tokens.Ink, fontSize = 13.5.sp, modifier = Modifier.weight(1f))
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(msg: Message, mine: Boolean, grouped: Boolean, readByOther: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = if (grouped) 2.dp else 8.dp),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 290.dp).clip(
                RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = if (mine) 18.dp else 5.dp, bottomEnd = if (mine) 5.dp else 18.dp)
            ).background(if (mine) Tokens.Accent else Tokens.Surface).padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Text(msg.text, color = if (mine) Color.White else Tokens.Ink, fontSize = 14.5.sp)
            Spacer(Modifier.height(3.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                Text(DateUtil.hm(msg.at), color = if (mine) Color.White.copy(alpha = 0.7f) else Tokens.Faint, fontSize = 10.sp)
                // Ticks de leitura SÓ nas minhas mensagens (estilo WhatsApp):
                //  - enviada (destinatário ainda não leu): ✓ simples, neutro;
                //  - lida (readBy contém o uid do destinatário): ✓✓ em destaque sutil.
                if (mine) {
                    Spacer(Modifier.width(4.dp))
                    Icon(
                        imageVector = if (readByOther) Icons.Outlined.DoneAll else Icons.Outlined.Done,
                        contentDescription = if (readByOther) "Lida" else "Enviada",
                        tint = if (readByOther) Color(0xFF7FE7FF) else Color.White.copy(alpha = 0.65f),
                        modifier = Modifier.size(15.dp),
                    )
                }
            }
        }
    }
}
