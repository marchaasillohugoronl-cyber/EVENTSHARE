package com.eventshare.admin.ui.events

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.eventshare.admin.data.EventDetailResponse
import com.eventshare.admin.data.Repository
import com.eventshare.admin.ui.common.AppTopBar
import com.eventshare.admin.ui.common.ConfirmDialog
import com.eventshare.admin.ui.common.ErrorBox
import com.eventshare.admin.ui.common.LoadingBox
import com.eventshare.admin.ui.common.StatusChip
import com.eventshare.admin.ui.common.appViewModel
import com.eventshare.admin.ui.common.eventStatusLabel
import com.eventshare.admin.ui.common.formatEventDate
import com.eventshare.admin.util.Qr
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class EventDetailViewModel(private val repo: Repository, private val eventId: String) : ViewModel() {
    data class State(val loading: Boolean = true, val detail: EventDetailResponse? = null, val error: String? = null, val busy: Boolean = false)

    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = it.detail == null, error = null) }
            repo.eventDetail(eventId).fold(
                onSuccess = { d -> _state.update { State(loading = false, detail = d) } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message) } },
            )
        }
    }

    fun setStatus(status: String) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true) }
            repo.setEventStatus(eventId, status).fold(
                onSuccess = { load(); _state.update { it.copy(busy = false) } },
                onFailure = { e -> _state.update { it.copy(busy = false, error = e.message) } },
            )
        }
    }
}

@Composable
fun EventDetailScreen(
    eventId: String,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onPhotos: () -> Unit,
    onModeration: () -> Unit,
    onMessages: () -> Unit,
    onGuests: () -> Unit,
) {
    val vm = appViewModel(key = "detail-$eventId") { EventDetailViewModel(it, eventId) }
    val state by vm.state.collectAsState()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var confirmStatus by remember { mutableStateOf<String?>(null) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.load() }

    val detail = state.detail
    val qr = remember(detail?.event?.url) { detail?.event?.url?.let { Qr.bitmap(it) } }
    val saveQr = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("image/png")) { uri ->
        if (uri != null && qr != null) {
            val ok = Qr.writeTo(context, uri, qr)
            Toast.makeText(context, if (ok) "QR guardado" else "No se pudo guardar el QR", Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        topBar = {
            AppTopBar("Evento", onBack, actions = {
                IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, contentDescription = "Editar evento") }
            })
        },
    ) { padding ->
        when {
            detail == null && state.error != null -> Column(Modifier.padding(padding)) { ErrorBox(state.error!!, vm::load) }
            detail == null || qr == null -> Column(Modifier.padding(padding)) { LoadingBox() }
            else -> {
                val ev = detail.event
                val st = detail.stats
                Column(
                    Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Box(
                        Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(16.dp)).background(parseColor(ev.primaryColor)),
                        contentAlignment = Alignment.BottomStart,
                    ) {
                        if (ev.coverImageUrl != null) AsyncImage(ev.coverImageUrl, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    }
                    Text(ev.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        StatusChip(eventStatusLabel(ev.status))
                        formatEventDate(ev.eventDate)?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    if (!ev.description.isNullOrBlank()) Text(ev.description!!, style = MaterialTheme.typography.bodyMedium)

                    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                        Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Image(
                                qr.asImageBitmap(), "Código QR del evento", filterQuality = FilterQuality.None,
                                modifier = Modifier.size(220.dp).clip(RoundedCornerShape(8.dp)),
                            )
                            Text(ev.url, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 10.dp))
                            TextButton(onClick = {
                                clipboard.setText(AnnotatedString(ev.url))
                                Toast.makeText(context, "Enlace copiado", Toast.LENGTH_SHORT).show()
                            }) { Text("Copiar enlace") }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(onClick = { Qr.share(context, qr, ev.code, ev.name, ev.url) }) { Text("Compartir QR") }
                                OutlinedButton(onClick = { saveQr.launch("eventshare-${ev.code}.png") }) { Text("Descargar QR") }
                            }
                        }
                    }

                    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatRow("Fotografías", st.photos)
                            StatRow("Mensajes", st.messages)
                            StatRow("Comentarios", st.comments)
                            StatRow("Me gusta", st.likes)
                            StatRow("Invitados", st.guests)
                            StatRow("Pendientes de aprobación", st.pending)
                            HorizontalDivider()
                            Text(
                                if (ev.moderationEnabled) "Las publicaciones requieren aprobación" else "Las publicaciones se muestran de inmediato",
                                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    Button(onClick = onPhotos, modifier = Modifier.fillMaxWidth().height(50.dp)) { Text("Ver fotos") }
                    OutlinedButton(onClick = onMessages, modifier = Modifier.fillMaxWidth().height(50.dp)) { Text("Ver mensajes") }
                    OutlinedButton(onClick = onModeration, modifier = Modifier.fillMaxWidth().height(50.dp)) {
                        Text(if (st.pending > 0) "Moderación (${st.pending})" else "Moderación")
                    }
                    OutlinedButton(onClick = onGuests, modifier = Modifier.fillMaxWidth().height(50.dp)) { Text("Invitados") }

                    HorizontalDivider()
                    when (ev.status) {
                        "ACTIVE" -> OutlinedButton(onClick = { confirmStatus = "CLOSED" }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Cerrar evento") }
                        "CLOSED" -> OutlinedButton(onClick = { vm.setStatus("ACTIVE") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Reabrir evento") }
                    }
                    if (ev.status != "ARCHIVED") {
                        TextButton(onClick = { confirmStatus = "ARCHIVED" }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Archivar evento") }
                    } else {
                        TextButton(onClick = { vm.setStatus("ACTIVE") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Restaurar evento") }
                    }
                    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }

    confirmStatus?.let { target ->
        ConfirmDialog(
            title = if (target == "CLOSED") "¿Cerrar el evento?" else "¿Archivar el evento?",
            text = if (target == "CLOSED") "Los invitados podrán ver el álbum, pero ya no podrán publicar." else "El álbum dejará de ser visible para los invitados. Podrás restaurarlo cuando quieras.",
            confirmLabel = if (target == "CLOSED") "Cerrar" else "Archivar",
            onConfirm = { vm.setStatus(target); confirmStatus = null },
            onDismiss = { confirmStatus = null },
        )
    }
}

@Composable
private fun StatRow(label: String, value: Int) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label)
        Text("$value", fontWeight = FontWeight.SemiBold)
    }
}
