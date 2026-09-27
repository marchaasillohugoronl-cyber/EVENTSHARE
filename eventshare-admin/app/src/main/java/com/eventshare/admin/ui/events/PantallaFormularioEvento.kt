package com.eventshare.admin.ui.events

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.eventshare.admin.data.EventRequest
import com.eventshare.admin.data.Repository
import com.eventshare.admin.ui.common.AppTopBar
import com.eventshare.admin.ui.common.LoadingBox
import com.eventshare.admin.ui.common.appViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

val EventColors = listOf("#1F2937", "#9F1239", "#B45309", "#166534", "#0F766E", "#1D4ED8", "#6D28D9", "#BE185D")

class EventFormViewModel(private val repo: Repository, private val eventId: String?) : ViewModel() {
    data class State(
        val loading: Boolean = false,
        val saving: Boolean = false,
        val name: String = "",
        val description: String = "",
        val date: LocalDate? = null,
        val color: String = EventColors[0],
        val moderation: Boolean = true,
        val coverUri: Uri? = null,
        val coverUrl: String? = null,
        val error: String? = null,
        val saved: Boolean = false,
    )

    private val _state = MutableStateFlow(State(loading = eventId != null))
    val state = _state.asStateFlow()

    init {
        if (eventId != null) viewModelScope.launch {
            repo.eventDetail(eventId).fold(
                onSuccess = { d ->
                    val ev = d.event
                    _state.update {
                        it.copy(
                            loading = false, name = ev.name, description = ev.description.orEmpty(),
                            date = ev.eventDate?.let { s -> runCatching { OffsetDateTime.parse(s).atZoneSameInstant(ZoneId.systemDefault()).toLocalDate() }.getOrNull() },
                            color = ev.primaryColor, moderation = ev.moderationEnabled, coverUrl = ev.coverImageUrl,
                        )
                    }
                },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message) } },
            )
        }
    }

    fun setName(v: String) = _state.update { it.copy(name = v.take(120), error = null) }
    fun setDescription(v: String) = _state.update { it.copy(description = v.take(1000)) }
    fun setDate(v: LocalDate) = _state.update { it.copy(date = v, error = null) }
    fun setColor(v: String) = _state.update { it.copy(color = v) }
    fun setModeration(v: Boolean) = _state.update { it.copy(moderation = v) }
    fun setCover(v: Uri) = _state.update { it.copy(coverUri = v) }

    fun save() {
        val s = _state.value
        if (s.name.isBlank()) return _state.update { it.copy(error = "Escribe el nombre del evento.") }
        val date = s.date ?: return _state.update { it.copy(error = "Elige la fecha del evento.") }
        viewModelScope.launch {
            _state.update { it.copy(saving = true, error = null) }
            var coverKey: String? = null
            if (s.coverUri != null) {
                val up = repo.uploadCover(s.coverUri)
                if (up.isFailure) return@launch _state.update { it.copy(saving = false, error = up.exceptionOrNull()?.message) }
                coverKey = up.getOrNull()
            }
            val iso = DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(date.atTime(12, 0).atZone(ZoneId.systemDefault()).toOffsetDateTime())
            val req = EventRequest(
                name = s.name.trim(), description = s.description.trim(), eventDate = iso,
                primaryColor = s.color, moderationEnabled = s.moderation, coverKey = coverKey,
            )
            val r = if (eventId == null) repo.createEvent(req) else repo.updateEvent(eventId, req)
            r.fold(
                onSuccess = { _state.update { it.copy(saving = false, saved = true) } },
                onFailure = { e -> _state.update { it.copy(saving = false, error = e.message) } },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventFormScreen(eventId: String?, onBack: () -> Unit, onSaved: () -> Unit) {
    val vm = appViewModel(key = "form-${eventId ?: "new"}") { EventFormViewModel(it, eventId) }
    val s by vm.state.collectAsState()
    var showPicker by remember { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> if (uri != null) vm.setCover(uri) }

    LaunchedEffect(s.saved) { if (s.saved) onSaved() }

    Scaffold(topBar = { AppTopBar(if (eventId == null) "Crear evento" else "Editar evento", onBack) }) { padding ->
        if (s.loading) {
            Column(Modifier.padding(padding)) { LoadingBox() }
            return@Scaffold
        }
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                Modifier.fillMaxWidth().height(170.dp).clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
                    .clickable { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                contentAlignment = Alignment.Center,
            ) {
                val model: Any? = s.coverUri ?: s.coverUrl
                if (model != null) AsyncImage(model, "Portada del evento", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                else Text("Toca para elegir la imagen de portada", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            OutlinedTextField(s.name, vm::setName, label = { Text("Nombre") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(s.description, vm::setDescription, label = { Text("Descripción") }, minLines = 3, modifier = Modifier.fillMaxWidth())

            OutlinedButton(onClick = { showPicker = true }, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                Text(s.date?.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG)) ?: "Elegir fecha")
            }

            Text("Color principal", style = MaterialTheme.typography.titleSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                EventColors.forEach { hex ->
                    val selected = hex.equals(s.color, ignoreCase = true)
                    Box(
                        Modifier.size(34.dp).clip(CircleShape).background(parseColor(hex))
                            .border(if (selected) BorderStroke(3.dp, MaterialTheme.colorScheme.onSurface) else BorderStroke(0.dp, Color.Transparent), CircleShape)
                            .clickable { vm.setColor(hex) },
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Las publicaciones requieren aprobación", style = MaterialTheme.typography.bodyLarge)
                    Text("Tú decides qué se muestra en el muro.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(checked = s.moderation, onCheckedChange = vm::setModeration)
            }

            s.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(onClick = vm::save, enabled = !s.saving, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                Text(if (s.saving) "Guardando…" else if (eventId == null) "Crear evento" else "Guardar cambios")
            }
        }
    }

    if (showPicker) {
        val state = rememberDatePickerState(initialSelectedDateMillis = s.date?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { vm.setDate(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                    showPicker = false
                }) { Text("Aceptar") }
            },
            dismissButton = { TextButton(onClick = { showPicker = false }) { Text("Cancelar") } },
        ) { DatePicker(state = state) }
    }
}
