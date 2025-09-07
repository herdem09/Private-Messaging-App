package com.serverchat.app.data.repository

import com.serverchat.app.data.local.PreferencesManager
import com.serverchat.app.data.model.*
import com.serverchat.app.network.RetrofitClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import retrofit2.Response

class ServerRepository(
    private val preferencesManager: PreferencesManager
) {
    
    private val apiService = RetrofitClient.apiService
    
    suspend fun registerServer(request: ServerRegistrationRequest): Flow<Result<ServerRegistrationResponse>> = flow {
        try {
            val response = apiService.registerServer(request)
            if (response.isSuccessful) {
                response.body()?.let { serverResponse ->
                    if (serverResponse.success) {
                        // Save server locally
                        val server = Server(
                            id = serverResponse.serverId ?: "",
                            name = request.name,
                            ipAddress = request.ipAddress,
                            port = request.port,
                            hasPassword = !request.password.isNullOrEmpty()
                        )
                        preferencesManager.saveServer(server)
                        emit(Result.success(serverResponse))
                    } else {
                        emit(Result.failure(Exception(serverResponse.message)))
                    }
                } ?: emit(Result.failure(Exception("Boş yanıt")))
            } else {
                emit(Result.failure(Exception("Sunucu hatası: ${response.code()}")))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
    
    suspend fun connectToServer(server: Server, request: ConnectionRequest): Flow<Result<ConnectionResponse>> = flow {
        try {
            // Dinamik server API'si oluştur
            val serverApiService = RetrofitClient.createApiServiceForServer("http://${server.ipAddress}:${server.port}/api/")
            val response = serverApiService.connectToServer(server.id, request)
            
            if (response.isSuccessful) {
                response.body()?.let { connectionResponse ->
                    if (connectionResponse.success) {
                        // Save connection info
                        preferencesManager.saveCurrentConnection(server, connectionResponse.userId ?: "", connectionResponse.token ?: "")
                        emit(Result.success(connectionResponse))
                    } else {
                        emit(Result.failure(Exception(connectionResponse.message)))
                    }
                } ?: emit(Result.failure(Exception("Boş yanıt")))
            } else {
                emit(Result.failure(Exception("Bağlantı hatası: ${response.code()}")))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
    
    suspend fun getAvailableServers(): Flow<Result<List<Server>>> = flow {
        try {
            val response = apiService.getAvailableServers()
            if (response.isSuccessful) {
                response.body()?.let { servers ->
                    emit(Result.success(servers))
                } ?: emit(Result.failure(Exception("Boş yanıt")))
            } else {
                emit(Result.failure(Exception("Sunucu hatası: ${response.code()}")))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
    
    fun getSavedServers(): List<Server> {
        return preferencesManager.getSavedServers()
    }
    
    fun getCurrentConnection(): Triple<Server?, String?, String?>? {
        return preferencesManager.getCurrentConnection()
    }
    
    fun clearCurrentConnection() {
        preferencesManager.clearCurrentConnection()
    }
    
    fun removeServer(serverId: String) {
        preferencesManager.removeServer(serverId)
    }
    
    suspend fun getServerInfo(server: Server): Flow<Result<Server>> = flow {
        try {
            val serverApiService = RetrofitClient.createApiServiceForServer("http://${server.ipAddress}:${server.port}/api/")
            val response = serverApiService.getServerInfo(server.id)
            
            if (response.isSuccessful) {
                response.body()?.let { serverInfo ->
                    emit(Result.success(serverInfo))
                } ?: emit(Result.failure(Exception("Boş yanıt")))
            } else {
                emit(Result.failure(Exception("Sunucu bilgisi alınamadı: ${response.code()}")))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
}