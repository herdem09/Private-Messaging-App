package com.serverchat.app.security

import com.serverchat.app.data.local.PreferencesManager
import java.util.concurrent.ConcurrentHashMap

class BanManager(private val preferencesManager: PreferencesManager) {
    
    companion object {
        private const val MAX_ATTEMPTS = 5
        private const val BAN_DURATION_MINUTES = 30
        private const val SPAM_THRESHOLD = 10 // messages per minute
        private const val SPAM_BAN_DURATION_MINUTES = 60
    }
    
    private val attemptCounts = ConcurrentHashMap<String, Int>()
    private val lastAttemptTimes = ConcurrentHashMap<String, Long>()
    private val messageHistory = ConcurrentHashMap<String, MutableList<Long>>()
    
    fun recordFailedAttempt(serverId: String, deviceId: String): BanResult {
        val key = "${serverId}_$deviceId"
        val currentTime = System.currentTimeMillis()
        
        // Reset attempts if more than 1 hour has passed
        val lastAttemptTime = lastAttemptTimes[key] ?: 0
        if (currentTime - lastAttemptTime > 60 * 60 * 1000) {
            attemptCounts[key] = 0
        }
        
        val attempts = (attemptCounts[key] ?: 0) + 1
        attemptCounts[key] = attempts
        lastAttemptTimes[key] = currentTime
        
        return when {
            attempts >= MAX_ATTEMPTS -> {
                val banExpiry = currentTime + (BAN_DURATION_MINUTES * 60 * 1000)
                preferencesManager.setBanExpiry(serverId, banExpiry)
                BanResult.Banned(BAN_DURATION_MINUTES, "Çok fazla yanlış deneme")
            }
            attempts >= 3 -> {
                BanResult.Warning(MAX_ATTEMPTS - attempts, "Dikkat: ${MAX_ATTEMPTS - attempts} deneme hakkınız kaldı")
            }
            else -> {
                BanResult.Safe
            }
        }
    }
    
    fun clearFailedAttempts(serverId: String, deviceId: String) {
        val key = "${serverId}_$deviceId"
        attemptCounts.remove(key)
        lastAttemptTimes.remove(key)
        preferencesManager.clearFailedAttempts(serverId)
    }
    
    fun checkSpamming(serverId: String, userId: String): BanResult {
        val key = "${serverId}_$userId"
        val currentTime = System.currentTimeMillis()
        val oneMinuteAgo = currentTime - 60 * 1000
        
        val messages = messageHistory.getOrPut(key) { mutableListOf() }
        
        // Remove old messages (older than 1 minute)
        messages.removeAll { it < oneMinuteAgo }
        
        // Add current message
        messages.add(currentTime)
        
        return if (messages.size > SPAM_THRESHOLD) {
            val banExpiry = currentTime + (SPAM_BAN_DURATION_MINUTES * 60 * 1000)
            preferencesManager.setBanExpiry(serverId, banExpiry)
            BanResult.Banned(SPAM_BAN_DURATION_MINUTES, "Spam nedeniyle banlandınız")
        } else {
            BanResult.Safe
        }
    }
    
    fun isBanned(serverId: String): BanResult {
        val banExpiry = preferencesManager.getBanExpiry(serverId)
        val currentTime = System.currentTimeMillis()
        
        return if (banExpiry > currentTime) {
            val remainingMinutes = (banExpiry - currentTime) / 1000 / 60
            BanResult.Banned(remainingMinutes.toInt(), "Bu cihaz banlandı")
        } else {
            BanResult.Safe
        }
    }
    
    fun getRemainingBanTime(serverId: String): Long {
        val banExpiry = preferencesManager.getBanExpiry(serverId)
        val currentTime = System.currentTimeMillis()
        return maxOf(0, banExpiry - currentTime)
    }
    
    fun unban(serverId: String) {
        preferencesManager.setBanExpiry(serverId, 0)
        attemptCounts.clear()
        lastAttemptTimes.clear()
        messageHistory.clear()
    }
}

sealed class BanResult {
    object Safe : BanResult()
    data class Warning(val remainingAttempts: Int, val message: String) : BanResult()
    data class Banned(val durationMinutes: Int, val reason: String) : BanResult()
}