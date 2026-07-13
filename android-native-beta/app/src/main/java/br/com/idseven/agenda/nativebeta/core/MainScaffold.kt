package br.com.idseven.agenda.nativebeta.core

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Today
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import br.com.idseven.agenda.nativebeta.data.UserSession
import br.com.idseven.agenda.nativebeta.domain.TaskPhase
import br.com.idseven.agenda.nativebeta.designsystem.components.AppTopbar
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.features.agenda.AgendaScreen
import br.com.idseven.agenda.nativebeta.features.chat.ChatListScreen
import br.com.idseven.agenda.nativebeta.features.chat.ChatThreadScreen
import br.com.idseven.agenda.nativebeta.features.dashboard.DashboardScreen
import br.com.idseven.agenda.nativebeta.features.events.EventDetailScreen
import br.com.idseven.agenda.nativebeta.features.events.EventFormScreen
import br.com.idseven.agenda.nativebeta.features.profile.ProfileScreen
import br.com.idseven.agenda.nativebeta.features.tasks.BoardsHubScreen
import br.com.idseven.agenda.nativebeta.features.tasks.TaskDetailScreen
import br.com.idseven.agenda.nativebeta.features.tasks.TaskFormScreen
import br.com.idseven.agenda.nativebeta.features.tasks.TasksScreen
import br.com.idseven.agenda.nativebeta.features.team.TeamScreen

private data class Tab(val route: String, val label: String, val icon: ImageVector)

@Composable
private fun BottomBar(tabs: List<Tab>, route: String, onSelect: (String) -> Unit, onNew: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(Tokens.Surface)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.Line))
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            tabs.take(3).forEach { NavItem(it, route, Modifier.weight(1f), onSelect) }
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.clip(RoundedCornerShape(16.dp)).clickable { onNew() }.padding(vertical = 2.dp),
                ) {
                    Box(Modifier.size(46.dp).clip(CircleShape).background(Tokens.Accent), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.Add, contentDescription = "Novo", tint = Color.White, modifier = Modifier.size(26.dp))
                    }
                    Spacer(Modifier.height(2.dp))
                    Text("Novo", color = Tokens.Accent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
            tabs.drop(3).forEach { NavItem(it, route, Modifier.weight(1f), onSelect) }
        }
    }
}

@Composable
private fun NavItem(tab: Tab, route: String, modifier: Modifier, onSelect: (String) -> Unit) {
    val sel = route == tab.route
    val color = if (sel) Tokens.Accent else Tokens.Faint
    Column(
        modifier = modifier.clip(RoundedCornerShape(12.dp)).clickable { onSelect(tab.route) }.padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(tab.icon, contentDescription = tab.label, tint = color, modifier = Modifier.size(24.dp))
        Spacer(Modifier.height(3.dp))
        Text(tab.label, color = color, fontSize = 10.sp, fontWeight = if (sel) FontWeight.Bold else FontWeight.Normal, maxLines = 1)
    }
}

@Composable
fun MainScaffold(session: UserSession, onLogout: () -> Unit) {
    val nav = rememberNavController()
    val vm: HomeViewModel = viewModel()
    val eventsState by vm.events.collectAsState()
    val usersState by vm.users.collectAsState()
    val tasksState by vm.tasks.collectAsState()

    val users = usersState.itemsOrEmpty()
    val currentUser = users.firstOrNull { it.id == session.uid }
    val self by vm.self.collectAsState()   // F3.3.73D — perfil canônico (getUserSelf) p/ e-mail/telefone
    val canManage = currentUser?.admin == true

    // Notificações: canais, permissão (Android 13+) e registro do token FCM.
    val context = LocalContext.current
    // F3.2.2 — contador read-side de alertas SLA (local; sem backend/push). `slaBump`
    // força recomputo após marcar lida(s); `slaUnread` é calculado mais abaixo, com `route`
    // entre as chaves do remember para zerar/atualizar ao voltar da tela de alertas.
    var slaBump by remember { mutableStateOf(0) }
    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        Notifications.ensure(context)
        if (Build.VERSION.SDK_INT >= 33 && !Notifications.hasPostPermission(context)) {
            notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        Fcm.register(context, session.uid)
    }
    // Re-registra o token FCM a cada retomada do app (auto-recuperação): cobre falhas de
    // rede no 1º registro e garante que TODOS os usuários tenham token atual em users/{uid}.
    val lifecycleOwner = androidx.compose.ui.platform.LocalLifecycleOwner.current
    androidx.compose.runtime.DisposableEffect(lifecycleOwner, session.uid) {
        val obs = androidx.lifecycle.LifecycleEventObserver { _, e ->
            if (e == androidx.lifecycle.Lifecycle.Event.ON_RESUME) Fcm.register(context, session.uid)
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }
    // Lembretes locais: reagenda sempre que a agenda OU as tarefas mudam (com dedupe).
    LaunchedEffect(eventsState, tasksState, usersState, session.uid) {
        // Lembrete 1h antes (premium full-screen) APENAS para o responsável (ownerId/assigneeId).
        // Se faltar <1h, dispara no horário do item. `users` resolve a foto do responsável
        // p/ o avatar premium (reagenda quando a lista de usuários carrega).
        ReminderScheduler.sync(context, eventsState.itemsOrEmpty(), tasksState.itemsOrEmpty(), currentUid = session.uid, leadMinutes = 60, users = users)
    }
    // Notificação IMEDIATA tocada: navega DIRETO ao destino (sem modal).
    // O modal premium é exclusivo do lembrete de 1h (ReminderAlarmActivity full-screen).
    val pendingDeepLink by DeepLink.pending.collectAsState()
    LaunchedEffect(pendingDeepLink) {
        val dl = pendingDeepLink?.takeIf { it.isNotBlank() } ?: return@LaunchedEffect
        DeepLink.pending.value = null
        val route = when {
            dl.startsWith("task:") -> "task/${dl.removePrefix("task:")}"
            dl.startsWith("event:") -> "event/${dl.removePrefix("event:")}"
            dl.startsWith("chat:") -> "chatThread/${dl.removePrefix("chat:")}"
            else -> "event/$dl"
        }
        runCatching { nav.navigate(route) }
    }

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
    // Tempo real (read-side, sem backend): tick a cada 30s p/ o contador refletir a entrada
    // em "prazo próximo" (laranja) e a virada para "prazo encerrado" (vermelho) sem refresh.
    var slaTick by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(30_000); slaTick++ } }
    // Contador de alertas SLA não lidos. `route` garante recomputo ao voltar de "slaAlerts";
    // `slaBump` cobre marcações; `slaTick` cobre a passagem do tempo (prazo final).
    val slaUnread = remember(tasksState, currentUser, slaBump, route, slaTick) {
        val rd = SlaReadStore.read(context)
        SlaInApp.items(currentUser, tasksState.itemsOrEmpty()).count { it.key !in rd }
    }

    // F3.3.6-C — notificações in-app (read-side; sem push, sem escrita). Derivadas dos StateFlows.
    var seenBump by remember { mutableStateOf(0) }
    val tasksList = tasksState.itemsOrEmpty()
    // SLA pessoal: SOMENTE o designer responsável. Recomputa no tick e ao marcar como visto.
    val slaBanner = remember(tasksList, currentUser, users, slaTick, seenBump) {
        val seen = InAppSeenStore.read(context)
        InAppNotif.slaItems(currentUser, tasksList, users).filter { it.key !in seen }
    }
    // Fluxo/equipe: detecta TRANSIÇÃO de fase entre snapshots (o 1º snapshot apenas semeia → sem spam).
    val prevPhases = remember { mutableStateOf<Map<String, TaskPhase>>(emptyMap()) }
    val phasesSeeded = remember { mutableStateOf(false) }
    var flowQueue by remember { mutableStateOf<List<InAppNotifItem>>(emptyList()) }
    LaunchedEffect(tasksList, currentUser, users) {
        val curr = InAppNotif.phaseMap(currentUser, tasksList)
        if (phasesSeeded.value) {
            val seen = InAppSeenStore.read(context)
            val add = InAppNotif.flowItems(currentUser, tasksList, users, prevPhases.value).filter { it.key !in seen }
            if (add.isNotEmpty()) flowQueue = (flowQueue + add).distinctBy { it.key }
        } else {
            phasesSeeded.value = true
        }
        prevPhases.value = curr
    }
    // Fila final: crítico → vermelho → SLA antes de fluxo → mais antigo primeiro.
    val bannerItems = remember(slaBanner, flowQueue) {
        (slaBanner + flowQueue).sortedWith(
            compareByDescending<InAppNotifItem> { it.critical }
                .thenByDescending { it.sev == "vermelho" }
                .thenByDescending { it.kind == "sla" }
                .thenBy { it.anchorMs },
        )
    }

    Scaffold(
        containerColor = Tokens.Bg,
        topBar = {
            if (isTab) Box(Modifier.fillMaxWidth()) {
                AppTopbar(title = "ID Seven", subtitle = "sincronizado", currentUser = currentUser)
                // Sino SLA no canto superior direito, à ESQUERDA do avatar (avatar 40dp +
                // padding horizontal 20dp do topbar), centralizado na vertical, sem sobrepor.
                SlaBell(
                    unread = slaUnread,
                    onClick = { nav.navigate("slaAlerts") },
                    modifier = Modifier.align(Alignment.CenterEnd).padding(end = 68.dp),
                )
            }
        },
        bottomBar = {
            if (isTab) BottomBar(
                tabs = tabs,
                route = route,
                onSelect = { r ->
                    if (route != r) nav.navigate(r) {
                        popUpTo(nav.graph.startDestinationId) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                onNew = { nav.navigate(if (route == "tarefas") "taskForm" else "eventForm") },
            )
        },
    ) { padding ->
        Box(Modifier.fillMaxSize()) {
        NavHost(nav, startDestination = "hoje", modifier = Modifier.padding(padding)) {
            composable("hoje") {
                DashboardScreen(
                    eventsState, tasksState, users, session,
                    onEventClick = { nav.navigate("event/$it") },
                    onTaskClick = { nav.navigate("task/$it") },
                    onNavTab = { r ->
                        nav.navigate(r) {
                            popUpTo(nav.graph.startDestinationId) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable("agenda") { AgendaScreen(eventsState, users, onEventClick = { nav.navigate("event/$it") }) }
            composable("tarefas") {
                BoardsHubScreen(tasksState, currentUser = currentUser, onOpenSector = { nav.navigate("board/$it") })
            }
            composable(
                route = "board/{sector}",
                arguments = listOf(navArgument("sector") { type = NavType.StringType }),
            ) { entry ->
                val sectorKey = entry.arguments?.getString("sector") ?: "edicao_midia"
                TasksScreen(
                    tasksState, users, currentUid = session.uid,
                    onTaskClick = { nav.navigate("task/$it") },
                    currentUser = currentUser,
                    lockedSector = sectorKey,
                    onNew = { nav.navigate("taskForm?sector=$sectorKey") },
                    onBack = { nav.popBackStack() },
                )
            }
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
            composable("perfil") { ProfileScreen(currentUser, self, session, onLogout) }
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
                route = "taskForm?id={id}&sector={sector}",
                arguments = listOf(
                    navArgument("id") { type = NavType.StringType; nullable = true; defaultValue = null },
                    navArgument("sector") { type = NavType.StringType; nullable = true; defaultValue = null },
                ),
            ) { entry ->
                TaskFormScreen(
                    editId = entry.arguments?.getString("id"),
                    users = users,
                    currentUid = session.uid,
                    onDone = { nav.popBackStack() },
                    onBack = { nav.popBackStack() },
                    initialSector = entry.arguments?.getString("sector"),
                )
            }
            composable("slaAlerts") {
                SlaAlertsScreen(
                    tasks = tasksState.itemsOrEmpty(),
                    currentUser = currentUser,
                    onOpenTask = { nav.navigate("task/$it") },
                    onBack = { nav.popBackStack() },
                    onChanged = { slaBump++ },
                )
            }
        }
        // F3.3.6-C — banner premium in-app no TOPO (só nas abas; sobre o conteúdo). Read-side.
        if (isTab) {
            InAppBanner(
                items = bannerItems,
                onOpen = { dl -> DeepLink.pending.value = dl },
                onSeen = { key ->
                    InAppSeenStore.markSeen(context, key)
                    flowQueue = flowQueue.filter { it.key != key }
                    seenBump++
                },
                modifier = Modifier.align(Alignment.TopCenter).padding(padding),
            )
        }
        }
    }
}
