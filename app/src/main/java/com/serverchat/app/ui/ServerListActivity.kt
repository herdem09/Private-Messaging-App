package com.serverchat.app.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.foundation.background
import com.serverchat.app.R
import com.serverchat.app.data.model.Server
import com.serverchat.app.ui.theme.ServerChatTheme
import com.serverchat.app.ui.viewmodel.ServerListViewModel

class ServerListActivity : ComponentActivity() {
    
    private val viewModel: ServerListViewModel by viewModels()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Check if a specific server was passed
        val selectedServer = intent.getParcelableExtra<Server>("selected_server")
        
        setContent {
            ServerChatTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ServerListScreen(selectedServer)
                }
            }
        }
    }
    
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun ServerListScreen(preselectedServer: Server?) {
        val context = LocalContext.current
        val uiState by viewModel.uiState.collectAsStateWithLifecycle()
        
        var showConnectionDialog by remember { mutableStateOf(false) }
        var selectedServer by remember { mutableStateOf<Server?>(null) }
        
        LaunchedEffect(preselectedServer) {
            preselectedServer?.let {
                selectedServer = it
                showConnectionDialog = true
            }
        }
        
        LaunchedEffect(uiState.connectionSuccess) {
            if (uiState.connectionSuccess) {
                val intent = Intent(context, ChatActivity::class.java).apply {
                    putExtra("server", selectedServer)
                    putExtra("user_id", uiState.userId)
                    putExtra("token", uiState.token)
                }
                context.startActivity(intent)
                finish()
            }
        }
        
        LaunchedEffect(uiState.errorMessage) {
            uiState.errorMessage?.let { error ->
                Toast.makeText(context, error, Toast.LENGTH_LONG).show()
            }
        }
        
        LaunchedEffect(Unit) {
            viewModel.loadServers()
        }
        
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = getString(R.string.join_server_title),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { finish() }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Geri")
                        }
                    },
                    actions = {
                        IconButton(onClick = { viewModel.loadServers() }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Yenile")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = MaterialTheme.colorScheme.onPrimary,
                        navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                        actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp)
            ) {
                if (uiState.isLoading && uiState.servers.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                } else if (uiState.servers.isEmpty()) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Kullanılabilir sunucu bulunamadı\nYenile butonuna tıklayarak tekrar deneyin",
                                textAlign = TextAlign.Center,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.servers) { server ->
                            ServerCard(
                                server = server,
                                onServerClick = { clickedServer ->
                                    selectedServer = clickedServer
                                    showConnectionDialog = true
                                }
                            )
                        }
                    }
                }
            }
        }
        
        if (showConnectionDialog && selectedServer != null) {
            ConnectionDialog(
                server = selectedServer!!,
                isLoading = uiState.isConnecting,
                onDismiss = { 
                    showConnectionDialog = false
                    selectedServer = null
                },
                onConnect = { username, password ->
                    viewModel.connectToServer(selectedServer!!, username, password)
                }
            )
        }
    }
    
    @Composable
    fun ServerCard(
        server: Server,
        onServerClick: (Server) -> Unit
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            onClick = { onServerClick(server) }
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = server.name,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "${server.ipAddress}:${server.port}",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (server.hasPassword) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.Lock,
                                    contentDescription = "Şifreli",
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.secondary
                                )
                                Text(
                                    text = "Şifreli",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.secondary
                                )
                            }
                        }
                        
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                Icons.Default.Person,
                                contentDescription = "Kullanıcı",
                                modifier = Modifier.size(16.dp),
                                tint = if (server.isOnline) MaterialTheme.colorScheme.primary 
                                      else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "${server.userCount}/${server.maxUsers}",
                                fontSize = 12.sp,
                                color = if (server.isOnline) MaterialTheme.colorScheme.primary 
                                       else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .padding(4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .run {
                                if (server.isOnline) {
                                    this.then(Modifier.background(
                                        MaterialTheme.colorScheme.primary,
                                        androidx.compose.foundation.shape.CircleShape
                                    ))
                                } else {
                                    this.then(Modifier.background(
                                        MaterialTheme.colorScheme.onSurfaceVariant,
                                        androidx.compose.foundation.shape.CircleShape
                                    ))
                                }
                            }
                    )
                }
            }
        }
    }
    
    @Composable
    fun ConnectionDialog(
        server: Server,
        isLoading: Boolean,
        onDismiss: () -> Unit,
        onConnect: (String, String?) -> Unit
    ) {
        var username by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        
        Dialog(onDismissRequest = onDismiss) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "${server.name} sunucusuna bağlan",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text(getString(R.string.username)) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isLoading,
                        singleLine = true
                    )
                    
                    if (server.hasPassword) {
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text(getString(R.string.password)) },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !isLoading,
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                        )
                    }
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDismiss,
                            modifier = Modifier.weight(1f),
                            enabled = !isLoading
                        ) {
                            Text(getString(R.string.cancel))
                        }
                        
                        Button(
                            onClick = {
                                if (username.isNotBlank()) {
                                    onConnect(
                                        username,
                                        if (server.hasPassword) password.takeIf { it.isNotBlank() } else null
                                    )
                                }
                            },
                            modifier = Modifier.weight(1f),
                            enabled = !isLoading && username.isNotBlank()
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                            } else {
                                Text(getString(R.string.connect))
                            }
                        }
                    }
                    
                    if (isLoading) {
                        Text(
                            text = getString(R.string.connecting),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }
    }
}