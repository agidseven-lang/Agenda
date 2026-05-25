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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
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
private val DOW = listOf("D", "S", "T", "Q", "Q", "S", "S")

@Composable
fun CalendarCard(
    month: YearMonth,
    selected: LocalDate,
    eventsByDay: Map<LocalDate, List<EventItem>>,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onSelect: (LocalDate) -> Unit,
) {
    val today = LocalDate.now()
    Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Tokens.Surface)
            .border(1.dp, Tokens.Line, RoundedCornerShape(20.dp)).padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("${MONTHS[month.monthValue - 1]} ${month.year}", color = Tokens.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            NavBtn(Icons.Filled.KeyboardArrowLeft, onPrev)
            Spacer(Modifier.size(8.dp))
            NavBtn(Icons.Filled.KeyboardArrowRight, onNext)
        }
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth()) {
            DOW.forEach { d ->
                Text(d, color = Tokens.Faint, fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
            }
        }
        Spacer(Modifier.height(6.dp))
        val firstDow = month.atDay(1).dayOfWeek.value % 7 // domingo = 0
        val days = month.lengthOfMonth()
        val rows = (firstDow + days + 6) / 7
        for (r in 0 until rows) {
            Row(Modifier.fillMaxWidth()) {
                for (c in 0..6) {
                    val dayNum = r * 7 + c - firstDow + 1
                    if (dayNum in 1..days) {
                        val date = month.atDay(dayNum)
                        DayCell(
                            day = dayNum,
                            isToday = date == today,
                            isSelected = date == selected,
                            events = eventsByDay[date].orEmpty(),
                            modifier = Modifier.weight(1f),
                            onClick = { onSelect(date) },
                        )
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun NavBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Box(
        modifier = Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(Tokens.Surface2).clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = null, tint = Tokens.Soft, modifier = Modifier.size(22.dp)) }
}

@Composable
private fun DayCell(day: Int, isToday: Boolean, isSelected: Boolean, events: List<EventItem>, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier = modifier.height(46.dp).padding(2.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (isToday) Tokens.Accent else Color.Transparent)
            .then(if (isSelected && !isToday) Modifier.border(1.5.dp, Tokens.Accent, RoundedCornerShape(12.dp)) else Modifier)
            .clickable { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "$day",
            color = if (isToday) Color.White else Tokens.Ink,
            fontSize = 13.sp,
            fontWeight = if (isToday || isSelected) FontWeight.Bold else FontWeight.Normal,
        )
        if (events.isNotEmpty()) {
            Spacer(Modifier.height(3.dp))
            Row(horizontalArrangement = Arrangement.Center) {
                events.take(3).forEach { e ->
                    Box(Modifier.padding(horizontal = 1.dp).size(5.dp).clip(CircleShape).background(if (isToday) Color.White else Types.of(e.type).color))
                }
            }
        }
    }
}
