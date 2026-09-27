package com.eventshare.admin.util

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.core.content.FileProvider
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.io.File

object Qr {
    /** Genera el QR (negro sobre blanco) para la URL del evento. */
    fun bitmap(text: String, size: Int = 800): Bitmap {
        val hints = mapOf(EncodeHintType.MARGIN to 2, EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M)
        val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, hints)
        val pixels = IntArray(size * size)
        for (y in 0 until size) for (x in 0 until size) pixels[y * size + x] = if (m[x, y]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt()
        return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
    }

    /** Guarda el PNG en la ubicación elegida por el usuario (Storage Access Framework, sin permisos). */
    fun writeTo(context: Context, uri: Uri, bmp: Bitmap): Boolean = runCatching {
        context.contentResolver.openOutputStream(uri)?.use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } ?: false
    }.getOrDefault(false)

    /** Abre el selector de apps para compartir la imagen del QR junto con el enlace. */
    fun share(context: Context, bmp: Bitmap, code: String, eventName: String, url: String) {
        val dir = File(context.cacheDir, "qr").apply { mkdirs() }
        val file = File(dir, "eventshare-$code.png")
        file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "$eventName\n$url")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Compartir QR"))
    }
}
