package com.serverchat.app.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class User(
    val id: String = "",
    val username: String,
    val ipAddress: String = "",
    val isOnline: Boolean = false,
    val isBanned: Boolean = false,
    val joinedAt: Long = System.currentTimeMillis()
) : Parcelable