package com.serverchat.app.data.local

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.serverchat.app.data.model.Server
import java.util.*

class PreferencesManager(context: Context) {
    
    private val sharedPreferences: SharedPreferences = 
        context.getSharedPreferences("serverchat_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()
    
    companion object {
        private const val KEY_SAVED_SERVERS = "saved_servers"
        private const val KEY_CURRENT_SERVER = "current_server"
        private const val KEY_CURRENT_USER_ID = "current_user_id"
        private const val KEY_CURRENT_TOKEN = "current_token"
        private const val KEY_USERNAME = "username"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_FAILED_ATTEMPTS = "failed_attempts"
        private const val KEY_BAN_EXPIRY = "ban_expiry"
    }
    
    fun saveServer(server: Server) {
        val savedServers = getSavedServers().toMutableList()
        val existingIndex = savedServers.indexOfFirst { it.id == server.id }
        
        if (existingIndex != -1) {
            savedServers[existingIndex] = server
        } else {
            savedServers.add(server)
        }
        
        val json = gson.toJson(savedServers)
        sharedPreferences.edit()
            .putString(KEY_SAVED_SERVERS, json)
            .apply()
    }
    
    fun getSavedServers(): List<Server> {
        val json = sharedPreferences.getString(KEY_SAVED_SERVERS, null)
        return if (json != null) {
            val type = object : TypeToken<List<Server>>() {}.type
            gson.fromJson(json, type)
        } else {
            emptyList()
        }
    }
    
    fun removeServer(serverId: String) {
        val savedServers = getSavedServers().toMutableList()
        savedServers.removeAll { it.id == serverId }
        
        val json = gson.toJson(savedServers)
        sharedPreferences.edit()
            .putString(KEY_SAVED_SERVERS, json)
            .apply()
    }
    
    fun saveCurrentConnection(server: Server, userId: String, token: String) {
        sharedPreferences.edit()
            .putString(KEY_CURRENT_SERVER, gson.toJson(server))
            .putString(KEY_CURRENT_USER_ID, userId)
            .putString(KEY_CURRENT_TOKEN, token)
            .apply()
    }
    
    fun getCurrentConnection(): Triple<Server?, String?, String?>? {
        val serverJson = sharedPreferences.getString(KEY_CURRENT_SERVER, null)
        val userId = sharedPreferences.getString(KEY_CURRENT_USER_ID, null)
        val token = sharedPreferences.getString(KEY_CURRENT_TOKEN, null)
        
        return if (serverJson != null && userId != null && token != null) {
            val server = gson.fromJson(serverJson, Server::class.java)
            Triple(server, userId, token)
        } else {
            null
        }
    }
    
    fun clearCurrentConnection() {
        sharedPreferences.edit()
            .remove(KEY_CURRENT_SERVER)
            .remove(KEY_CURRENT_USER_ID)
            .remove(KEY_CURRENT_TOKEN)
            .apply()
    }
    
    fun saveUsername(username: String) {
        sharedPreferences.edit()
            .putString(KEY_USERNAME, username)
            .apply()
    }
    
    fun getUsername(): String? {
        return sharedPreferences.getString(KEY_USERNAME, null)
    }
    
    fun getDeviceId(): String {
        var deviceId = sharedPreferences.getString(KEY_DEVICE_ID, null)
        if (deviceId == null) {
            deviceId = UUID.randomUUID().toString()
            sharedPreferences.edit()
                .putString(KEY_DEVICE_ID, deviceId)
                .apply()
        }
        return deviceId
    }
    
    fun incrementFailedAttempts(serverId: String): Int {
        val key = "${KEY_FAILED_ATTEMPTS}_$serverId"
        val attempts = sharedPreferences.getInt(key, 0) + 1
        sharedPreferences.edit()
            .putInt(key, attempts)
            .apply()
        return attempts
    }
    
    fun clearFailedAttempts(serverId: String) {
        val key = "${KEY_FAILED_ATTEMPTS}_$serverId"
        sharedPreferences.edit()
            .remove(key)
            .apply()
    }
    
    fun getFailedAttempts(serverId: String): Int {
        val key = "${KEY_FAILED_ATTEMPTS}_$serverId"
        return sharedPreferences.getInt(key, 0)
    }
    
    fun setBanExpiry(serverId: String, expiry: Long) {
        val key = "${KEY_BAN_EXPIRY}_$serverId"
        sharedPreferences.edit()
            .putLong(key, expiry)
            .apply()
    }
    
    fun getBanExpiry(serverId: String): Long {
        val key = "${KEY_BAN_EXPIRY}_$serverId"
        return sharedPreferences.getLong(key, 0)
    }
    
    fun isBanned(serverId: String): Boolean {
        val expiry = getBanExpiry(serverId)
        return expiry > System.currentTimeMillis()
    }
}