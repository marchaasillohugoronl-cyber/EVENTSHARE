package com.eventshare.admin.data

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

val AppJson = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
}

interface EventShareApi {
    // --- Auth ---
    @POST("auth/login") suspend fun login(@Body body: LoginRequest): AuthResponse
    @POST("auth/register") suspend fun register(@Body body: RegisterRequest): AuthResponse
    @POST("auth/refresh") suspend fun refresh(@Body body: RefreshRequest): AuthResponse
    @POST("auth/logout") suspend fun logout(@Body body: RefreshRequest): OkResponse

    // --- Dashboard / eventos ---
    @GET("admin/stats") suspend fun stats(): DashboardStats
    @GET("admin/events") suspend fun events(): EventListResponse
    @GET("admin/events/{id}") suspend fun eventDetail(@Path("id") id: String): EventDetailResponse
    @POST("events") suspend fun createEvent(@Body body: EventRequest): EventResponse
    @PATCH("events/{id}") suspend fun updateEvent(@Path("id") id: String, @Body body: EventRequest): EventResponse
    @POST("admin/uploads/cover") suspend fun coverUpload(@Body body: UploadRequest): UploadResponse

    // --- Publicaciones / moderación ---
    @GET("admin/events/{id}/posts")
    suspend fun posts(
        @Path("id") id: String,
        @Query("status") status: String? = null,
        @Query("hasMessage") hasMessage: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
    ): PostPage

    @GET("admin/events/{id}/comments")
    suspend fun comments(
        @Path("id") id: String,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
    ): CommentPage

    @PATCH("posts/{id}/moderation") suspend fun moderate(@Path("id") id: String, @Body body: ModerationRequest): ModerationResponse
    @DELETE("posts/{id}") suspend fun deletePost(@Path("id") id: String): DeletedResponse
    @DELETE("comments/{id}") suspend fun deleteComment(@Path("id") id: String): DeletedResponse

    // --- Invitados ---
    @GET("admin/events/{id}/members") suspend fun members(@Path("id") id: String): MembersResponse
    @PATCH("admin/events/{id}/members/{userId}")
    suspend fun setBlocked(@Path("id") id: String, @Path("userId") userId: String, @Body body: BlockRequest): BlockResponse
}

object ApiFactory {
    fun create(baseUrl: String, client: OkHttpClient): EventShareApi =
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(AppJson.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(EventShareApi::class.java)
}
