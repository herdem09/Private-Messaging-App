package com.serverchat.app.ui

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.serverchat.app.R
import com.serverchat.app.data.model.Message
import com.serverchat.app.data.model.MessageType
import com.serverchat.app.data.model.Server
import com.serverchat.app.data.model.User
import com.serverchat.app.ui.theme.ServerChatTheme
import com.serverchat.app.ui.viewmodel.ChatViewModel
import java.text.SimpleDateFormat
import java.util.*

class ChatActivity : ComponentActivity() {
    
    private val viewModel: ChatViewModel by viewModels()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val server = intent.getParcelableExtra<Server>("server")
        val userId = intent.getStringExtra("user_id")
        val token = intent.getStringExtra("token")
        
        if (server == null || userId == null || token == null) {
            Toast.makeText(this, "Geçersiz bağlantı bilgileri", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        
        setContent {
            ServerChatTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ChatScreen(server, userId, token)
                }
            }
        }
    }
    
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun ChatScreen(server: Server, userId: String, token: String) {
        val context = LocalContext.current
        val uiState by viewModel.uiState.collectAsStateWithLifecycle()
        val listState = rememberLazyListState()
        
        var messageText by remember { mutableStateOf("") }
        var showUserList by remember { mutableStateOf(false) }
        
        LaunchedEffect(server, userId, token) {
            viewModel.connectToServer(server, userId, token)
        }
        
        LaunchedEffect(uiState.messages.size) {
            if (uiState.messages.isNotEmpty()) {
                listState.animateScrollToItem(uiState.messages.size - 1)
            }
        }
        
        LaunchedEffect(uiState.errorMessage) {
            uiState.errorMessage?.let { error ->
                Toast.makeText(context, error, Toast.LENGTH_LONG).show()
            }
        }
        
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                text = server.name,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = when (uiState.connectionState) {
                                    com.serverchat.app.network.ConnectionState.CONNECTED -> 
                                        "${uiState.onlineUsers.size} kullanıcı çevrimiçi"
                                    com.serverchat.app.network.ConnectionState.CONNECTING -> 
                                        "Bağlanıyor..."
                                    com.serverchat.app.network.ConnectionState.DISCONNECTED -> 
                                        "Bağlantı kesildi"
                                    com.serverchat.app.network.ConnectionState.ERROR -> 
                                        "Bağlantı hatası"
                                },
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { 
                            viewModel.disconnect()
                            finish() 
                        }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Geri")
                        }
                    },
                    actions = {
                        IconButton(onClick = { showUserList = !showUserList }) {
                            Icon(Icons.Default.Person, contentDescription = "Kullanıcılar")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = MaterialTheme.colorScheme.onPrimary,
                        navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                        actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            },
            bottomBar = {
                MessageInputBar(
                    message = messageText,
                    onMessageChange = { messageText = it },
                    onSendMessage = {
                        if (messageText.isNotBlank()) {
                            viewModel.sendMessage(messageText)
                            messageText = ""
                        }
                    },
                    enabled = uiState.connectionState == com.serverchat.app.network.ConnectionState.CONNECTED
                )
            }
        ) { paddingValues ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // Messages
                Box(
                    modifier = Modifier.weight(if (showUserList) 0.7f else 1f)
                ) {
                    if (uiState.messages.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Henüz mesaj yok\nKonuşmaya başlayın!",
                                textAlign = TextAlign.Center,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(8.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            items(uiState.messages) { message ->
                                MessageItem(
                                    message = message,
                                    isOwnMessage = message.senderId == userId
                                )
                            }
                        }
                    }
                }
                
                // User List
                if (showUserList) {
                    Card(
                        modifier = Modifier
                            .weight(0.3f)
                            .fillMaxHeight()
                            .padding(end = 8.dp, top = 8.dp, bottom = 8.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(8.dp)
                        ) {
                            Text(
                                text = getString(R.string.online_users),
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                            
                            LazyColumn {
                                items(uiState.onlineUsers) { user ->
                                    UserItem(user = user)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    @Composable
    fun MessageItem(message: Message, isOwnMessage: Boolean) {
        val dateFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
        
        when (message.messageType) {
            MessageType.SYSTEM, MessageType.JOIN, MessageType.LEAVE -> {
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        )
                    ) {
                        Text(
                            text = message.content,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
            MessageType.TEXT -> {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isOwnMessage) Arrangement.End else Arrangement.Start
                ) {
                    Card(
                        modifier = Modifier.widthIn(max = 280.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isOwnMessage) 
                                MaterialTheme.colorScheme.primary 
                            else 
                                MaterialTheme.colorScheme.surfaceVariant
                        ),
                        shape = RoundedCornerShape(
                            topStart = 12.dp,
                            topEnd = 12.dp,
                            bottomStart = if (isOwnMessage) 12.dp else 4.dp,
                            bottomEnd = if (isOwnMessage) 4.dp else 12.dp
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp)
                        ) {
                            if (!isOwnMessage) {
                                Text(
                                    text = message.senderName,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(bottom = 2.dp)
                                )
                            }
                            
                            Text(
                                text = message.content,
                                fontSize = 14.sp,
                                color = if (isOwnMessage) 
                                    MaterialTheme.colorScheme.onPrimary 
                                else 
                                    MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            
                            Text(
                                text = dateFormat.format(Date(message.timestamp)),
                                fontSize = 10.sp,
                                color = if (isOwnMessage) 
                                    MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                                else 
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                    }
                }
            }
        }
    }
    
    @Composable
    fun UserItem(user: User) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(
                        if (user.isOnline) MaterialTheme.colorScheme.primary 
                        else MaterialTheme.colorScheme.onSurfaceVariant
                    )
            )
            
            Spacer(modifier = Modifier.width(8.dp))
            
            Text(
                text = user.username,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
    
    @Composable
    fun MessageInputBar(
        message: String,
        onMessageChange: (String) -> Unit,
        onSendMessage: () -> Unit,
        enabled: Boolean
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = message,
                    onValueChange = onMessageChange,
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(getString(R.string.type_message)) },
                    enabled = enabled,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(
                        onSend = { onSendMessage() }
                    )
                )
                
                Spacer(modifier = Modifier.width(8.dp))
                
                IconButton(
                    onClick = onSendMessage,
                    enabled = enabled && message.isNotBlank()
                ) {
                    Icon(
                        Icons.Default.Send,
                        contentDescription = getString(R.string.send),
                        tint = if (enabled && message.isNotBlank()) 
                            MaterialTheme.colorScheme.primary 
                        else 
                            MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}