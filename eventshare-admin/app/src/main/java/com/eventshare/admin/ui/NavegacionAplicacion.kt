package com.eventshare.admin.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.eventshare.admin.data.AppContainer
import com.eventshare.admin.ui.auth.AuthScreen
import com.eventshare.admin.ui.dashboard.DashboardScreen
import com.eventshare.admin.ui.events.EventDetailScreen
import com.eventshare.admin.ui.events.EventFormScreen
import com.eventshare.admin.ui.events.EventsScreen
import com.eventshare.admin.ui.events.GuestsScreen
import com.eventshare.admin.ui.posts.MessagesScreen
import com.eventshare.admin.ui.posts.PostsScreen

object Routes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val EVENTS = "events"
    const val CREATE = "create-event"
    const val DETAIL = "events/{id}"
    const val EDIT = "events/{id}/edit"
    const val POSTS = "events/{id}/posts/{tab}"
    const val MESSAGES = "events/{id}/messages"
    const val GUESTS = "events/{id}/guests"

    fun detail(id: String) = "events/$id"
    fun edit(id: String) = "events/$id/edit"
    fun posts(id: String, tab: String) = "events/$id/posts/$tab"
    fun messages(id: String) = "events/$id/messages"
    fun guests(id: String) = "events/$id/guests"
}

@Composable
fun AppNav(container: AppContainer) {
    val nav = rememberNavController()
    val user by container.session.user.collectAsState()
    val start = remember { if (container.session.user.value != null) Routes.DASHBOARD else Routes.LOGIN }

    // Si la sesión se cierra (logout o refresh token inválido) volvemos al login.
    LaunchedEffect(user) {
        if (user == null && nav.currentDestination?.route != Routes.LOGIN) {
            nav.navigate(Routes.LOGIN) { popUpTo(0) { inclusive = true } }
        }
    }

    NavHost(navController = nav, startDestination = start) {
        composable(Routes.LOGIN) {
            AuthScreen(onLoggedIn = { nav.navigate(Routes.DASHBOARD) { popUpTo(Routes.LOGIN) { inclusive = true } } })
        }
        composable(Routes.DASHBOARD) {
            DashboardScreen(onEvents = { nav.navigate(Routes.EVENTS) }, onCreate = { nav.navigate(Routes.CREATE) })
        }
        composable(Routes.EVENTS) {
            EventsScreen(
                onBack = { nav.popBackStack() },
                onCreate = { nav.navigate(Routes.CREATE) },
                onOpen = { nav.navigate(Routes.detail(it)) },
            )
        }
        composable(Routes.CREATE) {
            EventFormScreen(eventId = null, onBack = { nav.popBackStack() }, onSaved = { nav.popBackStack() })
        }
        composable(Routes.EDIT) { e ->
            EventFormScreen(eventId = e.arguments?.getString("id"), onBack = { nav.popBackStack() }, onSaved = { nav.popBackStack() })
        }
        composable(Routes.DETAIL) { e ->
            val id = e.arguments?.getString("id") ?: return@composable
            EventDetailScreen(
                eventId = id,
                onBack = { nav.popBackStack() },
                onEdit = { nav.navigate(Routes.edit(id)) },
                onPhotos = { nav.navigate(Routes.posts(id, "approved")) },
                onModeration = { nav.navigate(Routes.posts(id, "pending")) },
                onMessages = { nav.navigate(Routes.messages(id)) },
                onGuests = { nav.navigate(Routes.guests(id)) },
            )
        }
        composable(Routes.POSTS) { e ->
            val id = e.arguments?.getString("id") ?: return@composable
            PostsScreen(eventId = id, initialTab = e.arguments?.getString("tab") ?: "pending", onBack = { nav.popBackStack() })
        }
        composable(Routes.MESSAGES) { e ->
            val id = e.arguments?.getString("id") ?: return@composable
            MessagesScreen(eventId = id, onBack = { nav.popBackStack() })
        }
        composable(Routes.GUESTS) { e ->
            val id = e.arguments?.getString("id") ?: return@composable
            GuestsScreen(eventId = id, onBack = { nav.popBackStack() })
        }
    }
}
