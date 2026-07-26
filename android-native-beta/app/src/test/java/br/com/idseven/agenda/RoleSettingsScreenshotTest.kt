package br.com.idseven.agenda

import android.app.Application
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import br.com.idseven.agenda.core.UiList
import br.com.idseven.agenda.designsystem.theme.IDSevenBetaTheme
import br.com.idseven.agenda.domain.TaskItem
import br.com.idseven.agenda.domain.UserLite
import br.com.idseven.agenda.features.settings.SettingsScreen
import br.com.idseven.agenda.features.tasks.RoleBoardsScreen
import br.com.idseven.agenda.features.tasks.TasksScreen
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(application = Application::class, sdk = [34], qualifiers = "pt-rBR-w411dp-h914dp-xhdpi")
class RoleSettingsScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val felipe = UserLite("u-fel", "Felipe Teodozio", "Administrador", "#5b6cff", null, "ativo", true)
    private val boaz = UserLite("u-boaz", "Boaz Macêdo", "Designer", "#34d399", null, "ativo", false)
    private val mier = UserLite("u-mier", "Miercohévisk Niheb Ferreira", "CEO", "#a78bfa", null, "ativo", false)
    private val ary = UserLite("u-ary", "Arydyjany Carlôto", "Social Media", "#f472b6", null, "ativo", false)
    private val tati = UserLite("u-tati", "Tatiana Souza", "Social Media", "#22d3ee", null, "ativo", false)
    private val users = listOf(felipe, boaz, mier, ary, tati)

    private fun task(id: String, title: String, status: String, assigneeId: String, assignee: String, by: String) =
        TaskItem(
            id = id, title = title, client = "Hospital Visão", sector = "cronograma", desc = null,
            status = status, assignee = assignee, assigneeId = assigneeId, link = null, priority = false,
            startDate = null, startTime = null, dueDate = null, dueTime = null, by = by,
            createdAt = 0L, startedAt = null, doneAt = null, doneBy = null,
            checklist = emptyList(), history = emptyList(),
            cronStatus = "sent_to_designer",
        )

    private val tasks = listOf(
        task("t1", "Cronograma semanal", "afazer", "u-boaz", "Boaz Macêdo", "u-ary"),
        task("t2", "Cortes institucionais", "andamento", "u-boaz", "Boaz Macêdo", "u-ary"),
        task("t3", "Carrossel campanha", "afazer", "u-mier", "Miercohévisk Niheb Ferreira", "u-tati"),
        task("t4", "Reels lançamento", "revisao", "u-ary", "Arydyjany Carlôto", "u-ary"),
    )
    private val tasksState = UiList.Data(tasks)

    @Test
    fun settings_screen() {
        composeTestRule.setContent {
            IDSevenBetaTheme { SettingsScreen(currentUser = felipe, onLogout = {}, onBack = {}) }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/settings-screen.png")
    }

    @Test
    fun admin_role_boards() {
        composeTestRule.setContent {
            IDSevenBetaTheme { RoleBoardsScreen(tasksState = tasksState, users = users, onOpenPerson = {}, onBack = {}) }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/admin-role-boards.png")
    }

    @Test
    fun person_board_designer() {
        composeTestRule.setContent {
            IDSevenBetaTheme {
                TasksScreen(
                    tasksState = tasksState, users = users, currentUid = "u-fel",
                    onTaskClick = {}, currentUser = felipe,
                    personId = "u-boaz", personName = "Boaz Macêdo", onBack = {},
                )
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/person-board-designer.png")
    }

    @Test
    fun social_my_board() {
        composeTestRule.setContent {
            IDSevenBetaTheme {
                TasksScreen(
                    tasksState = tasksState, users = users, currentUid = "u-ary",
                    onTaskClick = {}, currentUser = ary,
                    personId = "u-ary", personName = "Arydyjany Carlôto", onBack = {},
                )
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/social-my-board.png")
    }
}
