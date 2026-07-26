package br.com.idseven.agenda

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import br.com.idseven.agenda.designsystem.components.AppTopbar
import br.com.idseven.agenda.designsystem.components.BrandHeader
import br.com.idseven.agenda.designsystem.theme.IDSevenBetaTheme
import br.com.idseven.agenda.designsystem.theme.Tokens
import br.com.idseven.agenda.domain.UserLite
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

// Prova visual de que a UI Android usa a LOGO OFICIAL (não mais o "7").
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(application = Application::class, sdk = [34], qualifiers = "pt-rBR-w411dp-h914dp-xhdpi")
class BrandUiScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun brand_header_login() {
        composeTestRule.setContent {
            IDSevenBetaTheme {
                Box(Modifier.width(411.dp).background(Tokens.Bg).padding(vertical = 40.dp).testTag("brandbox")) {
                    Column(Modifier.padding(horizontal = 24.dp)) { BrandHeader() }
                }
            }
        }
        composeTestRule.onNodeWithTag("brandbox").captureRoboImage("build/outputs/roborazzi/brand-header-login.png")
    }

    @Test
    fun app_topbar() {
        val user = UserLite(
            id = "u1", name = "Felipe Teodozio", role = "Administrador",
            color = "#5b6cff", photo = null, status = "ativo", admin = true,
        )
        composeTestRule.setContent {
            IDSevenBetaTheme {
                Box(Modifier.width(411.dp).background(Tokens.Bg).testTag("topbarbox")) {
                    AppTopbar(title = "Hoje", subtitle = "sincronizado", currentUser = user)
                }
            }
        }
        composeTestRule.onNodeWithTag("topbarbox").captureRoboImage("build/outputs/roborazzi/app-topbar.png")
    }
}
