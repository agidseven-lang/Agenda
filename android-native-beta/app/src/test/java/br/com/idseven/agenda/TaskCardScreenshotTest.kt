package br.com.idseven.agenda

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import br.com.idseven.agenda.designsystem.theme.IDSevenBetaTheme
import br.com.idseven.agenda.designsystem.theme.Tokens
import br.com.idseven.agenda.domain.ChecklistItem
import br.com.idseven.agenda.domain.CronContent
import br.com.idseven.agenda.domain.TaskItem
import br.com.idseven.agenda.domain.UserLite
import br.com.idseven.agenda.features.tasks.TaskCardPro
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.GregorianCalendar
import java.util.TimeZone

// Render REAL do card de tarefa Android em PNG, na JVM (Robolectric NATIVE), SEM emulador.
// Prova visual exigida ANTES do build do APK: o card mobile precisa ser igual ao do PC.
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(application = Application::class, sdk = [34], qualifiers = "pt-rBR-w411dp-h914dp-xhdpi")
class TaskCardScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Before
    fun fixTimeZone() {
        // Carimbo determinístico "04/06/2026 às 17:08" independente do agente de CI.
        TimeZone.setDefault(TimeZone.getTimeZone("America/Sao_Paulo"))
    }

    private val createdAtMs: Long =
        GregorianCalendar(2026, 5, 4, 17, 8, 0).timeInMillis // mês 5 = junho

    // Mesma tarefa do print reprovado: cronograma enviado ao designer (CEO), 3 temas, 0/5.
    private val sampleAssignee = UserLite(
        id = "u-ceo", name = "Miercohévisk Niheb Ferreira Nascimento Carlôto", role = "CEO",
        color = "#5b6cff", photo = null, status = "ativo", admin = false,
    )
    private val sampleRequester = UserLite(
        id = "u-soc", name = "Arydyjany Carlôto", role = "Social Media",
        color = "#f472b6", photo = null, status = "ativo", admin = false,
    )
    private val sampleTask = TaskItem(
        id = "t-demo", title = "Cronograma semanal", client = "Hospital Visão",
        sector = "cronograma", desc = "Cronograma semanal — 3 conteúdos. Canais: Instagram…",
        status = "afazer", assignee = sampleAssignee.name, assigneeId = "u-ceo",
        link = null, priority = false, startDate = null, startTime = null,
        dueDate = null, dueTime = null, by = "u-soc", createdAt = createdAtMs,
        startedAt = null, doneAt = null, doneBy = null,
        checklist = listOf(
            ChecklistItem("Definir temas da semana", false),
            ChecklistItem("Organizar datas", false),
            ChecklistItem("Revisar cronograma", false),
            ChecklistItem("Aprovar cronograma semanal", false),
            ChecklistItem("Enviar para produção", false),
        ),
        history = emptyList(),
        cronStatus = "sent_to_designer",
        cronContents = listOf(
            CronContent(tema = "Tema 01", legenda = "Legenda do tema 1"),
            CronContent(tema = "Tema 02", legenda = "Legenda do tema 2"),
            CronContent(tema = "Tema 03", legenda = "Legenda do tema 3"),
        ),
    )

    private fun render(widthDp: Int, file: String) {
        composeTestRule.setContent {
            IDSevenBetaTheme {
                Box(
                    Modifier.width(widthDp.dp).background(Tokens.Bg).padding(16.dp).testTag("cardbox"),
                ) {
                    TaskCardPro(
                        task = sampleTask,
                        requester = sampleRequester,
                        assignee = sampleAssignee,
                        canDelete = true,
                        onClick = {}, onMove = {}, onDelete = {},
                    )
                }
            }
        }
        composeTestRule.onNodeWithTag("cardbox")
            .captureRoboImage("build/outputs/roborazzi/$file")
    }

    @Test fun card_phone_small() = render(360, "task-card-android-360.png")

    @Test fun card_phone_large() = render(412, "task-card-android-412.png")
}
