package com.serverchat.app.network

import com.serverchat.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    
    @POST("servers/register")
    suspend fun registerServer(
        @Body request: ServerRegistrationRequest
    ): Response<ServerRegistrationResponse>
    
    @POST("servers/{serverId}/connect")
    suspend fun connectToServer(
        @Path("serverId") serverId: String,
        @Body request: ConnectionRequest
    ): Response<ConnectionResponse>
    
    @GET("servers")
    suspend fun getAvailableServers(): Response<List<Server>>
    
    @GET("servers/{serverId}/info")
    suspend fun getServerInfo(
        @Path("serverId") serverId: String
    ): Response<Server>
    
    @POST("servers/{serverId}/disconnect")
    suspend fun disconnectFromServer(
        @Path("serverId") serverId: String,
        @Header("Authorization") token: String
    ): Response<Unit>
    
    @GET("servers/{serverId}/messages")
    suspend fun getMessages(
        @Path("serverId") serverId: String,
        @Header("Authorization") token: String,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0
    ): Response<List<Message>>
    
    @POST("servers/{serverId}/ban")
    suspend fun banUser(
        @Path("serverId") serverId: String,
        @Header("Authorization") token: String,
        @Body banRequest: BanRequest
    ): Response<Unit>
    
    @DELETE("servers/{serverId}/ban/{userId}")
    suspend fun unbanUser(
        @Path("serverId") serverId: String,
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Response<Unit>
}

data class BanRequest(
    val userId: String,
    val reason: String,
    val duration: Long? = null // null for permanent ban
)