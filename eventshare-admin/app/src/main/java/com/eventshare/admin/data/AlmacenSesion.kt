package com.eventshare.admin.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private val Context.sessionDataStore by preferencesDataStore(name = "session")

/** Cifra con una clave AES-GCM guardada en Android Keystore (nunca sale del dispositivo). */
class KeystoreCrypto {
    private val alias = "eventshare_session_key"

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    fun encrypt(plain: String): String {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, key())
        val out = c.iv + c.doFinal(plain.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    fun decrypt(encoded: String): String? = try {
        val all = Base64.decode(encoded, Base64.NO_WRAP)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, all.copyOfRange(0, 12)))
        String(c.doFinal(all.copyOfRange(12, all.size)), Charsets.UTF_8)
    } catch (e: Exception) {
        null
    }
}

/** Sesión del administrador: tokens cifrados en DataStore + copia en memoria para el interceptor de OkHttp. */
class SessionStore(private val context: Context) {
    private val crypto = KeystoreCrypto()
    private val kAccess = stringPreferencesKey("access")
    private val kRefresh = stringPreferencesKey("refresh")
    private val kUser = stringPreferencesKey("user")

    @Volatile var accessToken: String? = null
        private set
    @Volatile var refreshToken: String? = null
        private set

    private val _user = MutableStateFlow<UserDto?>(null)
    val user: StateFlow<UserDto?> = _user.asStateFlow()

    suspend fun load() {
        val p = context.sessionDataStore.data.first()
        accessToken = p[kAccess]?.let(crypto::decrypt)
        refreshToken = p[kRefresh]?.let(crypto::decrypt)
        val u = p[kUser]?.let { runCatching { AppJson.decodeFromString<UserDto>(it) }.getOrNull() }
        _user.value = if (refreshToken != null) u else null
    }

    suspend fun save(auth: AuthResponse) {
        accessToken = auth.accessToken
        refreshToken = auth.refreshToken
        context.sessionDataStore.edit {
            it[kAccess] = crypto.encrypt(auth.accessToken)
            it[kRefresh] = crypto.encrypt(auth.refreshToken)
            it[kUser] = AppJson.encodeToString(UserDto.serializer(), auth.user)
        }
        _user.value = auth.user
    }

    suspend fun clear() {
        accessToken = null
        refreshToken = null
        context.sessionDataStore.edit { it.clear() }
        _user.value = null
    }
}
