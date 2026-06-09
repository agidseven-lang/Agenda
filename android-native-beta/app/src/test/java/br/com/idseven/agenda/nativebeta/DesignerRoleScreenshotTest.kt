package br.com.idseven.agenda.nativebeta

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import br.com.idseven.agenda.nativebeta.designsystem.theme.IDSevenBetaTheme
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.CronContent
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.features.tasks.TaskCardPro
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

// PASSO 3 — paridade Android do fluxo role-aware do Designer (espelha Desktop f96aa2e).
// Render REAL (Robolectric NATIVE, JVM, sem emulador/APK):
//  • Perspectiva do DESIGNER: card mostra o status DELE (A Fazer/Em andamento/Revisão/Ajuste/
//    Entregue) + "Próxima" ação do designer, SEM o fluxo do cliente.
//  • Perspectiva da SOCIAL: as MESMAS tarefas mostram o estado do designer (Aguardando designer
//    iniciar / Designer em produção / Designer em revisão / Designer entregou).
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(application = Application::class, sdk = [34], qualifiers = "pt-rBR-w411dp-h914dp-xhdpi")
class DesignerRoleScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val designer = UserLite(id = "d", name = "Marcos Dias", role = "Designer", color = "#f59e0b", photo = null, status = "ativo", admin = false)
    private val social = UserLite(id = "jm", name = "João Marques", role = "Social Media", color = "#f472b6", photo = null, status = "ativo", admin = false)

    private val base = TaskItem(
        id = "t", title = "Cronograma Semanal · Feed", client = "Hospital Visão",
        sector = "cronograma", desc = "3 conteúdos", status = "andamento",
        assignee = designer.name, assigneeId = "d", link = null, priority = false,
        startDate = null, startTime = null, dueDate = null, dueTime = null,
        by = "jm", createdAt = 1_749_000_000_000L, startedAt = null, doneAt = null, doneBy = null,
        checklist = emptyList(), history = emptyList(), cronStatus = "sent_to_designer",
        assignedDesignerId = "d", assignedDesignerName = "Marcos Dias",
        clientFlowStatus = "producao", designerFlowStatus = "afazer",
        socialOwnerId = "jm",
        cronContents = listOf(CronContent(tema = "Catarata", legenda = "L1"), CronContent(tema = "Lentes premium", legenda = "L2")),
    )
    private fun task(dfs: String, title: String) = base.copy(designerFlowStatus = dfs, title = title)

    private val states = listOf(
        "afazer" to "Cronograma Semanal · Feed",
        "andamento" to "Cronograma Quinzenal · Stories",
        "revisao" to "Campanha Junho Violeta",
        "concluido" to "Cronograma Mensal · Institucional",
    )

    private fun renderColumn(tag: String, designerView: Boolean, file: String) {
        composeTestRule.setContent {
            IDSevenBetaTheme {
                Column(
                    Modifier.width(412.dp).background(Tokens.Bg).padding(16.dp).testTag(tag),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    states.forEach { (dfs, title) ->
                        TaskCardPro(
                            task = task(dfs, title), requester = social, assignee = designer,
                            canDelete = false, onClick = {}, onMove = {}, onDelete = {},
                            designerView = designerView,
                        )
                    }
                }
            }
        }
        composeTestRule.onNodeWithTag(tag).captureRoboImage("build/outputs/roborazzi/$file")
    }

    // Perspectiva do DESIGNER (badge = status do designer; "Próxima" do designer; 4 estados).
    @Test fun designer_perspective() = renderColumn("designer-states", true, "designer-role-designer-view.png")

    // Perspectiva da SOCIAL (mesmas tarefas, status operacional do designer).
    @Test fun social_perspective() = renderColumn("social-states", false, "designer-role-social-view.png")
}
