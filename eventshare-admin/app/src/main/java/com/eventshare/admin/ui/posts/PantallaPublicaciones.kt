package com.eventshare.admin.ui.posts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.eventshare.admin.data.PostDto
import com.eventshare.admin.data.Repository
import com.eventshare.admin.ui.common.AppTopBar
import com.eventshare.admin.ui.common.ConfirmDialog
import com.eventshare.admin.ui.common.EmptyBox
import com.eventshare.admin.ui.common.ErrorBox
import com.eventshare.admin.ui.common.LoadingBox
import com.eventshare.admin.ui.common.appViewModel
import com.eventshare.admin.ui.common.relativeTime
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private val Tabs = listOf("PENDING" to "Pendientes", "APPROVED" to "Aprobadas", "REJECTED" to "Rechazadas")

class PostsViewModel(private val repo: Repository, private val eventId: String, initial: String) : ViewModel() {
    data class State(
        val status: String,
        val items: List<PostDto> = emptyList(),
        val cursor: String? = null,
        val loading: Boolean = true,
        val loadingMore: Boolean = false,
        val error: String? = null,
        val toast: String? = null,
    )

    private val _state = MutableStateFlow(State(status = initial.uppercase()))
    val state = _state.asStateFlow()
    private var requestId = 0

    init { load() }

    fun select(status: String) {
        if (status == _state.value.status) return
        _state.update { State(status = status) }
        load()
    }

    fun load() {
        val id = ++requestId
        val status = _state.value.status
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repo.posts(eventId, status, hasMessage = false, cursor = null).fold(
                onSuccess = { p -> if (id == requestId) _state.update { it.copy(loading = false, items = p.items, cursor = p.nextCursor) } },
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
            repo.posts(eventId, s.status, hasMessage = false, cursor = cursor).fold(
                onSuccess = { p -> if (id == requestId) _state.update { it.copy(loadingMore = false, items = it.items + p.items, cursor = p.nextCursor) } },
                onFailure = { e -> _state.update { it.copy(loadingMore = false, toast = e.message) } },
            )
        }
    }

    private fun removeLocally(post: PostDto, message: String) =
        _state.update { s -> s.copy(items = s.items.filterNot { it.id == post.id }, toast = message) }

    fun moderate(post: PostDto, status: String) {
        viewModelScope.launch {
            repo.moderate(post.id, status).fold(
                onSuccess = { removeLocally(post, if (status == "APPROVED") "Publicación aprobada" else "Publicación rechazada") },
                onFailure = { e -> _state.update { it.copy(toast = e.message) } },
            )
        }
    }

    fun delete(post: PostDto) {
        viewModelScope.launch {
            repo.deletePost(post.id).fold(
                onSuccess = { removeLocally(post, "Publicación eliminada") },
                onFailure = { e -> _state.update { it.copy(toast = e.message) } },
            )
        }
    }

    fun blockAuthor(post: PostDto) {
        viewModelScope.launch {
            repo.setBlocked(eventId, post.author.id, true).fold(
                onSuccess = { _state.update { it.copy(toast = "${post.author.name} fue bloqueado") } },
                onFailure = { e -> _state.update { it.copy(toast = e.message) } },
            )
        }
    }

    fun consumeToast() = _state.update { it.copy(toast = null) }
}

private sealed interface PendingAction {
    data class Delete(val post: PostDto) : PendingAction
    data class Block(val post: PostDto) : PendingAction
}

@Composable
fun PostsScreen(eventId: String, initialTab: String, onBack: () -> Unit) {
    val vm = appViewModel(key = "posts-$eventId-$initialTab") { PostsViewModel(it, eventId, initialTab) }
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    var pending by remember { mutableStateOf<PendingAction?>(null) }

    LaunchedEffect(state.toast) {
        state.toast?.let { snackbar.showSnackbar(it); vm.consumeToast() }
    }

    Scaffold(topBar = { AppTopBar("Publicaciones", onBack) }, snackbarHost = { SnackbarHost(snackbar) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = Tabs.indexOfFirst { it.first == state.status }.coerceAtLeast(0)) {
                Tabs.forEach { (status, label) ->
                    Tab(selected = state.status == status, onClick = { vm.select(status) }, text = { Text(label) })
                }
            }
            Box(Modifier.fillMaxSize()) {
                when {
                    state.loading -> LoadingBox()
                    state.error != null && state.items.isEmpty() -> ErrorBox(state.error!!, vm::load)
                    state.items.isEmpty() -> EmptyBox(
                        when (state.status) {
                            "PENDING" -> "No hay publicaciones por revisar."
                            "APPROVED" -> "Aún no hay publicaciones aprobadas."
                            else -> "No hay publicaciones rechazadas."
                        }
                    )
                    else -> LazyColumn(
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        items(state.items, key = { it.id }) { post ->
                            PostCard(
                                post = post,
                                onApprove = { vm.moderate(post, "APPROVED") },
                                onReject = { vm.moderate(post, "REJECTED") },
                                onDelete = { pending = PendingAction.Delete(post) },
                                onBlock = { pending = PendingAction.Block(post) },
                            )
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

    when (val p = pending) {
        is PendingAction.Delete -> ConfirmDialog(
            title = "¿Eliminar publicación?",
            text = "Se eliminará la foto y el mensaje. Esta acción no se puede deshacer.",
            confirmLabel = "Eliminar",
            onConfirm = { vm.delete(p.post); pending = null },
            onDismiss = { pending = null },
        )
        is PendingAction.Block -> ConfirmDialog(
            title = "¿Bloquear a ${p.post.author.name}?",
            text = "No podrá publicar, comentar ni dar me gusta en este evento.",
            confirmLabel = "Bloquear",
            onConfirm = { vm.blockAuthor(p.post); pending = null },
            onDismiss = { pending = null },
        )
        null -> Unit
    }
}

@Composable
private fun PostCard(post: PostDto, onApprove: () -> Unit, onReject: () -> Unit, onDelete: () -> Unit, onBlock: () -> Unit) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (post.photoUrl != null) {
                AsyncImage(
                    post.photoUrl, "Foto de ${post.author.name}", contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp, max = 320.dp).clip(RoundedCornerShape(10.dp)),
                )
            }
            if (!post.message.isNullOrBlank()) Text(post.message!!, style = MaterialTheme.typography.bodyLarge)
            Text(
                "${post.author.name}, ${relativeTime(post.createdAt)}  ·  ${post.likesCount} me gusta, ${post.commentsCount} comentarios",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (post.status != "APPROVED") Button(onClick = onApprove) { Text("Aprobar") }
                if (post.status != "REJECTED") OutlinedButton(onClick = onReject) { Text("Rechazar") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = onDelete) { Text("Eliminar", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Medium) }
                TextButton(onClick = onBlock) { Text("Bloquear autor") }
            }
        }
    }
}
