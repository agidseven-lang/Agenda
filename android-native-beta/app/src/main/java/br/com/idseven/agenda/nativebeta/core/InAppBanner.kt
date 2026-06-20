package br.com.idseven.agenda.nativebeta.core

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar

/* ============================================================================
 * F3.3.6-C — BANNER PREMIUM IN-APP (Compose). Implementa os 4 mockups aprovados
 * (laranja/vermelho/crítico/fluxo). Full-width no topo, acento por severidade,
 * foto real (Avatar), título completo, responsável, autor (fluxo), prazo, CTA,
 * deep-link e contador de fila. READ-SIDE puro: não envia push, não grava nada.
 * ========================================================================== */

private fun sevColor(sev: String): Color = when (sev) {
    "laranja" -> Color(0xFFF2A93B)
    "vermelho" -> Color(0xFFFF6B61)
    else -> Color(0xFF7FA6FF)
}
private val INDIGO = Color(0xFF7C83FF)

@Composable
fun InAppBanner(
    items: List<InAppNotifItem>,
    onOpen: (String) -> Unit,
    onSeen: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) return
    val item = items.first()
    // Auto-dismiss premium: some sozinho após alguns segundos (continua no sino/painel se for SLA).
    LaunchedEffect(item.key) {
        kotlinx.coroutines.delay(6500)
        onSeen(item.key)
    }
    BannerCard(
        item = item,
        queueTotal = items.size,
        onOpen = { onSeen(item.key); onOpen(item.deepLink) },
        onDismiss = { onSeen(item.key) },
        modifier = modifier,
    )
}

@Composable
private fun BannerCard(
    item: InAppNotifItem,
    queueTotal: Int,
    onOpen: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sev = sevColor(item.sev)
    val ctaCol = if (item.kind == "flow") INDIGO else sev
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0xFF161D2E))
            .border(
                if (item.critical) 1.5.dp else 1.dp,
                if (item.critical) sev.copy(alpha = 0.55f) else Color(0x12FFFFFF),
                RoundedCornerShape(18.dp),
            )
            // acento lateral por severidade (barra arredondada à esquerda).
            .drawBehind {
                val inset = 13.dp.toPx()
                drawRoundRect(
                    color = sev,
                    topLeft = Offset(7.dp.toPx(), inset),
                    size = Size(4.dp.toPx(), this.size.height - inset * 2),
                    cornerRadius = CornerRadius(3.dp.toPx(), 3.dp.toPx()),
                )
            }
            .padding(start = 20.dp, end = 12.dp, top = 11.dp, bottom = 11.dp),
    ) {
        // ── cabeçalho: dot + kicker + selo crítico + (n/N) + fechar ──
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(sev))
            Spacer(Modifier.width(8.dp))
            Text(
                item.kicker, color = sev, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
            )
            if (item.critical) { Spacer(Modifier.width(8.dp)); CritBadge(sev) }
            Spacer(Modifier.weight(1f))
            if (queueTotal > 1) {
                Box(
                    Modifier.clip(RoundedCornerShape(8.dp)).background(Color(0x1AFFFFFF))
                        .padding(horizontal = 7.dp, vertical = 2.dp),
                ) { Text("1/$queueTotal", color = Color(0xFFCDD6E6), fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                Spacer(Modifier.width(8.dp))
            }
            Box(Modifier.size(20.dp).clip(CircleShape).clickable { onDismiss() }, contentAlignment = Alignment.Center) {
                Text("✕", color = Color(0xFF6E7480), fontSize = 13.sp)
            }
        }
        // ── corpo: avatar grande + coluna de texto ──
        Row(Modifier.padding(top = 11.dp)) {
            Avatar(photo = item.avatarPhoto, ringColor = sev, name = item.actorName ?: item.respName ?: item.title, size = 46.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                if (item.kind == "flow") {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(photo = item.actorPhoto, ringColor = sev, name = item.actorName, size = 20.dp)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            item.actorName ?: "", color = Color(0xFFE8ECF4), fontSize = 13.5.sp,
                            fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                } else {
                    Text(item.metric, color = sev, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
                Text(
                    item.title, color = Color(0xFFEEF2F8), fontSize = 14.5.sp, fontWeight = FontWeight.Bold,
                    lineHeight = 18.sp, modifier = Modifier.padding(top = 3.dp),
                )
                if (item.client.isNotBlank()) {
                    Text(item.client, color = Color(0xFF9FB0C8), fontSize = 12.5.sp, modifier = Modifier.padding(top = 2.dp))
                }
                if (!item.respName.isNullOrBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 7.dp)) {
                        Avatar(photo = item.respPhoto, ringColor = Color(0xFF2A3146), name = item.respName, size = 18.dp)
                        Spacer(Modifier.width(7.dp))
                        Text(
                            "resp. ${item.respName}", color = Color(0xFF9FB0C8), fontSize = 12.sp,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                if (item.context.isNotBlank()) {
                    Text(
                        item.context, color = if (item.critical) Color(0xFFFFC9C2) else Color(0xFFCDD6E6),
                        fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
        // ── rodapé: chip de deep-link + CTA "Abrir tarefa" ──
        Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.clip(RoundedCornerShape(8.dp)).background(Color(0x0DFFFFFF))
                    .border(1.dp, Color(0x12FFFFFF), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp),
            ) { Text(item.deepLink, color = Color(0xFF6E7480), fontSize = 11.sp) }
            Spacer(Modifier.weight(1f))
            Box(
                Modifier.clip(RoundedCornerShape(11.dp)).background(ctaCol.copy(alpha = 0.14f))
                    .border(1.dp, ctaCol.copy(alpha = 0.42f), RoundedCornerShape(11.dp))
                    .clickable { onOpen() }.padding(horizontal = 12.dp, vertical = 8.dp),
            ) { Text("Abrir tarefa  →", color = ctaCol, fontSize = 12.5.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun CritBadge(sev: Color) {
    Box(
        Modifier.clip(RoundedCornerShape(6.dp)).background(sev.copy(alpha = 0.20f))
            .border(1.dp, sev.copy(alpha = 0.50f), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
    ) { Text("CRÍTICO", color = Color(0xFFFFD7D2), fontSize = 9.5.sp, fontWeight = FontWeight.Black) }
}
