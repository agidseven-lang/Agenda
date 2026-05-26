package br.com.idseven.agenda.nativebeta.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
    val sorted = others.sortedByDescending { chatByOther[it.id]?.lastAt ?: 0L }
    LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp), contentPadding = PaddingValues(top = 10.dp, bottom = 24.dp)) {
        item("h") { Text("Mensagens", color = Tokens.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 2.dp, bottom = 12.dp)) }
        items(sorted, key = { it.id }) { u -> ChatRow(u, chatByOther[u.id], me) { onOpenChat(u.id) } }
    }
}

@Composable
private fun ChatRow(user: UserLite, chat: Chat?, meId: String, onClick: () -> Unit) {
    val unread = chat?.unreadFor(meId) ?: 0L
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(16.dp))
            .background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)).clickable { onClick() }.padding(13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(user.photo, UserColor.of(user.id, user.color), user.name, 48.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(user.name ?: "—", color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(3.dp))
            Text(
                chat?.lastText ?: "Toque para conversar",
                color = if (unread > 0) Tokens.Ink else Tokens.Faint,
                fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End) {
            chat?.lastAt?.let { Text(DateUtil.hm(it), color = Tokens.Faint, fontSize = 10.5.sp) }
            if (unread > 0) {
                Spacer(Modifier.height(5.dp))
                Box(Modifier.size(22.dp).clip(CircleShape).background(Tokens.Accent), contentAlignment = Alignment.Center) {
                    Text(if (unread > 9) "9+" else "$unread", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
