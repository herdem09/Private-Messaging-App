package com.serverchat.app.security

import android.content.Context
import android.provider.Settings
import java.security.MessageDigest
import java.util.regex.Pattern

object SecurityUtils {
    
    private val IP_PATTERN = Pattern.compile(
        "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
    )
    
    private val USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_]{3,20}$")
    
    fun isValidIpAddress(ip: String): Boolean {
        return IP_PATTERN.matcher(ip).matches()
    }
    
    fun isValidPort(port: String): Boolean {
        return try {
            val portNum = port.toInt()
            portNum in 1..65535
        } catch (e: NumberFormatException) {
            false
        }
    }
    
    fun isValidUsername(username: String): Boolean {
        return USERNAME_PATTERN.matcher(username).matches()
    }
    
    fun isValidServerName(name: String): Boolean {
        return name.isNotBlank() && 
               name.length in 3..50 && 
               name.all { it.isLetterOrDigit() || it.isWhitespace() || it in "-_" }
    }
    
    fun sanitizeInput(input: String): String {
        return input.trim()
            .replace(Regex("[<>\"'&]"), "") // Remove potentially dangerous characters
            .take(500) // Limit length
    }
    
    fun generateDeviceId(context: Context): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        return hashString(androidId ?: "unknown_device")
    }
    
    fun hashString(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
    
    fun validatePassword(password: String?): ValidationResult {
        if (password.isNullOrBlank()) {
            return ValidationResult.Valid
        }
        
        return when {
            password.length < 4 -> ValidationResult.Invalid("Şifre en az 4 karakter olmalıdır")
            password.length > 50 -> ValidationResult.Invalid("Şifre en fazla 50 karakter olabilir")
            else -> ValidationResult.Valid
        }
    }
    
    fun rateLimit(key: String, maxRequests: Int, windowMs: Long): Boolean {
        // Simple rate limiting implementation
        // In a real app, you might want to use a more sophisticated approach
        val currentTime = System.currentTimeMillis()
        val requests = rateLimitMap.getOrPut(key) { mutableListOf() }
        
        // Remove old requests
        requests.removeAll { currentTime - it > windowMs }
        
        return if (requests.size < maxRequests) {
            requests.add(currentTime)
            true
        } else {
            false
        }
    }
    
    private val rateLimitMap = mutableMapOf<String, MutableList<Long>>()
}

sealed class ValidationResult {
    object Valid : ValidationResult()
    data class Invalid(val message: String) : ValidationResult()
}