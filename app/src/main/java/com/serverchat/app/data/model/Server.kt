package com.serverchat.app.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Server(
    val id: String = "",
    val name: String,
    val ipAddress: String,
    val port: Int = 8080,
    val hasPassword: Boolean = false,
    val isOnline: Boolean = false,
    val userCount: Int = 0,
    val maxUsers: Int = 100,
    val createdAt: Long = System.currentTimeMillis()
) : Parcelable