package com.serverchat.app.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.serverchat.app.data.local.PreferencesManager
import com.serverchat.app.data.model.ServerRegistrationRequest
import com.serverchat.app.data.repository.ServerRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ServerRegistrationViewModel(application: Application) : AndroidViewModel(application) {
    
    private val preferencesManager = PreferencesManager(application)
    private val repository = ServerRepository(preferencesManager)
    
    private val _uiState = MutableStateFlow(ServerRegistrationUiState())
    val uiState: StateFlow<ServerRegistrationUiState> = _uiState.asStateFlow()
    
    fun registerServer(name: String, ipAddress: String, port: Int, password: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            
            val request = ServerRegistrationRequest(
                name = name,
                ipAddress = ipAddress,
                port = port,
                password = password
            )
            
            repository.registerServer(request).collect { result ->
                result.fold(
                    onSuccess = { response ->
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isSuccess = true,
                            errorMessage = null
                        )
                    },
                    onFailure = { exception ->
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isSuccess = false,
                            errorMessage = exception.message ?: "Bilinmeyen hata"
                        )
                    }
                )
            }
        }
    }
}

data class ServerRegistrationUiState(
    val isLoading: Boolean = false,
    val isSuccess: Boolean = false,
    val errorMessage: String? = null
)