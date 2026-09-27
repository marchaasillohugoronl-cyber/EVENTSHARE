package com.eventshare.admin.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eventshare.admin.data.Repository
import com.eventshare.admin.ui.common.appViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class AuthViewModel(private val repo: Repository) : ViewModel() {
    data class State(val loading: Boolean = false, val error: String? = null, val done: Boolean = false)

    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()

    fun submit(register: Boolean, name: String, email: String, password: String) {
        if (email.isBlank() || password.isBlank() || (register && name.isBlank())) {
            _state.update { it.copy(error = "Completa todos los campos.") }
            return
        }
        if (register && password.length < 8) {
            _state.update { it.copy(error = "La contraseña debe tener al menos 8 caracteres.") }
            return
        }
        viewModelScope.launch {
            _state.update { State(loading = true) }
            val r = if (register) repo.register(name, email, password) else repo.login(email, password)
            r.fold(
                onSuccess = { _state.update { State(done = true) } },
                onFailure = { e -> _state.update { State(error = e.message) } },
            )
        }
    }
}

@Composable
fun AuthScreen(onLoggedIn: () -> Unit) {
    val vm = appViewModel { AuthViewModel(it) }
    val state by vm.state.collectAsState()
    var register by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(state.done) { if (state.done) onLoggedIn() }

    Scaffold { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding().padding(28.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Text("EventShare", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text(
                if (register) "Crea tu cuenta de anfitrión" else "Administra los álbumes de tus eventos",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp, bottom = 28.dp),
            )

            if (register) {
                OutlinedTextField(name, { name = it }, label = { Text("Nombre") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(12.dp))
            }
            OutlinedTextField(
                email, { email = it }, label = { Text("Correo") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                password, { password = it }, label = { Text("Contraseña") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth(),
            )

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp)) }

            Button(
                onClick = { vm.submit(register, name, email, password) },
                enabled = !state.loading,
                modifier = Modifier.fillMaxWidth().height(52.dp).padding(top = 0.dp),
            ) {
                if (state.loading) CircularProgressIndicator(Modifier.height(22.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                else Text(if (register) "Crear cuenta" else "Iniciar sesión")
            }
            TextButton(onClick = { register = !register }, modifier = Modifier.fillMaxWidth()) {
                Text(if (register) "Ya tengo cuenta" else "¿No tienes cuenta? Regístrate")
            }
        }
    }
}
