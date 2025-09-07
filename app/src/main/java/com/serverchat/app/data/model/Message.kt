package com.serverchat.app.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Message(
    val id: String = "",
    val content: String,
    val senderId: String,
    val senderName: String,
    val serverId: String,
    val timestamp: Long = System.currentTimeMillis(),
    val messageType: MessageType = MessageType.TEXT
) : Parcelable

enum class MessageType {
    TEXT,
    SYSTEM,
    JOIN,
    LEAVE
}