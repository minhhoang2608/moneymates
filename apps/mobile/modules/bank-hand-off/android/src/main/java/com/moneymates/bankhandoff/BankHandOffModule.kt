package com.moneymates.bankhandoff

import android.content.ActivityNotFoundException
import android.content.Intent
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
      val launch = if (intent.action == null && pkg != null) {
        context.packageManager.getLaunchIntentForPackage(pkg)
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

    // Sends a PNG to one package with ACTION_SEND. Throws when that package can't take image/png.
    AsyncFunction("sharePng") { base64: String, pkg: String ->
      val dir = File(context.cacheDir, "bank_hand_off").apply { mkdirs() }
      val file = File(dir, "qr.png")
      file.writeBytes(Base64.decode(base64, Base64.DEFAULT))
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.bankhandoff.fileprovider", file)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        setPackage(pkg)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      if (send.resolveActivity(context.packageManager) == null) {
        throw CodedException("ERR_SHARE_UNSUPPORTED", "$pkg does not accept image/png", null)
      }
      try {
        context.startActivity(send)
      } catch (e: ActivityNotFoundException) {
        throw CodedException("ERR_SHARE_UNSUPPORTED", "$pkg does not accept image/png", e)
      }
    }
  }
}
