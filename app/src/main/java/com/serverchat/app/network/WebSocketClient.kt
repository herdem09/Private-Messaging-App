package com.serverchat.app.network

import com.google.gson.Gson
import com.serverchat.app.data.model.Message
import com.serverchat.app.data.model.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.net.URI
import java.util.concurrent.ConcurrentHashMap

class ChatWebSocketClient(
    private val serverUri: URI,
    private val token: String
) : WebSocketClient(serverUri) {

    private val gson = Gson()
    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages

    private val _onlineUsers = MutableStateFlow<List<User>>(emptyList())
    val onlineUsers: StateFlow<List<User>> = _onlineUsers

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState

    private val messageHistory = ConcurrentHashMap<String, Message>()

    override fun onOpen(handshake: ServerHandshake?) {
        _connectionState.value = ConnectionState.CONNECTED
        // Send authentication
        val authMessage = mapOf(
            "type" to "auth",
            "token" to token
        )
        send(gson.toJson(authMessage))
    }

    override fun onMessage(message: String?) {
        message?.let { msg ->
            try {
                val data = gson.fromJson(msg, Map::class.java)
                when (data["type"]) {
                    "message" -> {
                        val chatMessage = gson.fromJson(msg, Message::class.java)
                        addMessage(chatMessage)
                    }
                    "user_list" -> {
                        val users = gson.fromJson(data["users"].toString(), Array<User>::class.java)
                        _onlineUsers.value = users.toList()
                    }
                    "user_joined" -> {
                        val user = gson.fromJson(data["user"].toString(), User::class.java)
                        val currentUsers = _onlineUsers.value.toMutableList()
                        currentUsers.add(user)
                        _onlineUsers.value = currentUsers
                        
                        // Add system message
                        val systemMessage = Message(
                            content = "${user.username} sunucuya katıldı",
                            senderId = "system",
                            senderName = "Sistem",
                            serverId = "",
                            messageType = com.serverchat.app.data.model.MessageType.JOIN
                        )
                        addMessage(systemMessage)
                    }
                    "user_left" -> {
                        val userId = data["userId"].toString()
                        val username = data["username"].toString()
                        val currentUsers = _onlineUsers.value.toMutableList()
                        currentUsers.removeAll { it.id == userId }
                        _onlineUsers.value = currentUsers
                        
                        // Add system message
                        val systemMessage = Message(
                            content = "$username sunucudan ayrıldı",
                            senderId = "system",
                            senderName = "Sistem",
                            serverId = "",
                            messageType = com.serverchat.app.data.model.MessageType.LEAVE
                        )
                        addMessage(systemMessage)
                    }
                    "error" -> {
                        val errorMessage = data["message"].toString()
                        // Handle error
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun onClose(code: Int, reason: String?, remote: Boolean) {
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    override fun onError(ex: Exception?) {
        _connectionState.value = ConnectionState.ERROR
        ex?.printStackTrace()
    }

    fun sendMessage(content: String, senderId: String, senderName: String) {
        val message = mapOf(
            "type" to "message",
            "content" to content,
            "senderId" to senderId,
            "senderName" to senderName,
            "timestamp" to System.currentTimeMillis()
        )
        send(gson.toJson(message))
    }

    private fun addMessage(message: Message) {
        messageHistory[message.id] = message
        val currentMessages = _messages.value.toMutableList()
        currentMessages.add(message)
        _messages.value = currentMessages.sortedBy { it.timestamp }
    }

    fun disconnect() {
        close()
    }
}

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR
}