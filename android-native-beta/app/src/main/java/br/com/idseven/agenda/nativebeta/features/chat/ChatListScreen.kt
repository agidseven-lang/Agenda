package br.com.idseven.agenda.nativebeta.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.data.ChatRepo
import br.com.idseven.agenda.nativebeta.data.UserSession
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar
import br.com.idseven.agenda.nativebeta.designsystem.components.EmptyState
import br.com.idseven.agenda.nativebeta.designsystem.components.SearchField
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.Chat
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil

@Composable
fun ChatListScreen(session: UserSession, users: List<UserLite>, onOpenChat: (String) -> Unit) {
    val me = session.uid
    val chats by remember(me) { ChatRepo.chats(me) }.collectAsState(initial = emptyList())
    val others = users.filter { it.isActive() && it.id != me }
    if (others.isEmpty()) {
        EmptyState("Sem contatos", "Os membros da equipe aparecem aqui para conversar", Icons.Outlined.ChatBubbleOutline)
        return
    }
    val chatByOther = chats.associateBy { it.otherId(me) }
    var query by remember { mutableStateOf("") }
    val q = query.trim().lowercase()
    val filtered = others
        .filter { u -> q.isEmpty() || (u.name ?: "").lowercase().contains(q) || (chatByOther[u.id]?.lastText ?: "").lowercase().contains(q) }
        .sortedByDescending { chatByOther[it.id]?.lastAt ?: 0L }
    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Text("Mensagens", color = Tokens.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 18.dp, top = 12.dp, bottom = 4.dp))
        SearchField(query, { query = it }, "Buscar conversa…")
        Spacer(Modifier.height(4.dp))
        LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(bottom = 24.dp)) {
            itemsIndexed(filtered, key = { _, u -> u.id }) { index, u ->
                ChatRow(u, chatByOther[u.id], me) { onOpenChat(u.id) }
                if (index < filtered.lastIndex) RowDivider()
            }
        }
    }
}

@Composable
private fun ChatRow(user: UserLite, chat: Chat?, meId: String, onClick: () -> Unit) {
    val unread = chat?.unreadFor(meId) ?: 0L
    val mineLast = chat?.lastBy != null && chat.lastBy == meId
    Row(
        modifier = Modifier.fillMaxWidth().clickable { onClick() }.padding(horizontal = 16.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(user.photo, UserColor.of(user.id, user.color), user.name, 54.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(user.name ?: "—", color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                chat?.lastAt?.let {
                    Text(
                        DateUtil.chatStamp(it),
                        color = if (unread > 0) Tokens.Accent else Tokens.Faint,
                        fontSize = 11.5.sp,
                        fontWeight = if (unread > 0) FontWeight.Bold else FontWeight.Normal,
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (chat?.lastText != null && mineLast) {
                    Icon(Icons.Outlined.DoneAll, contentDescription = null, tint = Tokens.Soft, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                }
                Text(
                    chat?.lastText ?: "Toque para conversar",
                    color = if (unread > 0) Tokens.Soft else Tokens.Faint,
                    fontSize = 13.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (unread > 0) {
                    Spacer(Modifier.width(8.dp))
                    Box(Modifier.size(20.dp).clip(CircleShape).background(Tokens.Accent), contentAlignment = Alignment.Center) {
                        Text(if (unread > 9) "9+" else "$unread", color = Color.White, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun RowDivider() {
    Box(Modifier.fillMaxWidth().padding(start = 84.dp).height(1.dp).background(Tokens.Line))
}
