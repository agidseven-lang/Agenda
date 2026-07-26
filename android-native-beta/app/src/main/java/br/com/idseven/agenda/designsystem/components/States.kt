package br.com.idseven.agenda.designsystem.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.designsystem.theme.Tokens

@Composable
fun ErrorState(message: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(18.dp)).background(Tokens.Red.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = Tokens.Red, modifier = Modifier.size(28.dp)) }
        Spacer(Modifier.height(16.dp))
        Text("Não foi possível carregar", color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(message, color = Tokens.Faint, fontSize = 12.5.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun shimmerBrush(): Brush {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(
        initialValue = -400f, targetValue = 800f,
        animationSpec = infiniteRepeatable(animation = tween(1300), repeatMode = RepeatMode.Restart),
        label = "x",
    )
    return Brush.linearGradient(
        colors = listOf(Tokens.Surface, Tokens.Surface2, Tokens.Surface),
        start = Offset(x - 300f, 0f), end = Offset(x, 0f),
    )
}

@Composable
fun SkeletonList(modifier: Modifier = Modifier, lines: Int = 5) {
    Column(modifier = modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 12.dp)) {
        val brush = shimmerBrush()
        repeat(lines) {
            androidx.compose.foundation.layout.Box(
                Modifier.fillMaxWidth().height(84.dp).clip(RoundedCornerShape(16.dp)).background(brush)
                    .border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)),
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}
