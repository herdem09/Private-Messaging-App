package com.serverchat.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.serverchat.app.data.local.PreferencesManager
import com.serverchat.app.data.model.Server
import com.serverchat.app.ui.ServerListActivity
import com.serverchat.app.ui.ServerRegistrationActivity
import com.serverchat.app.ui.theme.ServerChatTheme

class MainActivity : ComponentActivity() {
    
    private lateinit var preferencesManager: PreferencesManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        preferencesManager = PreferencesManager(this)
        
        setContent {
            ServerChatTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen()
                }
            }
        }
    }
    
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun MainScreen() {
        val context = LocalContext.current
        var savedServers by remember { mutableStateOf(preferencesManager.getSavedServers()) }
        
        LaunchedEffect(Unit) {
            savedServers = preferencesManager.getSavedServers()
        }
        
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = "ServerChat",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            },
            floatingActionButton = {
                FloatingActionButton(
                    onClick = {
                        val intent = Intent(context, ServerRegistrationActivity::class.java)
                        context.startActivity(intent)
                    }
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Sunucu Ekle")
                }
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp)
            ) {
                // Welcome Section
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = getString(R.string.welcome_title),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = getString(R.string.welcome_subtitle),
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                        )
                    }
                }
                
                // Action Buttons
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            val intent = Intent(context, ServerRegistrationActivity::class.java)
                            context.startActivity(intent)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(getString(R.string.register_server))
                    }
                    
                    OutlinedButton(
                        onClick = {
                            val intent = Intent(context, ServerListActivity::class.java)
                            context.startActivity(intent)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(getString(R.string.join_server))
                    }
                }
                
                // Saved Servers Section
                Text(
                    text = getString(R.string.my_servers),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                
                if (savedServers.isEmpty()) {
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
                                text = "Henüz kayıtlı sunucu yok\nYeni bir sunucu eklemek için + butonuna tıklayın",
                                textAlign = TextAlign.Center,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(savedServers) { server ->
                            ServerCard(
                                server = server,
                                onServerClick = { clickedServer ->
                                    val intent = Intent(context, ServerListActivity::class.java).apply {
                                        putExtra("selected_server", clickedServer)
                                    }
                                    context.startActivity(intent)
                                },
                                onServerDelete = { serverId ->
                                    preferencesManager.removeServer(serverId)
                                    savedServers = preferencesManager.getSavedServers()
                                }
                            )
                        }
                    }
                }
            }
        }
    }
    
    @Composable
    fun ServerCard(
        server: Server,
        onServerClick: (Server) -> Unit,
        onServerDelete: (String) -> Unit
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
                    if (server.hasPassword) {
                        Text(
                            text = "🔒 Şifreli",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }
                
                IconButton(
                    onClick = { onServerClick(server) }
                ) {
                    Icon(
                        Icons.Default.PlayArrow,
                        contentDescription = "Bağlan",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
    
    override fun onResume() {
        super.onResume()
        // Refresh the server list when returning to main activity
        setContent {
            ServerChatTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen()
                }
            }
        }
    }
}