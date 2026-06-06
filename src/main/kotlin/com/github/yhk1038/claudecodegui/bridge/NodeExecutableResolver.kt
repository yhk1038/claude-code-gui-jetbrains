package com.github.yhk1038.claudecodegui.bridge

/**
 * Pure logic for resolving which Node.js installation to use.
 *
 * Extracted from [NodeProcessManager] so it can be unit-tested without touching
 * the real filesystem or environment. The filesystem-facing glue (listing
 * `~/.nvm/versions/node/`, reading `~/.nvm/alias/default`, existence checks) lives
 * in [NodeProcessManager]; the version-selection policy lives here.
 */
object NodeExecutableResolver {

    /**
     * Pick the best nvm-installed node version directory name.
     *
     * nvm stores each version under `~/.nvm/versions/node/<name>` (e.g. `v24.16.0`)
     * and records the user's default in `~/.nvm/alias/default` — which may hold an
     * exact version (`v24.16.0`), a partial version (`24`, `v24`), or an LTS codename
     * (`lts/iron`). Crucially, nvm does NOT create a `current` symlink, so the old
     * `~/.nvm/current/bin/node` fallback never matched for nvm users (#59).
     *
     * Resolution order:
     * 1. Exact match against the default alias.
     * 2. Major-version prefix match against the default alias (newest matching minor).
     * 3. Fall back to the newest installed version by numeric semver.
     *
     * @param installedVersions directory names found under `~/.nvm/versions/node/`
     * @param defaultAlias raw contents of `~/.nvm/alias/default`, or null if absent
     * @return the chosen directory name, or null when nothing usable is installed
     */
    fun selectNvmVersion(installedVersions: List<String>, defaultAlias: String?): String? {
        val versions = installedVersions
            .filter { isVersionName(it) }
            .sortedWith(compareByDescending(VERSION_COMPARATOR) { it })
        if (versions.isEmpty()) return null

        val alias = defaultAlias?.trim()?.takeIf { it.isNotEmpty() }
        if (alias != null) {
            val normalized = alias.removePrefix("v")

            // 1. Exact version match (with or without leading "v").
            versions.firstOrNull { it.removePrefix("v") == normalized }?.let { return it }

            // 2. Major-version prefix match (e.g. "24" -> newest v24.x). Only when the
            //    alias is purely numeric, so codenames like "lts/iron" don't match.
            if (normalized.all { it.isDigit() }) {
                versions.firstOrNull { parseVersion(it).firstOrNull() == normalized.toInt() }
                    ?.let { return it }
            }
        }

        // 3. Newest installed version.
        return versions.first()
    }

    /**
     * Normalize a user-configured node path read from settings (`nodePath`).
     *
     * Returns the trimmed path, or null when it is absent/blank — so the caller
     * falls through to auto-detection instead of trying to spawn an empty string.
     * Existence and executability are verified by the caller against the real
     * filesystem; this method only handles the pure string hygiene.
     */
    fun normalizeConfiguredNodePath(raw: String?): String? =
        raw?.trim()?.takeIf { it.isNotEmpty() }

    /** True when [name] looks like `v24.16.0` / `24.16.0`. */
    private fun isVersionName(name: String): Boolean {
        val core = name.removePrefix("v")
        val parts = core.split('.')
        return parts.isNotEmpty() && parts.all { it.isNotEmpty() && it.all(Char::isDigit) }
    }

    /** Parse `v24.16.0` into `[24, 16, 0]`; non-numeric segments stop at 0. */
    private fun parseVersion(name: String): List<Int> =
        name.removePrefix("v").split('.').map { it.toIntOrNull() ?: 0 }

    /** Compares version names like `v24.16.0` segment-by-segment, numerically. */
    private val VERSION_COMPARATOR = Comparator<String> { a, b ->
        val pa = parseVersion(a)
        val pb = parseVersion(b)
        for (i in 0 until maxOf(pa.size, pb.size)) {
            val cmp = (pa.getOrElse(i) { 0 }).compareTo(pb.getOrElse(i) { 0 })
            if (cmp != 0) return@Comparator cmp
        }
        0
    }
}
