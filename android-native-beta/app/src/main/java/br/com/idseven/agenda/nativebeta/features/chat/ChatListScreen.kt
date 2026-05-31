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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Done
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material.icons.outlined.SearchOff
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
    val unreadTotal = chats.sumOf { it.unreadFor(me) }
    // "Nenhuma conversa ainda" só quando existem contatos mas nenhum chat com mensagem.
    val anyConversation = chats.any { (it.lastAt ?: 0L) > 0L }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        // Header premium (titulo + subtitulo com contador de nao lidas).
        Column(Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 6.dp)) {
            Text("Mensagens", color = Tokens.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(
                when {
                    unreadTotal > 0L -> "$unreadTotal não lida${if (unreadTotal > 1L) "s" else ""} · equipe ID Seven"
                    else -> "Conversas da equipe ID Seven"
                },
                color = Tokens.Faint, fontSize = 12.5.sp, modifier = Modifier.padding(top = 2.dp),
            )
        }
        SearchField(query, { query = it }, "Buscar conversa…")
        Spacer(Modifier.height(2.dp))
        when {
            // Busca sem resultado.
            filtered.isEmpty() && q.isNotEmpty() -> EmptyStateInline(
                Icons.Outlined.SearchOff, "Nada encontrado",
                "Nenhuma conversa para “$query”. Tente outro nome ou trecho da mensagem.",
            )
            // Existem contatos mas ainda nenhuma conversa iniciada.
            !anyConversation -> EmptyStateInline(
                Icons.Outlined.ChatBubbleOutline, "Nenhuma conversa ainda",
                "Toque em alguém da equipe para iniciar o atendimento por aqui.",
            )
            else -> LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(filtered, key = { it.id }) { u ->
                    ChatCard(u, chatByOther[u.id], me) { onOpenChat(u.id) }
                }
            }
        }
    }
}

/* Card de conversa (estilo premium, WhatsApp Business): avatar, nome, ultima
   mensagem com tick correto (✓ enviada vs ✓✓ lida, conforme readBy do destinatário),
   horario/data e badge de nao lidas. Conversas com nao lidas ganham destaque sutil. */
@Composable
private fun ChatCard(user: UserLite, chat: Chat?, meId: String, onClick: () -> Unit) {
    val unread = chat?.unreadFor(meId) ?: 0L
    val hasUnread = unread > 0L
    val mineLast = chat?.lastBy != null && chat.lastBy == meId
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (hasUnread) Tokens.Surface2 else Tokens.Surface)
            .border(1.dp, if (hasUnread) Tokens.Accent.copy(alpha = 0.35f) else Tokens.Line, RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(user.photo, UserColor.of(user.id, user.color), user.name, 52.dp)
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    user.name ?: "—",
                    color = Tokens.Ink, fontSize = 15.5.sp,
                    fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                chat?.lastAt?.let {
                    Text(
                        DateUtil.chatStamp(it),
                        color = if (hasUnread) Tokens.Accent else Tokens.Faint,
                        fontSize = 11.5.sp,
                        fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.Normal,
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Tick na lista (estilo WhatsApp): só p/ MINHAS últimas mensagens.
                // Lida quando o destinatário marcou readBy (lastReadAt[other] > 0).
                if (mineLast && chat?.lastText != null) {
                    val readByOther = chat.unreadFor(user.id) == 0L && (chat.lastAt ?: 0L) > 0L
                    Icon(
                        imageVector = if (readByOther) Icons.Outlined.DoneAll else Icons.Outlined.Done,
                        contentDescription = if (readByOther) "Lida" else "Enviada",
                        tint = if (readByOther) Tokens.Accent else Tokens.Soft,
                        modifier = Modifier.size(15.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                }
                Text(
                    chat?.lastText ?: "Toque para conversar",
                    color = if (hasUnread) Tokens.Ink else Tokens.Faint,
                    fontSize = 13.5.sp,
                    fontWeight = if (hasUnread) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (hasUnread) {
                    Spacer(Modifier.width(8.dp))
                    Box(Modifier.size(22.dp).clip(CircleShape).background(Tokens.Accent), contentAlignment = Alignment.Center) {
                        Text(if (unread > 99) "99+" else "$unread", color = Color.White, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/* Estado vazio "inline" (para busca sem resultado e "nenhuma conversa ainda"),
   alinhado ao visual do app sem ocupar a tela inteira como o EmptyState global. */
@Composable
private fun EmptyStateInline(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String) {
    Column(
        modifier = Modifier.fillMaxWidth().heightIn(min = 220.dp).padding(horizontal = 28.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.size(64.dp).clip(CircleShape).background(Tokens.Surface2), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Tokens.Accent, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(14.dp))
        Text(title, color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, color = Tokens.Faint, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 6.dp))
    }
}
