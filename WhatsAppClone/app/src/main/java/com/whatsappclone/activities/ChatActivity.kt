package com.whatsappclone.activities

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import androidx.recyclerview.widget.LinearLayoutManager
import com.whatsappclone.R
import com.whatsappclone.adapters.MessageAdapter
import com.whatsappclone.databinding.ActivityChatBinding
import com.whatsappclone.models.Message
import com.whatsappclone.services.WebSocketService
import com.whatsappclone.utils.NotificationHelper
import java.text.SimpleDateFormat
import java.util.*

class ChatActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityChatBinding
    private lateinit var messageAdapter: MessageAdapter
    private lateinit var sharedPreferences: SharedPreferences
    private val messages = mutableListOf<Message>()
    private var username: String = ""
    
    private val messageReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                WebSocketService.ACTION_MESSAGE_RECEIVED -> {
                    val messageText = intent.getStringExtra("message") ?: return
                    val senderName = intent.getStringExtra("sender") ?: return
                    val timestamp = intent.getLongExtra("timestamp", System.currentTimeMillis())
                    
                    val message = Message(
                        text = messageText,
                        sender = senderName,
                        timestamp = timestamp,
                        isFromMe = senderName == username
                    )
                    
                    runOnUiThread {
                        messages.add(message)
                        messageAdapter.notifyItemInserted(messages.size - 1)
                        binding.recyclerViewMessages.scrollToPosition(messages.size - 1)
                    }
                }
                WebSocketService.ACTION_CONNECTION_STATUS -> {
                    val isConnected = intent.getBooleanExtra("connected", false)
                    runOnUiThread {
                        updateConnectionStatus(isConnected)
                    }
                }
            }
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityChatBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        sharedPreferences = getSharedPreferences(MainActivity.PREFS_NAME, MODE_PRIVATE)
        username = sharedPreferences.getString(MainActivity.KEY_USERNAME, "") ?: ""
        
        if (username.isEmpty()) {
            // Kullanıcı adı yoksa ana ekrana dön
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }
        
        setupUI()
        setupRecyclerView()
        startWebSocketService()
        registerMessageReceiver()
        
        // Bildirim helper'ı başlat
        NotificationHelper.createNotificationChannel(this)
    }
    
    private fun setupUI() {
        supportActionBar?.title = "Chat"
        supportActionBar?.subtitle = "Kullanıcı: $username"
        
        binding.btnSend.setOnClickListener {
            sendMessage()
        }
        
        binding.etMessage.setOnEditorActionListener { _, _, _ ->
            sendMessage()
            true
        }
    }
    
    private fun setupRecyclerView() {
        messageAdapter = MessageAdapter(messages, username)
        binding.recyclerViewMessages.apply {
            layoutManager = LinearLayoutManager(this@ChatActivity)
            adapter = messageAdapter
        }
    }
    
    private fun sendMessage() {
        val messageText = binding.etMessage.text.toString().trim()
        if (messageText.isEmpty()) return
        
        val fullMessage = "$username-$messageText"
        
        // WebSocket servisine mesaj gönder
        val intent = Intent(this, WebSocketService::class.java).apply {
            action = WebSocketService.ACTION_SEND_MESSAGE
            putExtra("message", fullMessage)
        }
        startService(intent)
        
        binding.etMessage.text.clear()
    }
    
    private fun startWebSocketService() {
        val intent = Intent(this, WebSocketService::class.java)
        startService(intent)
    }
    
    private fun registerMessageReceiver() {
        val filter = IntentFilter().apply {
            addAction(WebSocketService.ACTION_MESSAGE_RECEIVED)
            addAction(WebSocketService.ACTION_CONNECTION_STATUS)
        }
        LocalBroadcastManager.getInstance(this).registerReceiver(messageReceiver, filter)
    }
    
    private fun updateConnectionStatus(isConnected: Boolean) {
        supportActionBar?.subtitle = if (isConnected) {
            "Kullanıcı: $username • Bağlı"
        } else {
            "Kullanıcı: $username • Bağlantı yok"
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(messageReceiver)
    }
    
    override fun onResume() {
        super.onResume()
        // Uygulamaya dönüldüğünde bildirimleri temizle
        NotificationHelper.clearNotifications(this)
    }
}