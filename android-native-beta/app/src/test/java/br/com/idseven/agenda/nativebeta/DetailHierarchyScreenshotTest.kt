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
import br.com.idseven.agenda.nativebeta.domain.ClientItemState
import br.com.idseven.agenda.nativebeta.domain.ClientReview
import br.com.idseven.agenda.nativebeta.domain.CronContent
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.features.tasks.DetailHero
import br.com.idseven.agenda.nativebeta.features.tasks.FlowDetailsCollapsed
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

// detail-hierarchy-v2 — DETALHE com a hierarquia aprovada (paridade com o Desktop):
// Status principal · Próxima ação · Responsável agora · "Detalhes do fluxo" colapsado.
// Render REAL (Robolectric NATIVE, JVM, sem emulador/APK) nos 8 estados obrigatórios,
// nas larguras 360dp e 412dp (validação mobile exigida).
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
// Janela ALTA (h3800dp): a coluna com os 8 estados mede ~3500dp; com a altura default (h914dp)
// o Robolectric CLIPA a captura na janela e so o estado 1 sai no PNG.
@Config(application = Application::class, sdk = [34], qualifiers = "pt-rBR-w411dp-h3800dp-xhdpi")
class DetailHierarchyScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val designer = UserLite(id = "d", name = "Marcos Dias", role = "Designer", color = "#f59e0b", photo = null, status = "ativo", admin = false)
    private val social = UserLite(id = "jm", name = "João Marques", role = "Social Media", color = "#f472b6", photo = null, status = "ativo", admin = false)
    private val users = listOf(designer, social)

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

    // Os 8 estados OBRIGATÓRIOS (mesmas fixtures do E2E Desktop — paridade total).
    private val states: List<Pair<String, TaskItem>> = listOf(
        "1 · Cliente pediu ajuste" to base.copy(
            clientApprovalPhase = "themes", clientFlowStatus = "revisao", cronStatus = "em_revisao_cliente",
            clientReview = ClientReview("revisao", "Trocar a foto de capa do Tema 2", 1_749_400_000_000L, "Cliente"),
            clientItems = mapOf("i1" to ClientItemState(cs = "em_revisao", phase = "themes", note = "trocar a foto de capa")),
        ),
        "2 · Tema corrigido — aguardando nova análise" to base.copy(
            clientApprovalPhase = "themes", clientFlowStatus = "revisao", cronStatus = "em_revisao_cliente",
            clientReview = ClientReview("revisao", "Trocar a foto de capa do Tema 2", 1_749_400_000_000L, "Cliente"),
            clientItems = mapOf("i1" to ClientItemState(cs = null, phase = "themes", teamAdjustedAt = 1_749_500_000_000L)),
        ),
        "3 · Temas aprovados / pronto p/ designer" to base.copy(
            clientApprovalPhase = "themes", clientFlowStatus = "aprovado", cronStatus = "aprovado_cliente",
            clientReview = ClientReview("aprovado", null, 1_749_500_000_000L, "Cliente"),
        ),
        "4 · Aguardando designer iniciar" to base.copy(
            clientFlowStatus = "producao", assignedDesignerId = "d", assignedDesignerName = "Marcos Dias",
            designerFlowStatus = "afazer",
        ),
        "5 · Designer em produção" to base.copy(
            clientFlowStatus = "producao", assignedDesignerId = "d", assignedDesignerName = "Marcos Dias",
            designerFlowStatus = "andamento",
        ),
        "6 · Designer entregou" to base.copy(
            clientFlowStatus = "producao", assignedDesignerId = "d", assignedDesignerName = "Marcos Dias",
            designerFlowStatus = "concluido",
        ),
        "7 · Aguardando aprovação final" to base.copy(
            cronContents = fullContents, clientApprovalPhase = "final",
            cronStatus = "ready_for_final_client_review", clientFlowStatus = "reenviado",
            assignedDesignerId = "d", assignedDesignerName = "Marcos Dias", designerFlowStatus = "concluido",
        ),
        // V64.47 (bug 1.0.132): doc PRESO — globais 'revisao' herdados + 3/3 itens aprovados
        // na fase themes. A LEITURA destrava: deve renderizar como TEMAS APROVADOS.
        "8b · Bug 1.0.132: doc preso destravado (revisão herdada + 3/3 aprovados)" to base.copy(
            clientApprovalPhase = "themes", clientFlowStatus = "revisao", cronStatus = "em_revisao_cliente",
            clientReview = ClientReview("revisao", "trocar a foto", 1_749_400_000_000L, "Cliente"),
            clientItems = mapOf(
                "i0" to ClientItemState(cs = "aprovado", phase = "themes"),
                "i1" to ClientItemState(cs = "aprovado", phase = "themes"),
                "i2" to ClientItemState(cs = "aprovado", phase = "themes", teamAdjustedAt = 1_749_500_000_000L),
            ),
        ),
        "8 · Concluído" to base.copy(
            cronContents = fullContents, clientFlowStatus = "concluido", finalApprovalCompleted = true,
            operationalStatus = "concluido", status = "concluido", clientFinalApprovedAt = 1_749_600_000_000L,
            assignedDesignerId = "d", assignedDesignerName = "Marcos Dias", designerFlowStatus = "concluido",
        ),
    )

    private fun renderColumn(tag: String, widthDp: Int, file: String) {
        composeTestRule.setContent {
            IDSevenBetaTheme {
                Column(
                    Modifier.width(widthDp.dp).background(Tokens.Bg).padding(14.dp).testTag(tag),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    states.forEachIndexed { i, (label, t) ->
                        Text(
                            "ESTADO $label".uppercase(), color = Tokens.Faint,
                            fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp,
                            modifier = Modifier.padding(top = if (i == 0) 0.dp else 14.dp, bottom = 4.dp),
                        )
                        DetailHero(t, users)
                        // colapsável: ABERTO só no 1º estado (demonstra o conteúdo técnico interno).
                        FlowDetailsCollapsed(t, initiallyOpen = (i == 0))
                    }
                }
            }
        }
        composeTestRule.onNodeWithTag(tag).captureRoboImage("build/outputs/roborazzi/$file")
    }

    // Largura 360dp (validação mobile mínima exigida).
    @Test fun detail_hierarchy_w360() = renderColumn("detail-360", 360, "detail-hierarchy-360.png")

    // Largura 412dp (validação mobile padrão exigida).
    @Test fun detail_hierarchy_w412() = renderColumn("detail-412", 412, "detail-hierarchy-412.png")
}
