package com.serverchat.app.data.model

data class ConnectionRequest(
    val username: String,
    val password: String? = null,
    val deviceId: String
)

data class ConnectionResponse(
    val success: Boolean,
    val message: String,
    val userId: String? = null,
    val token: String? = null,
    val banExpiry: Long? = null
)

data class ServerRegistrationRequest(
    val name: String,
    val ipAddress: String,
    val port: Int,
    val password: String? = null,
    val maxUsers: Int = 100
)

data class ServerRegistrationResponse(
    val success: Boolean,
    val message: String,
    val serverId: String? = null
)