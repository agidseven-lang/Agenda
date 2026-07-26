package br.com.idseven.agenda.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.designsystem.theme.Tokens

// Seletor de RESPONSÁVEL com avatar — padrão premium aprovado (1.0.53 no Compromisso).
// Componente compartilhado p/ reuso em Compromisso e Tarefa (evita duplicacao). UI-only.

// Avatar neutro (sem usuário / "Ninguém"): círculo discreto com ícone de pessoa.
@Composable
fun NeutralAvatar(size: Dp) {
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(Tokens.Surface2),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Outlined.Person, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(size * 0.55f))
    }
}

// Campo FECHADO do responsável: avatar/foto (ou neutro) + nome completo, padrão premium.
@Composable
fun AssigneePickerField(selected: Boolean, photo: String?, ringColor: Color, name: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Surface)
            .border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (selected) Avatar(photo, ringColor, name, 36.dp) else NeutralAvatar(36.dp)
            Spacer(Modifier.width(12.dp))
            Text(
                if (selected) name.ifBlank { "—" } else "Selecionar da equipe",
                color = if (selected) Tokens.Ink else Tokens.Faint,
                fontSize = 14.5.sp,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 17.sp,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

// Item da LISTA do responsável: avatar/foto (ou neutro) + nome completo + marca de selecionado.
@Composable
fun AssigneeItemRow(photo: String?, ringColor: Color, name: String, neutral: Boolean, selected: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 4.dp),
    ) {
        if (neutral) NeutralAvatar(34.dp) else Avatar(photo, ringColor, name, 34.dp)
        Spacer(Modifier.width(12.dp))
        Text(
            name,
            color = if (selected) Tokens.Accent else Tokens.Ink,
            fontSize = 14.5.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 17.sp,
            modifier = Modifier.widthIn(max = 200.dp),
        )
        if (selected) {
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Outlined.Check, contentDescription = null, tint = Tokens.Accent, modifier = Modifier.size(18.dp))
        }
    }
}
