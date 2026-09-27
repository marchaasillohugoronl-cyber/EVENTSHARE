package com.eventshare.admin.ui.events

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.eventshare.admin.data.EventSummaryDto
import com.eventshare.admin.data.Repository
import com.eventshare.admin.ui.common.AppTopBar
import com.eventshare.admin.ui.common.EmptyBox
import com.eventshare.admin.ui.common.ErrorBox
import com.eventshare.admin.ui.common.LoadingBox
import com.eventshare.admin.ui.common.StatusChip
import com.eventshare.admin.ui.common.appViewModel
import com.eventshare.admin.ui.common.eventStatusLabel
import com.eventshare.admin.ui.common.formatEventDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class EventsViewModel(private val repo: Repository) : ViewModel() {
    data class State(val loading: Boolean = true, val items: List<EventSummaryDto> = emptyList(), val error: String? = null)

    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = it.items.isEmpty(), error = null) }
            repo.events().fold(
                onSuccess = { list -> _state.update { State(loading = false, items = list) } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message) } },
            )
        }
    }
}

fun parseColor(hex: String): Color = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color(0xFF1F2937))

@Composable
fun EventsScreen(onBack: () -> Unit, onCreate: () -> Unit, onOpen: (String) -> Unit) {
    val vm = appViewModel { EventsViewModel(it) }
    val state by vm.state.collectAsState()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.load() }

    Scaffold(
        topBar = { AppTopBar("Mis eventos", onBack) },
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = onCreate, icon = { Icon(Icons.Default.Add, null) }, text = { Text("Crear evento") })
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> LoadingBox()
                state.error != null && state.items.isEmpty() -> ErrorBox(state.error!!, vm::load)
                state.items.isEmpty() -> EmptyBox("Todavía no tienes eventos. Crea el primero para generar su código QR.")
                else -> LazyColumn(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp, 8.dp, 16.dp, 96.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(state.items, key = { it.id }) { ev -> EventCard(ev) { onOpen(ev.id) } }
                }
            }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun EventCard(ev: EventSummaryDto, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(Modifier.size(72.dp).clip(RoundedCornerShape(12.dp)).background(parseColor(ev.primaryColor)), contentAlignment = Alignment.Center) {
                if (ev.coverImageUrl != null) {
                    AsyncImage(ev.coverImageUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Text(ev.name.take(1).uppercase(), color = Color.White, style = MaterialTheme.typography.headlineSmall)
                }
            }
            Column(Modifier.weight(1f)) {
                Text(ev.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                formatEventDate(ev.eventDate)?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                Text("${ev.photosCount} fotos, ${ev.guestsCount} invitados", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                StatusChip(eventStatusLabel(ev.status))
                if (ev.pendingCount > 0) StatusChip("${ev.pendingCount} por aprobar")
            }
        }
    }
}
