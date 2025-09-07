package com.serverchat.app.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.serverchat.app.data.local.PreferencesManager
import com.serverchat.app.data.model.Message
import com.serverchat.app.data.model.Server
import com.serverchat.app.data.model.User
import com.serverchat.app.network.ChatWebSocketClient
import com.serverchat.app.network.ConnectionState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.net.URI

class ChatViewModel(application: Application) : AndroidViewModel(application) {
    
    private val preferencesManager = PreferencesManager(application)
    
    private var webSocketClient: ChatWebSocketClient? = null
    private var currentServer: Server? = null
    private var currentUserId: String? = null
    private var currentUsername: String? = null
    
    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()
    
    fun connectToServer(server: Server, userId: String, token: String) {
        viewModelScope.launch {
            try {
                currentServer = server
                currentUserId = userId
                currentUsername = preferencesManager.getUsername() ?: "Kullanıcı"
                
                val wsUri = URI("ws://${server.ipAddress}:${server.port}/ws")
                webSocketClient = ChatWebSocketClient(wsUri, token)
                
                // Collect WebSocket states
                launch {
                    webSocketClient?.connectionState?.collect { state ->
                        _uiState.value = _uiState.value.copy(connectionState = state)
                    }
                }
                
                launch {
                    webSocketClient?.messages?.collect { messages ->
                        _uiState.value = _uiState.value.copy(messages = messages)
                    }
                }
                
                launch {
                    webSocketClient?.onlineUsers?.collect { users ->
                        _uiState.value = _uiState.value.copy(onlineUsers = users)
                    }
                }
                
                webSocketClient?.connect()
                
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    connectionState = ConnectionState.ERROR,
                    errorMessage = "Bağlantı hatası: ${e.message}"
                )
            }
        }
    }
    
    fun sendMessage(content: String) {
        val userId = currentUserId ?: return
        val username = currentUsername ?: return
        
        webSocketClient?.sendMessage(content, userId, username)
    }
    
    fun disconnect() {
        webSocketClient?.disconnect()
        currentServer?.let { server ->
            preferencesManager.clearCurrentConnection()
        }
    }
    
    override fun onCleared() {
        super.onCleared()
        disconnect()
    }
}

data class ChatUiState(
    val connectionState: ConnectionState = ConnectionState.DISCONNECTED,
    val messages: List<Message> = emptyList(),
    val onlineUsers: List<User> = emptyList(),
    val errorMessage: String? = null
)