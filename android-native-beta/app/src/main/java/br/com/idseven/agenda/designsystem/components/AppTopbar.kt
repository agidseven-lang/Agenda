package br.com.idseven.agenda.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.designsystem.theme.Tokens
import br.com.idseven.agenda.domain.UserColor
import br.com.idseven.agenda.domain.UserLite

@Composable
fun AppTopbar(title: String, subtitle: String, currentUser: UserLite?) {
    Row(
        modifier = Modifier.fillMaxWidth().background(Tokens.Bg).padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Logo oficial no header (sem o "7").
        Image(
            painter = painterResource(br.com.idseven.agenda.R.drawable.brand_logo),
            contentDescription = "ID Seven",
            modifier = Modifier.size(44.dp),
            contentScale = ContentScale.Fit,
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Tokens.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(Tokens.Green))
                Spacer(Modifier.width(6.dp))
                Text(subtitle, color = Tokens.Soft, fontSize = 11.sp)
            }
        }
        if (currentUser != null) {
            Avatar(currentUser.photo, UserColor.of(currentUser.id, currentUser.color), currentUser.name, 40.dp)
        }
    }
}
