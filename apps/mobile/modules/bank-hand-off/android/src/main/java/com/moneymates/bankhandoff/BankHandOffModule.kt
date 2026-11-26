package com.moneymates.bankhandoff

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentUris
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class BankHandOffModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "No Android context", null)

  override fun definition() = ModuleDefinition {
    Name("BankHandOff")

    // RN Linking.openURL does not resolve intent:// URIs, so parse and launch them here.
    AsyncFunction("openIntentUri") { uri: String ->
      val intent = try {
        Intent.parseUri(uri, Intent.URI_INTENT_SCHEME)
      } catch (e: Exception) {
        throw CodedException("ERR_BAD_INTENT", "Invalid intent uri", e)
      }
      val pkg = intent.`package`
      // parseUri defaults to ACTION_VIEW with data "//" for package-only URIs, which never
      // resolves. A package with no real data means "open the app": use its launcher intent.
      val data = intent.dataString
      val packageOnly = pkg != null && (data.isNullOrEmpty() || data == "//") &&
        (intent.action == null || intent.action == Intent.ACTION_VIEW)
      val launch = if (packageOnly) {
        context.packageManager.getLaunchIntentForPackage(pkg!!)
      } else {
        intent
      }
      if (launch == null) throw CodedException("ERR_NOT_INSTALLED", "App is not installed", null)
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(launch)
      } catch (e: ActivityNotFoundException) {
        throw CodedException("ERR_NOT_INSTALLED", "App is not installed", e)
      }
    }

    // Sends a PNG or JPEG to one package with ACTION_SEND. Throws when that package can't take the type.
    AsyncFunction("sharePng") { base64: String, pkg: String, mime: String ->
      val dir = File(context.cacheDir, "bank_hand_off").apply { mkdirs() }
      val file = File(dir, if (mime == "image/jpeg") "qr.jpg" else "qr.png")
      file.writeBytes(Base64.decode(base64, Base64.DEFAULT))
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.bankhandoff.fileprovider", file)
      return@AsyncFunction sendImage(uri, pkg, mime)
    }

    // Sends a photo that is already in the gallery (MediaStore id from expo-media-library) to one package,
    // with the same content://media URI the Gallery app shares. Some bank apps (Techcombank) only read the
    // QR from such a URI and ignore a FileProvider one.
    AsyncFunction("shareMediaImage") { mediaId: String, pkg: String ->
      val id = mediaId.toLongOrNull() ?: throw CodedException("ERR_BAD_MEDIA_ID", "Invalid media id", null)
      val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
      return@AsyncFunction sendImage(uri, pkg, context.contentResolver.getType(uri) ?: "image/jpeg")
    }
  }

  // Returns "<activity that got the image> (<n> activities take it), <mime>" for the temporary diagnostic (#480).
  private fun sendImage(uri: Uri, pkg: String, mime: String): String {
    val send = Intent(Intent.ACTION_SEND).apply {
      type = mime
      putExtra(Intent.EXTRA_STREAM, uri)
      clipData = ClipData.newRawUri("", uri)
      setPackage(pkg)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    val target = send.resolveActivity(context.packageManager)
      ?: throw CodedException("ERR_SHARE_UNSUPPORTED", "$pkg does not accept $mime", null)
    val count = context.packageManager.queryIntentActivities(send, 0).size
    try {
      context.startActivity(send)
    } catch (e: ActivityNotFoundException) {
      throw CodedException("ERR_SHARE_UNSUPPORTED", "$pkg does not accept $mime", e)
    }
    return "${target.className} ($count), $mime"
  }
}
