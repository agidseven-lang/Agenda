package br.com.idseven.agenda.nativebeta.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.font.FontWeight
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

@Composable
fun ChatThreadScreen(session: UserSession, otherId: String, users: List<UserLite>, onBack: () -> Unit) {
    val me = session.uid
    val other = users.firstOrNull { it.id == otherId }
    val scope = rememberCoroutineScope()

    var chatId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(otherId) { ChatRepo.openOrCreate(me, otherId).onSuccess { chatId = it } }

    val messages by remember(chatId) {
        chatId?.let { ChatRepo.messages(it) } ?: flowOf(emptyList())
    }.collectAsState(initial = emptyList())

    LaunchedEffect(chatId, messages.size) { chatId?.let { ChatRepo.markRead(it, me) } }

    val listState = rememberLazyListState()
    LaunchedEffect(messages.size) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1) }

    var input by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, top = 16.dp, end = 14.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Close, contentDescription = "Voltar", tint = Tokens.Soft, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Avatar(other?.photo, UserColor.of(otherId, other?.color), other?.name, 38.dp)
            Spacer(Modifier.width(10.dp))
            Text(other?.name ?: "Conversa", color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.Line))

        if (messages.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("Nenhuma mensagem ainda — diga olá 👋", color = Tokens.Faint, fontSize = 13.sp)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 14.dp),
                state = listState,
                contentPadding = PaddingValues(vertical = 12.dp),
            ) {
                items(messages, key = { it.id }) { msg -> MessageBubble(msg, mine = msg.by == me) }
            }
        }

        // Input
        Row(
            modifier = Modifier.fillMaxWidth().background(Tokens.Surface).padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("Mensagem…") },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(22.dp),
                maxLines = 4,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Tokens.Accent, unfocusedBorderColor = Tokens.Line,
                    focusedTextColor = Tokens.Ink, unfocusedTextColor = Tokens.Ink, cursorColor = Tokens.Accent,
                ),
            )
            Spacer(Modifier.width(8.dp))
            val canSend = input.isNotBlank() && chatId != null
            Box(
                modifier = Modifier.size(48.dp).clip(RoundedCornerShape(24.dp))
                    .background(if (canSend) Tokens.Accent else Tokens.Surface2)
                    .clickable(enabled = canSend) {
                        val cid = chatId ?: return@clickable
                        val text = input
                        input = ""
                        scope.launch { ChatRepo.send(cid, me, otherId, text) }
                    },
                contentAlignment = Alignment.Center,
            ) { Text("➤", color = if (canSend) Color.White else Tokens.Faint, fontSize = 18.sp) }
        }
    }
}

@Composable
private fun MessageBubble(msg: Message, mine: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 280.dp).clip(
                RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = if (mine) 16.dp else 4.dp, bottomEnd = if (mine) 4.dp else 16.dp)
            ).background(if (mine) Tokens.Accent else Tokens.Surface).padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Text(msg.text, color = if (mine) Color.White else Tokens.Ink, fontSize = 14.sp)
            Spacer(Modifier.height(2.dp))
            Text(DateUtil.hm(msg.at), color = if (mine) Color.White.copy(alpha = 0.7f) else Tokens.Faint, fontSize = 10.sp)
        }
    }
}
