package com.eventshare.admin.ui.posts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import com.eventshare.admin.data.Repository
import com.eventshare.admin.ui.common.AppTopBar
import com.eventshare.admin.ui.common.ConfirmDialog
import com.eventshare.admin.ui.common.EmptyBox
import com.eventshare.admin.ui.common.ErrorBox
import com.eventshare.admin.ui.common.LoadingBox
import com.eventshare.admin.ui.common.StatusChip
import com.eventshare.admin.ui.common.appViewModel
import com.eventshare.admin.ui.common.postStatusLabel
import com.eventshare.admin.ui.common.relativeTime
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Elemento unificado: mensaje de una publicación o comentario. */
data class MessageItem(
    val id: String,
    val isComment: Boolean,
    val author: String,
    val text: String,
    val createdAt: String,
    val status: String? = null,
)

class MessagesViewModel(private val repo: Repository, private val eventId: String) : ViewModel() {
    data class State(
        val comments: Boolean = false,
        val items: List<MessageItem> = emptyList(),
        val cursor: String? = null,
        val loading: Boolean = true,
        val loadingMore: Boolean = false,
        val error: String? = null,
        val toast: String? = null,
    )

    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()
    private var requestId = 0

    init { load() }

    fun select(comments: Boolean) {
        if (comments == _state.value.comments) return
        _state.update { State(comments = comments) }
        load()
    }

    private suspend fun fetch(cursor: String?): Result<Pair<List<MessageItem>, String?>> =
        if (_state.value.comments) {
            repo.comments(eventId, cursor).map { page ->
                page.items.map { MessageItem(it.id, true, it.author.name, it.message, it.createdAt) } to page.nextCursor
            }
        } else {
            repo.posts(eventId, status = null, hasMessage = true, cursor = cursor).map { page ->
                page.items.map { MessageItem(it.id, false, it.author.name, it.message.orEmpty(), it.createdAt, it.status) } to page.nextCursor
            }
        }

    fun load() {
        val id = ++requestId
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            fetch(null).fold(
                onSuccess = { (items, next) -> if (id == requestId) _state.update { it.copy(loading = false, items = items, cursor = next) } },
                onFailure = { e -> if (id == requestId) _state.update { it.copy(loading = false, error = e.message) } },
            )
        }
    }

    fun loadMore() {
        val s = _state.value
        val cursor = s.cursor ?: return
        if (s.loadingMore) return
        val id = requestId
        viewModelScope.launch {
            _state.update { it.copy(loadingMore = true) }
            fetch(cursor).fold(
                onSuccess = { (items, next) -> if (id == requestId) _state.update { it.copy(loadingMore = false, items = it.items + items, cursor = next) } },
                onFailure = { e -> _state.update { it.copy(loadingMore = false, toast = e.message) } },
            )
        }
    }

    fun delete(item: MessageItem) {
        viewModelScope.launch {
            val r = if (item.isComment) repo.deleteComment(item.id) else repo.deletePost(item.id)
            r.fold(
                onSuccess = { _state.update { s -> s.copy(items = s.items.filterNot { it.id == item.id }, toast = "Mensaje eliminado") } },
                onFailure = { e -> _state.update { it.copy(toast = e.message) } },
            )
        }
    }

    fun consumeToast() = _state.update { it.copy(toast = null) }
}

@Composable
fun MessagesScreen(eventId: String, onBack: () -> Unit) {
    val vm = appViewModel(key = "messages-$eventId") { MessagesViewModel(it, eventId) }
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    var confirm by remember { mutableStateOf<MessageItem?>(null) }

    LaunchedEffect(state.toast) {
        state.toast?.let { snackbar.showSnackbar(it); vm.consumeToast() }
    }

    Scaffold(topBar = { AppTopBar("Mensajes", onBack) }, snackbarHost = { SnackbarHost(snackbar) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = if (state.comments) 1 else 0) {
                Tab(selected = !state.comments, onClick = { vm.select(false) }, text = { Text("Mensajes") })
                Tab(selected = state.comments, onClick = { vm.select(true) }, text = { Text("Comentarios") })
            }
            Box(Modifier.fillMaxSize()) {
                when {
                    state.loading -> LoadingBox()
                    state.error != null && state.items.isEmpty() -> ErrorBox(state.error!!, vm::load)
                    state.items.isEmpty() -> EmptyBox(if (state.comments) "Aún no hay comentarios." else "Aún no hay mensajes.")
                    else -> LazyColumn(
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(state.items, key = { it.id }) { m ->
                            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(m.text, style = MaterialTheme.typography.bodyLarge)
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text(
                                            "${m.author}, ${relativeTime(m.createdAt)}",
                                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.weight(1f),
                                        )
                                        m.status?.let { StatusChip(postStatusLabel(it)) }
                                        TextButton(onClick = { confirm = m }) { Text("Eliminar", color = MaterialTheme.colorScheme.error) }
                                    }
                                }
                            }
                        }
                        if (state.cursor != null) {
                            item {
                                TextButton(onClick = vm::loadMore, enabled = !state.loadingMore, modifier = Modifier.fillMaxWidth()) {
                                    Text(if (state.loadingMore) "Cargando…" else "Cargar más")
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    confirm?.let { m ->
        ConfirmDialog(
            title = "¿Eliminar mensaje?",
            text = if (m.isComment) "Se eliminará este comentario." else "Se eliminará la publicación completa, incluida su foto.",
            confirmLabel = "Eliminar",
            onConfirm = { vm.delete(m); confirm = null },
            onDismiss = { confirm = null },
        )
    }
}
