package br.com.idseven.agenda.nativebeta.core

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Today
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import br.com.idseven.agenda.nativebeta.data.UserSession
import br.com.idseven.agenda.nativebeta.designsystem.components.AppTopbar
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.features.agenda.AgendaScreen
import br.com.idseven.agenda.nativebeta.features.chat.ChatListScreen
import br.com.idseven.agenda.nativebeta.features.chat.ChatThreadScreen
import br.com.idseven.agenda.nativebeta.features.dashboard.DashboardScreen
import br.com.idseven.agenda.nativebeta.features.events.EventDetailScreen
import br.com.idseven.agenda.nativebeta.features.events.EventFormScreen
import br.com.idseven.agenda.nativebeta.features.profile.ProfileScreen
import br.com.idseven.agenda.nativebeta.features.tasks.TaskDetailScreen
import br.com.idseven.agenda.nativebeta.features.tasks.TaskFormScreen
import br.com.idseven.agenda.nativebeta.features.tasks.TasksScreen
import br.com.idseven.agenda.nativebeta.features.team.TeamScreen

private data class Tab(val route: String, val label: String, val icon: ImageVector)

@Composable
fun MainScaffold(session: UserSession, onLogout: () -> Unit) {
    val nav = rememberNavController()
    val vm: HomeViewModel = viewModel()
    val eventsState by vm.events.collectAsState()
    val usersState by vm.users.collectAsState()
    val tasksState by vm.tasks.collectAsState()

    val users = usersState.itemsOrEmpty()
    val currentUser = users.firstOrNull { it.id == session.uid }
    val canManage = currentUser?.admin == true

    val tabs = listOf(
        Tab("hoje", "Hoje", Icons.Outlined.Today),
        Tab("agenda", "Agenda", Icons.Outlined.CalendarMonth),
        Tab("tarefas", "Tarefas", Icons.Outlined.Checklist),
        Tab("equipe", "Equipe", Icons.Outlined.Group),
        Tab("chat", "Chat", Icons.Outlined.ChatBubbleOutline),
        Tab("perfil", "Perfil", Icons.Outlined.Person),
    )
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route ?: "hoje"
    val isTab = tabs.any { it.route == route }

    Scaffold(
        containerColor = Tokens.Bg,
        topBar = { if (isTab) AppTopbar(title = "ID Seven", subtitle = "sincronizado", currentUser = currentUser) },
        bottomBar = {
            if (isTab) NavigationBar(containerColor = Tokens.Surface) {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = route == tab.route,
                        onClick = {
                            if (route != tab.route) nav.navigate(tab.route) {
                                popUpTo(nav.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Tokens.Accent,
                            selectedTextColor = Tokens.Accent,
                            unselectedIconColor = Tokens.Faint,
                            unselectedTextColor = Tokens.Faint,
                            indicatorColor = Tokens.Accent.copy(alpha = 0.14f),
                        ),
                    )
                }
            }
        },
        floatingActionButton = {
            val target = when (route) {
                "hoje", "agenda" -> "eventForm"
                "tarefas" -> "taskForm"
                else -> null
            }
            if (target != null) {
                FloatingActionButton(onClick = { nav.navigate(target) }, containerColor = Tokens.Accent, contentColor = Color.White) {
                    Icon(Icons.Filled.Add, contentDescription = "Novo")
                }
            }
        },
    ) { padding ->
        NavHost(nav, startDestination = "hoje", modifier = Modifier.padding(padding)) {
            composable("hoje") { DashboardScreen(eventsState, tasksState, users, session, onEventClick = { nav.navigate("event/$it") }) }
            composable("agenda") { AgendaScreen(eventsState, users, onEventClick = { nav.navigate("event/$it") }) }
            composable("tarefas") { TasksScreen(tasksState, users, onTaskClick = { nav.navigate("task/$it") }) }
            composable("equipe") { TeamScreen(usersState) }
            composable("chat") { ChatListScreen(session, users, onOpenChat = { nav.navigate("chatThread/$it") }) }
            composable("chatThread/{otherId}") { entry ->
                ChatThreadScreen(
                    session = session,
                    otherId = entry.arguments?.getString("otherId") ?: "",
                    users = users,
                    onBack = { nav.popBackStack() },
                )
            }
            composable("perfil") { ProfileScreen(currentUser, session, onLogout) }
            composable("event/{id}") { entry ->
                EventDetailScreen(
                    id = entry.arguments?.getString("id") ?: "",
                    users = users,
                    canManage = canManage,
                    currentUid = session.uid,
                    onBack = { nav.popBackStack() },
                    onEdit = { nav.navigate("eventForm?id=$it") },
                )
            }
            composable(
                route = "eventForm?id={id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType; nullable = true; defaultValue = null }),
            ) { entry ->
                EventFormScreen(
                    editId = entry.arguments?.getString("id"),
                    users = users,
                    currentUid = session.uid,
                    onDone = { nav.popBackStack() },
                    onBack = { nav.popBackStack() },
                )
            }
            composable("task/{id}") { entry ->
                TaskDetailScreen(
                    id = entry.arguments?.getString("id") ?: "",
                    users = users,
                    canManage = canManage,
                    currentUid = session.uid,
                    onBack = { nav.popBackStack() },
                    onEdit = { nav.navigate("taskForm?id=$it") },
                )
            }
            composable(
                route = "taskForm?id={id}",
                arguments = listOf(navArgument("id") { type = NavType.StringType; nullable = true; defaultValue = null }),
            ) { entry ->
                TaskFormScreen(
                    editId = entry.arguments?.getString("id"),
                    users = users,
                    currentUid = session.uid,
                    onDone = { nav.popBackStack() },
                    onBack = { nav.popBackStack() },
                )
            }
        }
    }
}
