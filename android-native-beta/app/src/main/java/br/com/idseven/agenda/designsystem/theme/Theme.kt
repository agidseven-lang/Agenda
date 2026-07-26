package br.com.idseven.agenda.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// ===== Design System — tokens fiéis às variáveis CSS do PWA (tema dark) =====
object Tokens {
    // Cores base
    val Bg = Color(0xFF0A0B10)
    val Surface = Color(0xFF15171F)
    val Surface2 = Color(0xFF1C1F29)
    val Line = Color(0xFF262A36)
    val LineSoft = Color(0xFF1F222C)
    val Ink = Color(0xFFF1F2F4)
    val Soft = Color(0xFF9BA0AB)
    val Faint = Color(0xFF6E7480)
    val Accent = Color(0xFF5B6CFF)
    // Semânticas / tipos
    val Green = Color(0xFF34D399)
    val Amber = Color(0xFFF59E0B)
    val Red = Color(0xFFF87171)
    val Violet = Color(0xFFA78BFA)

    // Espaçamentos (dp)
    val sXs = 4.dp; val sSm = 8.dp; val sMd = 12.dp; val sLg = 16.dp; val sXl = 22.dp
    // Radius (dp)
    val rSm = 8.dp; val rMd = 12.dp; val rLg = 16.dp
}

private val DarkColors = darkColorScheme(
    primary = Tokens.Accent,
    onPrimary = Color.White,
    background = Tokens.Bg,
    onBackground = Tokens.Ink,
    surface = Tokens.Surface,
    onSurface = Tokens.Ink,
    surfaceVariant = Tokens.Surface2,
    onSurfaceVariant = Tokens.Soft,
    outline = Tokens.Line,
    error = Tokens.Red,
    onError = Color.White,
)

@Composable
fun IDSevenBetaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        typography = Typography(),
        content = content,
    )
}
