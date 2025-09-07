package com.serverchat.app.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.serverchat.app.MainActivity
import com.serverchat.app.R
import com.serverchat.app.data.local.PreferencesManager
import com.serverchat.app.data.model.Message
import com.serverchat.app.data.model.MessageType
import com.serverchat.app.data.model.Server
import com.serverchat.app.network.ChatWebSocketClient
import kotlinx.coroutines.*
import java.net.URI

class ChatService : Service() {
    
    companion object {
        const val NOTIFICATION_ID = 1
        const val CHANNEL_ID = "chat_channel"
        const val ACTION_CONNECT = "action_connect"
        const val ACTION_DISCONNECT = "action_disconnect"
        const val EXTRA_SERVER = "extra_server"
        const val EXTRA_USER_ID = "extra_user_id"
        const val EXTRA_TOKEN = "extra_token"
    }
    
    private lateinit var preferencesManager: PreferencesManager
    private var webSocketClient: ChatWebSocketClient? = null
    private var serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var currentServer: Server? = null
    
    override fun onCreate() {
        super.onCreate()
        preferencesManager = PreferencesManager(this)
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> {
                val server = intent.getParcelableExtra<Server>(EXTRA_SERVER)
                val userId = intent.getStringExtra(EXTRA_USER_ID)
                val token = intent.getStringExtra(EXTRA_TOKEN)
                
                if (server != null && userId != null && token != null) {
                    connectToServer(server, userId, token)
                }
            }
            ACTION_DISCONNECT -> {
                disconnectFromServer()
                stopSelf()
            }
        }
        
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    private fun connectToServer(server: Server, userId: String, token: String) {
        currentServer = server
        
        serviceScope.launch {
            try {
                val wsUri = URI("ws://${server.ipAddress}:${server.port}/ws")
                webSocketClient = ChatWebSocketClient(wsUri, token)
                
                // Listen for new messages
                webSocketClient?.messages?.collect { messages ->
                    val lastMessage = messages.lastOrNull()
                    if (lastMessage != null && 
                        lastMessage.senderId != userId && 
                        lastMessage.messageType == MessageType.TEXT) {
                        showNotification(lastMessage, server)
                    }
                }
                
                webSocketClient?.connect()
                startForeground(NOTIFICATION_ID, createForegroundNotification(server))
                
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
    
    private fun disconnectFromServer() {
        webSocketClient?.disconnect()
        webSocketClient = null
        currentServer = null
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = getString(R.string.notification_channel_description)
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createForegroundNotification(server: Server): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ServerChat")
            .setContentText("${server.name} sunucusuna bağlı")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
    
    private fun showNotification(message: Message, server: Server) {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("${message.senderName} - ${server.name}")
            .setContentText(message.content)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(message.timestamp.toInt(), notification)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        disconnectFromServer()
        serviceScope.cancel()
    }
}