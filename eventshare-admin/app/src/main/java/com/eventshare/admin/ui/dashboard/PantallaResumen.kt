package com.eventshare.admin.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewModelScope
import com.eventshare.admin.data.DashboardStats
import com.eventshare.admin.data.Repository
import com.eventshare.admin.ui.common.AppTopBar
import com.eventshare.admin.ui.common.ErrorBox
import com.eventshare.admin.ui.common.LoadingBox
import com.eventshare.admin.ui.common.appViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class DashboardViewModel(private val repo: Repository) : ViewModel() {
    data class State(val loading: Boolean = true, val stats: DashboardStats? = null, val error: String? = null)

    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = it.stats == null, error = null) }
            repo.stats().fold(
                onSuccess = { s -> _state.update { State(loading = false, stats = s) } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message) } },
            )
        }
    }

    fun logout() {
        viewModelScope.launch { repo.logout() }
    }
}

@Composable
fun DashboardScreen(onEvents: () -> Unit, onCreate: () -> Unit) {
    val vm = appViewModel { DashboardViewModel(it) }
    val state by vm.state.collectAsState()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.load() }

    Scaffold(topBar = { AppTopBar("Panel", actions = { TextButton(onClick = vm::logout) { Text("Salir") } }) }) { padding ->
        val stats = state.stats
        when {
            stats == null && state.error != null -> Column(Modifier.padding(padding)) { ErrorBox(state.error!!, vm::load) }
            stats == null -> Column(Modifier.padding(padding)) { LoadingBox() }
            else -> Column(
                Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard("Eventos", stats.events)
                    StatCard("Fotografías", stats.photos)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard("Mensajes", stats.messages)
                    StatCard("Invitados", stats.guests)
                }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (stats.pending > 0) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Text("${stats.pending}", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
                        Text("Publicaciones pendientes de aprobación")
                    }
                }
                Button(onClick = onEvents, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Mis eventos") }
                OutlinedButton(onClick = onCreate, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("+ Crear evento") }
            }
        }
    }
}

@Composable
private fun RowScope.StatCard(label: String, value: Int) {
    Card(Modifier.weight(1f), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(16.dp)) {
            Text("$value", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
