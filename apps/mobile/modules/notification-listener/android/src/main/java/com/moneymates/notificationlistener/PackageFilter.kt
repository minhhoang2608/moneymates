package com.moneymates.notificationlistener

/** Thread-safe allow-list of notification source packages. Empty means nothing is accepted. */
object PackageFilter {
  @Volatile
  private var allowed: Set<String> = emptySet()

  fun set(packages: Collection<String>) {
    allowed = packages.toSet()
  }

  fun accepts(pkg: String?): Boolean = pkg != null && allowed.contains(pkg)
}
