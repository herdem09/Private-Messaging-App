package com.serverchat.app.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.serverchat.app.data.local.PreferencesManager
import com.serverchat.app.data.model.ConnectionRequest
import com.serverchat.app.data.model.Server
import com.serverchat.app.data.repository.ServerRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ServerListViewModel(application: Application) : AndroidViewModel(application) {
    
    private val preferencesManager = PreferencesManager(application)
    private val repository = ServerRepository(preferencesManager)
    
    private val _uiState = MutableStateFlow(ServerListUiState())
    val uiState: StateFlow<ServerListUiState> = _uiState.asStateFlow()
    
    fun loadServers() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            
            // Combine saved servers and available servers
            val savedServers = repository.getSavedServers()
            
            repository.getAvailableServers().collect { result ->
                result.fold(
                    onSuccess = { availableServers ->
                        val allServers = (savedServers + availableServers).distinctBy { it.id }
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            servers = allServers,
                            errorMessage = null
                        )
                    },
                    onFailure = { exception ->
                        // If network fails, show only saved servers
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            servers = savedServers,
                            errorMessage = if (savedServers.isEmpty()) 
                                exception.message ?: "Sunucular yüklenemedi"
                            else null
                        )
                    }
                )
            }
        }
    }
    
    fun connectToServer(server: Server, username: String, password: String?) {
        viewModelScope.launch {
            // Check if device is banned
            if (preferencesManager.isBanned(server.id)) {
                val banExpiry = preferencesManager.getBanExpiry(server.id)
                val remainingTime = (banExpiry - System.currentTimeMillis()) / 1000 / 60 // minutes
                _uiState.value = _uiState.value.copy(
                    isConnecting = false,
                    errorMessage = "Bu cihaz ${remainingTime} dakika daha banlandı"
                )
                return@launch
            }
            
            _uiState.value = _uiState.value.copy(isConnecting = true, errorMessage = null)
            
            val request = ConnectionRequest(
                username = username,
                password = password,
                deviceId = preferencesManager.getDeviceId()
            )
            
            repository.connectToServer(server, request).collect { result ->
                result.fold(
                    onSuccess = { response ->
                        preferencesManager.clearFailedAttempts(server.id)
                        preferencesManager.saveUsername(username)
                        
                        _uiState.value = _uiState.value.copy(
                            isConnecting = false,
                            connectionSuccess = true,
                            userId = response.userId,
                            token = response.token,
                            errorMessage = null
                        )
                    },
                    onFailure = { exception ->
                        val errorMessage = exception.message ?: "Bağlantı hatası"
                        
                        // Handle specific errors
                        when {
                            errorMessage.contains("wrong password", ignoreCase = true) ||
                            errorMessage.contains("yanlış şifre", ignoreCase = true) -> {
                                val attempts = preferencesManager.incrementFailedAttempts(server.id)
                                if (attempts >= 5) {
                                    // Ban for 30 minutes
                                    val banExpiry = System.currentTimeMillis() + (30 * 60 * 1000)
                                    preferencesManager.setBanExpiry(server.id, banExpiry)
                                    _uiState.value = _uiState.value.copy(
                                        isConnecting = false,
                                        errorMessage = "Çok fazla yanlış deneme. 30 dakika banlandınız."
                                    )
                                } else {
                                    _uiState.value = _uiState.value.copy(
                                        isConnecting = false,
                                        errorMessage = "Yanlış şifre. Kalan deneme: ${5 - attempts}"
                                    )
                                }
                            }
                            errorMessage.contains("banned", ignoreCase = true) ||
                            errorMessage.contains("banlandı", ignoreCase = true) -> {
                                _uiState.value = _uiState.value.copy(
                                    isConnecting = false,
                                    errorMessage = "Bu cihaz sunucudan banlandı"
                                )
                            }
                            else -> {
                                _uiState.value = _uiState.value.copy(
                                    isConnecting = false,
                                    errorMessage = errorMessage
                                )
                            }
                        }
                    }
                )
            }
        }
    }
}

data class ServerListUiState(
    val isLoading: Boolean = false,
    val isConnecting: Boolean = false,
    val servers: List<Server> = emptyList(),
    val connectionSuccess: Boolean = false,
    val userId: String? = null,
    val token: String? = null,
    val errorMessage: String? = null
)