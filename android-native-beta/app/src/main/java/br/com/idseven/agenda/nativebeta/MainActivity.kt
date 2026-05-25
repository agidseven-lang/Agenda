package br.com.idseven.agenda.nativebeta

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import br.com.idseven.agenda.nativebeta.core.AppRoot
import br.com.idseven.agenda.nativebeta.designsystem.theme.IDSevenBetaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { IDSevenBetaTheme { AppRoot() } }
    }
}
