package com.eventshare.admin.data

import android.content.Context
import com.eventshare.admin.BuildConfig
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import retrofit2.HttpException
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Renueva el access token con el refresh token cuando la API responde 401. */
class TokenAuthenticator(
    private val session: SessionStore,
    private val refreshApi: EventShareApi,
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.request.header("X-Auth-Retry") != null) return null
        if (response.request.url.encodedPath.contains("/auth/")) return null

        return synchronized(this) {
            val sent = response.request.header("Authorization")?.removePrefix("Bearer ")
            val current = session.accessToken
            // Otro hilo ya renovó el token mientras esperábamos.
            if (current != null && current != sent) return@synchronized retry(response, current)

            val refresh = session.refreshToken ?: return@synchronized null
            try {
                val auth = runBlocking { refreshApi.refresh(RefreshRequest(refresh)) }
                runBlocking { session.save(auth) }
                retry(response, auth.accessToken)
            } catch (e: HttpException) {
                if (e.code() == 401) runBlocking { session.clear() }
                null
            } catch (e: IOException) {
                null
            }
        }
    }

    private fun retry(response: Response, token: String): Request =
        response.request.newBuilder()
            .header("Authorization", "Bearer $token")
            .header("X-Auth-Retry", "1")
            .build()
}

class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    val session = SessionStore(appContext)

    /** Cliente sin credenciales: sirve para renovar tokens y para subir a URLs prefirmadas del storage. */
    val plainClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private val refreshApi = ApiFactory.create(BuildConfig.API_BASE_URL, plainClient)

    private val authClient: OkHttpClient = plainClient.newBuilder()
        .addInterceptor { chain ->
            val token = session.accessToken
            val req = if (token != null) chain.request().newBuilder().header("Authorization", "Bearer $token").build() else chain.request()
            chain.proceed(req)
        }
        .authenticator(TokenAuthenticator(session, refreshApi))
        .build()

    val api: EventShareApi = ApiFactory.create(BuildConfig.API_BASE_URL, authClient)
    val repository = Repository(appContext, api, session, plainClient)
}
