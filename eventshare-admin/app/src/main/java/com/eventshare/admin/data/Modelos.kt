package com.eventshare.admin.data

import kotlinx.serialization.Serializable

@Serializable
data class UserDto(
    val id: String,
    val name: String,
    val email: String? = null,
    val role: String,
    val avatarUrl: String? = null,
)

@Serializable
data class AuthResponse(val accessToken: String, val refreshToken: String, val expiresIn: Int, val user: UserDto)

@Serializable data class LoginRequest(val email: String, val password: String)
@Serializable data class RegisterRequest(val name: String, val email: String, val password: String)
@Serializable data class RefreshRequest(val refreshToken: String)

@Serializable
data class EventDto(
    val id: String,
    val code: String,
    val name: String,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val primaryColor: String = "#1F2937",
    val eventDate: String? = null,
    val status: String = "ACTIVE",
    val moderationEnabled: Boolean = true,
    val url: String,
)

/** Evento con contadores (GET /admin/events). */
@Serializable
data class EventSummaryDto(
    val id: String,
    val code: String,
    val name: String,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val primaryColor: String = "#1F2937",
    val eventDate: String? = null,
    val status: String = "ACTIVE",
    val moderationEnabled: Boolean = true,
    val url: String,
    val photosCount: Int = 0,
    val pendingCount: Int = 0,
    val guestsCount: Int = 0,
)

@Serializable data class EventListResponse(val items: List<EventSummaryDto>)
@Serializable data class EventResponse(val event: EventDto)

@Serializable
data class EventStatsDto(
    val photos: Int = 0,
    val messages: Int = 0,
    val pending: Int = 0,
    val rejected: Int = 0,
    val comments: Int = 0,
    val likes: Int = 0,
    val guests: Int = 0,
    val blocked: Int = 0,
)

@Serializable data class EventDetailResponse(val event: EventDto, val stats: EventStatsDto)

@Serializable
data class DashboardStats(
    val events: Int = 0,
    val activeEvents: Int = 0,
    val photos: Int = 0,
    val messages: Int = 0,
    val guests: Int = 0,
    val pending: Int = 0,
)

/** Cuerpo de POST /events y PATCH /events/:id. Los null se omiten (= sin cambios). */
@Serializable
data class EventRequest(
    val name: String? = null,
    val description: String? = null,
    val eventDate: String? = null,
    val primaryColor: String? = null,
    val moderationEnabled: Boolean? = null,
    val coverKey: String? = null,
    val status: String? = null,
)

@Serializable data class UploadRequest(val contentType: String, val size: Long)
@Serializable data class UploadResponse(val uploadUrl: String, val key: String, val publicUrl: String, val fields: Map<String, String>)

@Serializable data class AuthorDto(val id: String, val name: String, val avatarUrl: String? = null)

@Serializable
data class PostDto(
    val id: String,
    val eventId: String,
    val photoUrl: String? = null,
    val message: String? = null,
    val status: String,
    val likesCount: Int = 0,
    val commentsCount: Int = 0,
    val createdAt: String,
    val author: AuthorDto,
)

@Serializable data class PostPage(val items: List<PostDto>, val nextCursor: String? = null)

@Serializable
data class CommentDto(
    val id: String,
    val postId: String,
    val message: String,
    val createdAt: String,
    val author: AuthorDto,
)

@Serializable data class CommentPage(val items: List<CommentDto>, val nextCursor: String? = null)

@Serializable
data class MemberDto(
    val id: String,
    val name: String,
    val avatarUrl: String? = null,
    val joinedAt: String,
    val isBlocked: Boolean = false,
    val postsCount: Int = 0,
)

@Serializable data class MembersResponse(val items: List<MemberDto>)
@Serializable data class BlockRequest(val isBlocked: Boolean)
@Serializable data class BlockResponse(val userId: String, val isBlocked: Boolean)
@Serializable data class ModerationRequest(val status: String)
@Serializable data class ModerationResponse(val id: String, val status: String)
@Serializable data class DeletedResponse(val deleted: Boolean = true)
@Serializable data class OkResponse(val ok: Boolean = true)

@Serializable data class ErrorBody(val code: String? = null, val message: String? = null)
@Serializable data class ErrorEnvelope(val error: ErrorBody? = null)
