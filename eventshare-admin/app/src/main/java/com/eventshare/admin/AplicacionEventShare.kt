package com.eventshare.admin

import android.app.Application
import com.eventshare.admin.data.AppContainer
import kotlinx.coroutines.runBlocking

class EventShareApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        // Lectura única y rápida de la sesión guardada para decidir la pantalla inicial.
        runBlocking { container.session.load() }
    }
}
