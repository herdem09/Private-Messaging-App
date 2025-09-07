package com.whatsappclone.activities

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.whatsappclone.R
import com.whatsappclone.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMainBinding
    private lateinit var sharedPreferences: SharedPreferences
    
    companion object {
        const val PREFS_NAME = "WhatsAppClonePrefs"
        const val KEY_USERNAME = "username"
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        sharedPreferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        
        // Eğer kullanıcı adı varsa direkt chat'e git
        val savedUsername = sharedPreferences.getString(KEY_USERNAME, null)
        if (!savedUsername.isNullOrEmpty()) {
            startChatActivity()
            return
        }
        
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupUI()
    }
    
    private fun setupUI() {
        binding.btnEnterChat.setOnClickListener {
            val username = binding.etUsername.text.toString().trim()
            
            if (username.isEmpty()) {
                Toast.makeText(this, "Lütfen bir isim girin", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            if (username.length < 2) {
                Toast.makeText(this, "İsim en az 2 karakter olmalıdır", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            // Kullanıcı adını kaydet
            sharedPreferences.edit()
                .putString(KEY_USERNAME, username)
                .apply()
            
            startChatActivity()
        }
    }
    
    private fun startChatActivity() {
        val intent = Intent(this, ChatActivity::class.java)
        startActivity(intent)
        finish()
    }
}