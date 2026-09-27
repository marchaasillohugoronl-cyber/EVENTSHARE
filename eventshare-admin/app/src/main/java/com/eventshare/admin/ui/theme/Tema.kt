package com.eventshare.admin.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Pine = Color(0xFF1F5D50)

private val Light = lightColorScheme(
    primary = Pine,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCDE8DF),
    onPrimaryContainer = Color(0xFF0B2B24),
    secondary = Color(0xFF8A5A2B),
    background = Color(0xFFF4F5F1),
    surface = Color(0xFFF4F5F1),
    surfaceVariant = Color(0xFFE6E9E3),
    error = Color(0xFFB3261E),
)

private val Dark = darkColorScheme(
    primary = Color(0xFF8CCBB9),
    onPrimary = Color(0xFF00382D),
    primaryContainer = Color(0xFF174A3E),
    secondary = Color(0xFFE0B98F),
    background = Color(0xFF121412),
    surface = Color(0xFF121412),
)

@Composable
fun EventShareTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (dark) Dark else Light, content = content)
}
