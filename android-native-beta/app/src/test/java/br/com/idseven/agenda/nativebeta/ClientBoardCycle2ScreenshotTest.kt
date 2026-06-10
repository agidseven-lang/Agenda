package br.com.idseven.agenda.nativebeta

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import br.com.idseven.agenda.nativebeta.domain.ClientReview
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

// Ciclo 1.0.133 (reprovação parcial) — prova visual REAL (Robolectric NATIVE, sem emulador):
// 1) quadro CLIENTE com linguagem simples (clientFacingStatusView) e SEM "Aprovado" antes da
//    conclusão final; 2) card do DESIGNER com badge específico "Em produção".
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
// Janela ALTA: a coluna com 6 cards completos passa de 914dp — sem isso o PNG sai clipado.
@Config(application = Application::class, sdk = [34], qualifiers = "pt-rBR-w411dp-h4800dp-xhdpi")
class ClientBoardCycle2ScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val designer = UserLite(id = "d", name = "Marcos Dias", role = "Designer", color = "#f59e0b", photo = null, status = "ativo", admin = false)
    private val social = UserLite(id = "jm", name = "João Marques", role = "Social Media", color = "#f472b6", photo = null, status = "ativo", admin = false)

    private val themesOnly = listOf(CronContent(tema = "Catarata"), CronContent(tema = "Lentes premium"), CronContent(tema = "Glaucoma"))
    private val fullContents = listOf(
        CronContent(tema = "Catarata", legenda = "L1", feedImageUrl = "f"),
        CronContent(tema = "Lentes premium", legenda = "L2", feedImageUrl = "f"),
        CronContent(tema = "Glaucoma", legenda = "L3", feedImageUrl = "f"),
    )

    private val base = TaskItem(
        id = "t", title = "Cronograma Semanal · Feed", client = "Hospital Visão",
        sector = "cronograma", desc = null, status = "andamento",
        assignee = social.name, assigneeId = "jm", link = null, priority = false,
        startDate = null, startTime = null, dueDate = "2026-06-20", dueTime = null,
        by = "jm", createdAt = 1_749_000_000_000L, startedAt = null, doneAt = null, doneBy = null,
        checklist = emptyList(), history = emptyList(),
        socialOwnerId = "jm", cronContents = themesOnly,
    )

    // (rótulo, tarefa, perspectiva do card: true = quadro Cliente, false = quadro Designer)
    private val cases: List<Triple<String, TaskItem, Boolean>> = listOf(
        Triple(
            "CLIENTE · Em análise — temas aprovados (NÃO vai p/ Aprovado)",
            base.copy(
                clientApprovalPhase = "themes", clientFlowStatus = "aprovado", cronStatus = "aprovado_cliente",
                clientReview = ClientReview("aprovado", null, 1_749_500_000_000L, "Cliente"),
            ),
            true,
        ),
        Triple(
            "CLIENTE · Em análise — equipe produzindo as artes",
            base.copy(clientFlowStatus = "producao", assignedDesignerId = "d", assignedDesignerName = "Marcos Dias", designerFlowStatus = "andamento"),
            true,
        ),
        Triple(
            "CLIENTE · Em análise — aguardando legendas e posts",
            base.copy(clientFlowStatus = "producao", assignedDesignerId = "d", assignedDesignerName = "Marcos Dias", designerFlowStatus = "concluido"),
            true,
        ),
        Triple(
            "CLIENTE · Em análise — versão final disponível",
            base.copy(
                cronContents = fullContents, clientApprovalPhase = "final",
                cronStatus = "ready_for_final_client_review", clientFlowStatus = "reenviado",
                assignedDesignerId = "d", assignedDesignerName = "Marcos Dias", designerFlowStatus = "concluido",
            ),
            true,
        ),
        Triple(
            "CLIENTE · Aprovado — SÓ na conclusão final real",
            base.copy(
                cronContents = fullContents, clientFlowStatus = "concluido", finalApprovalCompleted = true,
                operationalStatus = "concluido", status = "concluido", clientFinalApprovedAt = 1_749_600_000_000L,
                assignedDesignerId = "d", assignedDesignerName = "Marcos Dias", designerFlowStatus = "concluido",
            ),
            true,
        ),
        Triple(
            "DESIGNER · Em andamento — badge específico \"Em produção\"",
            base.copy(
                clientFlowStatus = "producao", assignee = designer.name, assigneeId = "d",
                assignedDesignerId = "d", assignedDesignerName = "Marcos Dias", designerFlowStatus = "andamento",
            ),
            false,
        ),
    )

    private fun renderColumn(tag: String, widthDp: Int, file: String) {
        composeTestRule.setContent {
            IDSevenBetaTheme {
                Column(
                    Modifier.width(widthDp.dp).background(Tokens.Bg).padding(14.dp).testTag(tag),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    cases.forEachIndexed { i, (label, t, clientPersp) ->
                        Text(
                            label.uppercase(), color = Tokens.Faint,
                            fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp,
                            modifier = Modifier.padding(top = if (i == 0) 0.dp else 14.dp, bottom = 4.dp),
                        )
                        TaskCardPro(
                            task = t,
                            requester = social,
                            assignee = if (clientPersp) social else designer,
                            canDelete = false,
                            onClick = {}, onMove = {}, onDelete = {},
                            designerView = !clientPersp,
                            clientView = clientPersp,
                        )
                    }
                }
            }
        }
        composeTestRule.onNodeWithTag(tag).captureRoboImage("build/outputs/roborazzi/$file")
    }

    @Test fun client_board_cycle2_w360() = renderColumn("cycle2-360", 360, "client-board-cycle2-360.png")

    @Test fun client_board_cycle2_w412() = renderColumn("cycle2-412", 412, "client-board-cycle2-412.png")
}
