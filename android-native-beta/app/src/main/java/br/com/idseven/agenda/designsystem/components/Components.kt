package br.com.idseven.agenda.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.designsystem.theme.Tokens

// ===== Biblioteca de componentes reutilizáveis (Design System SaaS) =====

@Composable
fun BrandHeader(subtitle: String = "Nativo Beta · SaaS") {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        // Logo oficial (brand/logo-source.png -> res/drawable-nodpi/brand_logo.png). Sem o "7".
        Image(
            painter = painterResource(br.com.idseven.agenda.R.drawable.brand_logo),
            contentDescription = "ID Seven",
            modifier = Modifier.size(76.dp),
            contentScale = ContentScale.Fit,
        )
        androidx.compose.foundation.layout.Spacer(Modifier.height(14.dp))
        Text("ID Seven", color = Tokens.Accent, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun PrimaryButton(text: String, modifier: Modifier = Modifier, loading: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(14.dp),
        contentPadding = PaddingValues(vertical = 12.dp),
    ) {
        if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
        else Text(text, fontSize = 15.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Tokens.Accent,
    unfocusedBorderColor = Tokens.Line,
    focusedLabelColor = Tokens.Accent,
    unfocusedLabelColor = Tokens.Faint,
    focusedTextColor = Tokens.Ink,
    unfocusedTextColor = Tokens.Ink,
    cursorColor = Tokens.Accent,
)

@Composable
fun AppTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = fieldColors(),
    )
}

@Composable
fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    show: Boolean,
    onToggleShow: () -> Unit,
    label: String = "Senha",
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
        trailingIcon = { TextButton(onClick = onToggleShow) { Text(if (show) "Ocultar" else "Mostrar", fontSize = 12.sp) } },
        colors = fieldColors(),
    )
}

@Composable
fun MessageBanner(message: String, isError: Boolean) {
    val color = if (isError) Tokens.Red else Tokens.Green
    Box(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.12f)).padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Text(message, color = color, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}
