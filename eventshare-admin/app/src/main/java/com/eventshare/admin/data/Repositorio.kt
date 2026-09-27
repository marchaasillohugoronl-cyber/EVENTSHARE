package com.eventshare.admin.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.ByteArrayOutputStream
import java.io.IOException

class ApiException(message: String) : Exception(message)

class Repository(
    private val context: Context,
    private val api: EventShareApi,
    val session: SessionStore,
    private val plainClient: OkHttpClient,
) {
    private suspend fun <T> call(block: suspend () -> T): Result<T> = try {
        Result.success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: HttpException) {
        val msg = runCatching {
            AppJson.decodeFromString<ErrorEnvelope>(e.response()?.errorBody()?.string().orEmpty()).error?.message
        }.getOrNull()
        Result.failure(ApiException(msg ?: "Error del servidor (${e.code()})"))
    } catch (e: IOException) {
        Result.failure(ApiException("Sin conexión con el servidor. Revisa tu internet."))
    } catch (e: Exception) {
        Result.failure(ApiException(e.message ?: "Ocurrió un error inesperado"))
    }

    // --- Auth ---
    suspend fun login(email: String, password: String) = call {
        api.login(LoginRequest(email.trim(), password)).also { session.save(it) }.user
    }

    suspend fun register(name: String, email: String, password: String) = call {
        api.register(RegisterRequest(name.trim(), email.trim(), password)).also { session.save(it) }.user
    }

    suspend fun logout() {
        session.refreshToken?.let { runCatching { api.logout(RefreshRequest(it)) } }
        session.clear()
    }

    // --- Dashboard / eventos ---
    suspend fun stats() = call { api.stats() }
    suspend fun events() = call { api.events().items }
    suspend fun eventDetail(id: String) = call { api.eventDetail(id) }
    suspend fun createEvent(req: EventRequest) = call { api.createEvent(req).event }
    suspend fun updateEvent(id: String, req: EventRequest) = call { api.updateEvent(id, req).event }
    suspend fun setEventStatus(id: String, status: String) = call { api.updateEvent(id, EventRequest(status = status)).event }

    // --- Publicaciones ---
    suspend fun posts(eventId: String, status: String?, hasMessage: Boolean, cursor: String?) =
        call { api.posts(eventId, status, if (hasMessage) "1" else null, cursor, 20) }

    suspend fun comments(eventId: String, cursor: String?) = call { api.comments(eventId, cursor, 30) }
    suspend fun moderate(postId: String, status: String) = call { api.moderate(postId, ModerationRequest(status)) }
    suspend fun deletePost(postId: String) = call { api.deletePost(postId) }
    suspend fun deleteComment(commentId: String) = call { api.deleteComment(commentId) }

    // --- Invitados ---
    suspend fun members(eventId: String) = call { api.members(eventId).items }
    suspend fun setBlocked(eventId: String, userId: String, blocked: Boolean) = call { api.setBlocked(eventId, userId, BlockRequest(blocked)) }

    /** Sube la portada al storage con URL prefirmada y devuelve la clave (`coverKey`). */
    suspend fun uploadCover(uri: Uri): Result<String> = call {
        withContext(Dispatchers.IO) {
            val (bytes, mime) = readAndShrink(uri)
            val presign = api.coverUpload(UploadRequest(mime, bytes.size.toLong()))
            val form = MultipartBody.Builder().setType(MultipartBody.FORM)
            presign.fields.forEach { (key, value) -> form.addFormDataPart(key, value) }
            form.addFormDataPart("file", "portada", bytes.toRequestBody(mime.toMediaType()))
            val req = Request.Builder().url(presign.uploadUrl).post(form.build()).build()
            plainClient.newCall(req).execute().use { res ->
                if (!res.isSuccessful) throw ApiException("No se pudo subir la imagen (${res.code})")
            }
            presign.key
        }
    }

    private fun readAndShrink(uri: Uri): Pair<ByteArray, String> {
        val allowed = setOf("image/jpeg", "image/png", "image/webp")
        val resolver = context.contentResolver
        val mime = resolver.getType(uri)
        val original = resolver.openInputStream(uri)?.use { it.readBytes() } ?: throw ApiException("No se pudo leer la imagen")
        if (mime in allowed && original.size <= 4 * 1024 * 1024) return original to mime!!

        // Reduce a JPEG (lado máx. 2000 px) para respetar el límite de 10 MB.
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(original, 0, original.size, bounds)
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 2000) sample *= 2
        val bmp = BitmapFactory.decodeByteArray(original, 0, original.size, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: throw ApiException("Formato de imagen no compatible")
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, 85, out)
        bmp.recycle()
        return out.toByteArray() to "image/jpeg"
    }
}
