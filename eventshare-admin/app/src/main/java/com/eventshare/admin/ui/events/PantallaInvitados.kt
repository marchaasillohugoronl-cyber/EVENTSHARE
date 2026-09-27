package com.eventshare.admin.ui.events

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eventshare.admin.data.MemberDto
import com.eventshare.admin.data.Repository
import com.eventshare.admin.ui.common.AppTopBar
import com.eventshare.admin.ui.common.ConfirmDialog
import com.eventshare.admin.ui.common.EmptyBox
import com.eventshare.admin.ui.common.ErrorBox
import com.eventshare.admin.ui.common.LoadingBox
import com.eventshare.admin.ui.common.StatusChip
import com.eventshare.admin.ui.common.appViewModel
import com.eventshare.admin.ui.common.relativeTime
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class GuestsViewModel(private val repo: Repository, private val eventId: String) : ViewModel() {
    data class State(val loading: Boolean = true, val items: List<MemberDto> = emptyList(), val error: String? = null, val toast: String? = null)

    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = it.items.isEmpty(), error = null) }
            repo.members(eventId).fold(
                onSuccess = { list -> _state.update { it.copy(loading = false, items = list) } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message) } },
            )
        }
    }

    fun setBlocked(m: MemberDto, blocked: Boolean) {
        viewModelScope.launch {
            repo.setBlocked(eventId, m.id, blocked).fold(
                onSuccess = {
                    _state.update { s ->
                        s.copy(
                            items = s.items.map { if (it.id == m.id) it.copy(isBlocked = blocked) else it },
                            toast = if (blocked) "${m.name} fue bloqueado" else "${m.name} fue desbloqueado",
                        )
                    }
                },
                onFailure = { e -> _state.update { it.copy(toast = e.message) } },
            )
        }
    }

    fun consumeToast() = _state.update { it.copy(toast = null) }
}

@Composable
fun GuestsScreen(eventId: String, onBack: () -> Unit) {
    val vm = appViewModel(key = "guests-$eventId") { GuestsViewModel(it, eventId) }
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    var confirm by remember { mutableStateOf<MemberDto?>(null) }

    LaunchedEffect(state.toast) {
        state.toast?.let { snackbar.showSnackbar(it); vm.consumeToast() }
    }

    Scaffold(topBar = { AppTopBar("Invitados", onBack) }, snackbarHost = { SnackbarHost(snackbar) }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> LoadingBox()
                state.error != null && state.items.isEmpty() -> ErrorBox(state.error!!, vm::load)
                state.items.isEmpty() -> EmptyBox("Aún no hay invitados. Aparecerán cuando escaneen el QR y participen.")
                else -> LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp)) {
                    items(state.items, key = { it.id }) { m ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column(Modifier.weight(1f)) {
                                Text(m.name, style = MaterialTheme.typography.titleMedium)
                                Text("${m.postsCount} publicaciones, se unió ${relativeTime(m.joinedAt)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            if (m.isBlocked) StatusChip("Bloqueado")
                            if (m.isBlocked) TextButton(onClick = { vm.setBlocked(m, false) }) { Text("Desbloquear") }
                            else OutlinedButton(onClick = { confirm = m }) { Text("Bloquear") }
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    confirm?.let { m ->
        ConfirmDialog(
            title = "¿Bloquear a ${m.name}?",
            text = "No podrá publicar, comentar ni dar me gusta en este evento. Sus publicaciones actuales no se eliminan.",
            confirmLabel = "Bloquear",
            onConfirm = { vm.setBlocked(m, true); confirm = null },
            onDismiss = { confirm = null },
        )
    }
}
