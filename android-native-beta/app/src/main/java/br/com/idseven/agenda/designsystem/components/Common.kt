package br.com.idseven.agenda.designsystem.components

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import br.com.idseven.agenda.designsystem.theme.Tokens
import br.com.idseven.agenda.domain.EventItem
import br.com.idseven.agenda.domain.EventStatus
import br.com.idseven.agenda.domain.Types
import br.com.idseven.agenda.domain.UserColor
import br.com.idseven.agenda.domain.UserLite

// ===== Componentes reutilizáveis (Design System SaaS) =====

@Composable
fun Avatar(photo: String?, ringColor: Color, name: String?, size: Dp, ring: Dp = 2.dp) {
    val bmp = remember(photo) { decodeAvatarBitmap(photo) }
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(ringColor).padding(ring),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier.fillMaxSize().clip(CircleShape).background(lerp(ringColor, Color.Black, 0.22f)),
            contentAlignment = Alignment.Center,
        ) {
            when {
                !photo.isNullOrBlank() && photo.startsWith("http") -> AsyncImage(
                    model = photo, contentDescription = null,
                    modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop,
                )
                bmp != null -> Image(
                    bitmap = bmp.asImageBitmap(), contentDescription = null,
                    modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop,
                )
                else -> Text(UserColor.initials(name), color = Color.White, fontSize = (size.value * 0.36f).sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

// Decodifica foto em base64 (data:image/...;base64,... ou base64 puro). Retorna null se não aplicável.
private fun decodeAvatarBitmap(photo: String?): android.graphics.Bitmap? {
    if (photo.isNullOrBlank() || photo.startsWith("http")) return null
    return try {
        val b64 = if (photo.startsWith("data:")) photo.substringAfter(",", "") else photo
        if (b64.length < 64) return null
        val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    } catch (_: Throwable) { null }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier = modifier, color = Tokens.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
}

@Composable
fun Pill(text: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.clip(RoundedCornerShape(7.dp)).background(color.copy(alpha = 0.16f)).padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text.uppercase(), color = color, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.04.sp)
    }
}

@Composable
fun StatusChip(text: String, color: Color, icon: ImageVector? = null, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.clip(RoundedCornerShape(8.dp)).background(color.copy(alpha = 0.12f)).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(text, color = color, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun LoadingState(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
fun EmptyState(title: String, subtitle: String, icon: ImageVector, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(18.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(18.dp)),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(26.dp)) }
        Spacer(Modifier.height(16.dp))
        Text(title, color = Tokens.Soft, fontSize = 15.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(subtitle, color = Tokens.Faint, fontSize = 12.5.sp, textAlign = TextAlign.Center)
    }
}

// Card de compromisso (mesmo desenho aprovado: barra na cor do responsável, avatar no topo,
// cliente/local empilhados, situação colorida).
@Composable
fun EventCard(event: EventItem, owner: UserLite?, onClick: () -> Unit = {}) {
    val type = Types.of(event.type)
    val ownerColor = UserColor.of(event.ownerId, owner?.color)
    val ownerName = owner?.name ?: event.owner
    val late = EventStatus.isLate(event)
    val borderColor = if (late) Tokens.Red.copy(alpha = 0.55f) else ownerColor.copy(alpha = 0.5f)

    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
            .clip(RoundedCornerShape(16.dp)).background(Tokens.Surface)
            .border(if (late) 2.dp else 1.dp, borderColor, RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(start = 14.dp, top = 14.dp, end = 16.dp, bottom = 16.dp),
    ) {
        Box(Modifier.width(4.dp).height(58.dp).clip(RoundedCornerShape(3.dp)).background(ownerColor))
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!ownerName.isNullOrBlank()) {
                    Avatar(owner?.photo, ownerColor, ownerName, 40.dp)
                    Spacer(Modifier.width(12.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        event.title?.ifBlank { null } ?: event.client ?: "Sem título",
                        color = Tokens.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    )
                    if (!ownerName.isNullOrBlank()) {
                        Text(UserColor.firstName(ownerName), color = ownerColor, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.width(10.dp))
                Column(horizontalAlignment = Alignment.End) {
                    Text(event.start ?: "--:--", color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    if (!event.end.isNullOrBlank()) Text(event.end, color = Tokens.Faint, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(13.dp))
            Pill(type.label, type.color)
            if (!event.client.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                InfoLine(Icons.Outlined.Person, event.client)
            }
            if (!event.location.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                InfoLine(Icons.Outlined.Place, event.location)
            }
            if (!event.notes.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                InfoLine(Icons.Outlined.Notes, event.notes)
            }
            EventStatus.status(event)?.let { si ->
                val col = if (si.late) Tokens.Red else if (si.kind == "run") Tokens.Amber else Tokens.Green
                Spacer(Modifier.height(11.dp))
                StatusChip(si.text, col, Icons.Outlined.Schedule)
            }
        }
    }
}

@Composable
private fun InfoLine(icon: ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = Tokens.Soft, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(9.dp))
        Text(text, color = Tokens.Ink, fontSize = 13.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
