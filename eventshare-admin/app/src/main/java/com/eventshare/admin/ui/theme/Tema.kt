package com.eventshare.admin.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val SenatiBlue = Color(0xFF0D42CD)

private val Light = lightColorScheme(
    primary = SenatiBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE7FF),
    onPrimaryContainer = Color(0xFF102451),
    secondary = Color(0xFF007B91),
    background = Color(0xFFF5F8FE),
    surface = Color(0xFFF5F8FE),
    surfaceVariant = Color(0xFFE3EAF6),
    error = Color(0xFFB3261E),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFAFC6FF),
    onPrimary = Color(0xFF002776),
    primaryContainer = Color(0xFF163D88),
    secondary = Color(0xFF63DDEB),
    background = Color(0xFF08162E),
    surface = Color(0xFF08162E),
)

@Composable
fun EventShareTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (dark) Dark else Light, content = content)
}
