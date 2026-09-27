package com.eventshare.admin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.eventshare.admin.ui.AppNav
import com.eventshare.admin.ui.theme.EventShareTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as EventShareApp).container
        setContent {
            EventShareTheme { AppNav(container) }
        }
    }
}
