package br.com.idseven.agenda.nativebeta

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import br.com.idseven.agenda.nativebeta.core.AppRoot
import br.com.idseven.agenda.nativebeta.core.DeepLink
import br.com.idseven.agenda.nativebeta.designsystem.theme.IDSevenBetaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DeepLink.consumeIntent(intent)
        setContent { IDSevenBetaTheme { AppRoot() } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        DeepLink.consumeIntent(intent)
    }
}
