package com.whatsappclone.services

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.whatsappclone.utils.NotificationHelper
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.net.URI
import java.util.concurrent.TimeUnit

class WebSocketService : Service() {
    
    companion object {
        const val ACTION_SEND_MESSAGE = "com.whatsappclone.SEND_MESSAGE"
        const val ACTION_MESSAGE_RECEIVED = "com.whatsappclone.MESSAGE_RECEIVED"
        const val ACTION_CONNECTION_STATUS = "com.whatsappclone.CONNECTION_STATUS"
        
        private const val TAG = "WebSocketService"
        private const val WEBSOCKET_URL = "ws://echo.websocket.org" // Test server
        // Gerçek projede kendi WebSocket serverınızın URL'ini kullanın
        // örnek: "ws://your-server.com:8080/chat"
    }
    
    private var webSocketClient: WebSocketClient? = null
    private var isConnected = false
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 5
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onCreate() {
        super.onCreate()
        connectWebSocket()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SEND_MESSAGE -> {
                val message = intent.getStringExtra("message")
                if (!message.isNullOrEmpty()) {
                    sendMessage(message)
                }
            }
        }
        return START_STICKY // Servis kapatılırsa tekrar başlat
    }
    
    private fun connectWebSocket() {
        try {
            val uri = URI(WEBSOCKET_URL)
            webSocketClient = object : WebSocketClient(uri) {
                override fun onOpen(handshake: ServerHandshake?) {
                    Log.d(TAG, "WebSocket bağlantısı açıldı")
                    isConnected = true
                    reconnectAttempts = 0
                    sendConnectionStatus(true)
                }
                
                override fun onMessage(message: String?) {
                    Log.d(TAG, "Mesaj alındı: $message")
                    message?.let { 
                        handleIncomingMessage(it)
                    }
                }
                
                override fun onClose(code: Int, reason: String?, remote: Boolean) {
                    Log.d(TAG, "WebSocket bağlantısı kapandı: $reason")
                    isConnected = false
                    sendConnectionStatus(false)
                    
                    // Otomatik yeniden bağlanma
                    if (reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++
                        android.os.Handler(mainLooper).postDelayed({
                            connectWebSocket()
                        }, TimeUnit.SECONDS.toMillis(5)) // 5 saniye bekle
                    }
                }
                
                override fun onError(ex: Exception?) {
                    Log.e(TAG, "WebSocket hatası: ${ex?.message}")
                    isConnected = false
                    sendConnectionStatus(false)
                }
            }
            
            webSocketClient?.connect()
            
        } catch (e: Exception) {
            Log.e(TAG, "WebSocket bağlantı hatası: ${e.message}")
        }
    }
    
    private fun sendMessage(message: String) {
        if (isConnected && webSocketClient != null) {
            try {
                webSocketClient?.send(message)
                Log.d(TAG, "Mesaj gönderildi: $message")
            } catch (e: Exception) {
                Log.e(TAG, "Mesaj gönderme hatası: ${e.message}")
            }
        } else {
            Log.w(TAG, "WebSocket bağlı değil, mesaj gönderilemedi")
        }
    }
    
    private fun handleIncomingMessage(message: String) {
        // Mesaj formatı: "kullaniciadi-mesaj"
        val parts = message.split("-", limit = 2)
        if (parts.size == 2) {
            val sender = parts[0]
            val messageText = parts[1]
            
            // Broadcast ile activity'ye mesajı ilet
            val intent = Intent(ACTION_MESSAGE_RECEIVED).apply {
                putExtra("message", messageText)
                putExtra("sender", sender)
                putExtra("timestamp", System.currentTimeMillis())
            }
            LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
            
            // Bildirim göster (eğer uygulama arka plandaysa)
            NotificationHelper.showMessageNotification(this, sender, messageText)
        }
    }
    
    private fun sendConnectionStatus(connected: Boolean) {
        val intent = Intent(ACTION_CONNECTION_STATUS).apply {
            putExtra("connected", connected)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        webSocketClient?.close()
        Log.d(TAG, "WebSocket servisi kapatıldı")
    }
}