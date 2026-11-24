package com.moneymates.notificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Drops every notification whose package is not on the allow-list before reading any content.
 * Nothing is stored, logged or sent over the network.
 */
class BankNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || !PackageFilter.accepts(sbn.packageName)) return
    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""
    sink?.invoke(mapOf(
      "packageName" to sbn.packageName,
      "title" to title,
      "text" to text,
      "postedAt" to sbn.postTime,
    ))
  }

  companion object {
    @Volatile
    var sink: ((Map<String, Any>) -> Unit)? = null
  }
}
