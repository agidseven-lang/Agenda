package br.com.idseven.agenda.nativebeta.features.agenda

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.Types
import java.time.LocalDate
import java.time.YearMonth

private val MONTHS = listOf(
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
)
private val DOW = listOf("DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB")

fun monthLabel(m: YearMonth): String = MONTHS[m.monthValue - 1]

@Composable
fun CalendarCard(
    month: YearMonth,
    selected: LocalDate,
    eventsByDay: Map<LocalDate, List<EventItem>>,
    onSelect: (LocalDate) -> Unit,
) {
    val today = LocalDate.now()
    val firstDow = month.atDay(1).dayOfWeek.value % 7 // domingo = 0
    val first = month.atDay(1)

    Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
            .background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(24.dp))
            .padding(horizontal = 8.dp, vertical = 16.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 0.dp)) {
            DOW.forEach { d ->
                Text(d, color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, letterSpacing = 0.05.sp, modifier = Modifier.weight(1f))
            }
        }
        Spacer(Modifier.height(6.dp))
        for (row in 0 until 6) {
            Row(Modifier.fillMaxWidth()) {
                for (col in 0..6) {
                    val date = first.plusDays((row * 7 + col - firstDow).toLong())
                    DayCell(
                        date = date,
                        inMonth = YearMonth.from(date) == month,
                        isToday = date == today,
                        isSelected = date == selected,
                        events = eventsByDay[date].orEmpty(),
                        modifier = Modifier.weight(1f),
                        onClick = { onSelect(date) },
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCell(date: LocalDate, inMonth: Boolean, isToday: Boolean, isSelected: Boolean, events: List<EventItem>, modifier: Modifier, onClick: () -> Unit) {
    val numColor = when {
        isToday -> Color.White
        !inMonth -> Tokens.Faint.copy(alpha = 0.4f)
        else -> Tokens.Ink
    }
    Column(
        modifier = modifier.height(50.dp).clip(RoundedCornerShape(12.dp)).clickable { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(CircleShape)
                .background(if (isToday) Tokens.Accent else Color.Transparent)
                .then(if (isSelected && !isToday) Modifier.border(1.6.dp, Tokens.Accent, CircleShape) else Modifier),
            contentAlignment = Alignment.Center,
        ) {
            Text("${date.dayOfMonth}", color = numColor, fontSize = 14.sp, fontWeight = if (isToday || isSelected) FontWeight.Bold else FontWeight.Medium)
        }
        if (events.isNotEmpty() && inMonth) {
            Spacer(Modifier.height(3.dp))
            Row(horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                events.take(3).forEach { e ->
                    Box(Modifier.padding(horizontal = 1.dp).size(5.dp).clip(CircleShape).background(Types.of(e.type).color))
                }
                if (events.size > 3) {
                    Spacer(Modifier.size(2.dp))
                    Text("+${events.size - 3}", color = Tokens.Faint, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                }
            }
        } else {
            Spacer(Modifier.height(8.dp))
        }
    }
}
