package com.whatsappclone.models

data class Message(
    val text: String,
    val sender: String,
    val timestamp: Long,
    val isFromMe: Boolean
) {
    fun getFormattedTime(): String {
        val calendar = java.util.Calendar.getInstance()
        calendar.timeInMillis = timestamp
        
        val hour = calendar.get(java.util.Calendar.HOUR_OF_DAY)
        val minute = calendar.get(java.util.Calendar.MINUTE)
        
        return String.format("%02d:%02d", hour, minute)
    }
}