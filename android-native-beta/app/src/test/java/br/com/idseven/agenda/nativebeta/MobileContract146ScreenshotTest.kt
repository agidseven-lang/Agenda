package br.com.idseven.agenda.nativebeta

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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

// Contrato visual mobile (ciclo 1.0.146) — provas exigidas pelo usuário ANTES do build:
// 390×844 (largura não coberta), quadro com 1 e 2+ tarefas, status/cliente LONGOS sem corte
// e prova de que largura tablet NÃO quebra (limitação declarada: sem layout tablet dedicado).
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(application = Application::class, sdk = [34], qualifiers = "pt-rBR-w411dp-h3600dp-xhdpi")
class MobileContract146ScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val social = UserLite(id = "jm", name = "João Marques", role = "Social Media", color = "#f472b6", photo = null, status = "ativo", admin = false)
    private val ceo = UserLite(id = "u-ceo", name = "Miercohévisk Niheb Ferreira Nascimento", role = "CEO", color = "#5b6cff", photo = null, status = "ativo", admin = false)

    private val themes = listOf(CronContent(tema = "Catarata"), CronContent(tema = "Lentes premium"), CronContent(tema = "Glaucoma"))

    private fun task(id: String, title: String, client: String, cron: String?) = TaskItem(
        id = id, title = title, client = client,
        sector = "cronograma", desc = null, status = "andamento",
        assignee = ceo.name, assigneeId = "u-ceo", link = null, priority = false,
        startDate = null, startTime = null, dueDate = "2026-06-20", dueTime = "18:00",
        by = "jm", createdAt = 1_749_000_000_000L, startedAt = null, doneAt = null, doneBy = null,
        checklist = emptyList(), history = emptyList(),
        cronStatus = cron, cronContents = themes,
    )

    private fun renderCards(widthDp: Int, file: String, header: String, tasks: List<TaskItem>) {
        composeTestRule.setContent {
            IDSevenBetaTheme {
                Column(
                    Modifier.width(widthDp.dp).background(Tokens.Bg).padding(16.dp).testTag("box"),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(header, color = Tokens.Ink, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    tasks.forEach { t ->
                        TaskCardPro(
                            task = t, requester = social, assignee = ceo,
                            canDelete = true, onClick = {}, onMove = {}, onDelete = {},
                        )
                    }
                }
            }
        }
        composeTestRule.onNodeWithTag("box").captureRoboImage("build/outputs/roborazzi/$file")
    }

    @Test fun card_390() = renderCards(
        390, "m146-card-390.png", "EM ANÁLISE · 1",
        listOf(task("a", "Cronograma semanal", "Hospital Visão", "sent_to_designer")),
    )

    @Test fun board_1tarefa_390x844() = renderCards(
        390, "m146-board-1tarefa-390.png", "EM ANÁLISE · 1",
        listOf(task("a", "Cronograma Semanal · Feed", "Hospital Visão", "enviado_cliente")),
    )

    @Test fun board_2tarefas_390x844() = renderCards(
        390, "m146-board-2tarefas-390.png", "EM ANÁLISE · 2",
        listOf(
            task("a", "Cronograma Semanal · Feed", "Hospital Visão", "enviado_cliente"),
            task("b", "Cronograma Quinzenal · Stories", "Clínica Bella Pelle", "sent_to_designer"),
        ),
    )

    @Test fun status_e_cliente_longos_360() = renderCards(
        360, "m146-status-longo-360.png", "EM ANÁLISE · 1",
        listOf(task("a", "Cronograma Mensal · Feed + Stories + Reels", "Clínica Oftalmológica Visão Premium de Niterói LTDA", "sent_to_designer")),
    )

    // "+w880dp" alarga a TELA simulada (Robolectric merge) — sem isso o box de 800dp
    // seria clampado aos 411dp do qualifier da classe e a prova tablet seria falsa.
    @Test
    @Config(qualifiers = "+w880dp")
    fun tablet_nao_quebra_800() = renderCards(
        800, "m146-tablet-800.png", "EM ANÁLISE · 1",
        listOf(task("a", "Cronograma semanal", "Hospital Visão", "sent_to_designer")),
    )
}
