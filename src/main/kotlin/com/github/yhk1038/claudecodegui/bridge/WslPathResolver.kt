package com.github.yhk1038.claudecodegui.bridge

/**
 * Pure conversions between Windows-side paths and WSL (Linux) paths.
 *
 * When a JetBrains IDE on Windows opens a project that lives inside WSL,
 * `project.basePath` comes back as a UNC path such as
 * `\\wsl.localhost\Ubuntu\home\user\proj` (modern) or `\\wsl$\Ubuntu\home\user`
 * (legacy). Handing that UNC path to a Windows process as its working directory
 * fails ("UNC paths are not supported") because the spawn goes through cmd.exe.
 *
 * This object isolates the path math so it can be unit-tested without WSL,
 * Windows, or the IntelliJ platform. The filesystem/process glue (deciding when
 * to wrap a spawn in `wsl.exe`, probing for a WSL `node`) lives in the callers.
 *
 * Background: issue #57.
 */
object WslPathResolver {

    /** A WSL location parsed out of a Windows UNC path: which distro, and where inside it. */
    data class WslLocation(val distro: String, val linuxPath: String)

    // The two UNC host forms WSL exposes. Compared case-insensitively because UNC
    // hosts are case-insensitive on Windows.
    private const val MODERN_HOST = "wsl.localhost"
    private const val LEGACY_HOST = "wsl$"

    /**
     * True when [path] is a WSL UNC path (`\\wsl.localhost\...` or `\\wsl$\...`).
     * Accepts forward- or back-slashes so callers don't have to normalize first.
     */
    fun isWslUncPath(path: String?): Boolean {
        if (path.isNullOrBlank()) return false
        val n = path.replace('\\', '/').lowercase()
        return n.startsWith("//$MODERN_HOST/") || n.startsWith("//$LEGACY_HOST/")
    }

    /**
     * Parse a WSL UNC path into its distro and Linux path.
     *
     * `\\wsl.localhost\Ubuntu\home\user\proj` -> WslLocation("Ubuntu", "/home/user/proj")
     * `\\wsl$\NixOS\home\maicol07`            -> WslLocation("NixOS", "/home/maicol07")
     * `\\wsl.localhost\Ubuntu`                -> WslLocation("Ubuntu", "/")
     *
     * Returns null when [uncPath] is not a WSL UNC path. The distro name keeps its
     * original casing (distro ids are case-sensitive to `wsl -d`); only the host
     * prefix is matched case-insensitively.
     */
    fun parseUncPath(uncPath: String?): WslLocation? {
        if (!isWslUncPath(uncPath)) return null
        val normalized = uncPath!!.replace('\\', '/')

        // Drop the leading "//<host>/" using the matched host's length, preserving
        // the original casing of everything after it (the distro id).
        val afterSlashes = normalized.substring(2) // strip leading "//"
        val firstSlash = afterSlashes.indexOf('/')
        if (firstSlash < 0) return null
        val rest = afterSlashes.substring(firstSlash + 1) // "Ubuntu/home/user/proj"

        val segments = rest.split('/').filter { it.isNotEmpty() }
        if (segments.isEmpty()) return null

        val distro = segments.first()
        val linuxSegments = segments.drop(1)
        val linuxPath = if (linuxSegments.isEmpty()) "/" else "/" + linuxSegments.joinToString("/")
        return WslLocation(distro, linuxPath)
    }

    /**
     * Convert a Windows-side path to the path WSL sees.
     *
     * - Already a Linux path (`/home/...`)        -> returned unchanged.
     * - WSL UNC (`\\wsl.localhost\Ubuntu\home`)   -> the Linux path inside the distro (`/home`).
     * - Drive path (`C:\Users\foo`)               -> `/mnt/c/Users/foo`.
     * - Anything else                             -> back-slashes turned into forward-slashes.
     *
     * Returns null for null input and the input unchanged when blank.
     */
    fun toWslPath(windowsPath: String?): String? {
        if (windowsPath == null) return null
        if (windowsPath.isBlank()) return windowsPath

        // Already a Linux absolute path — nothing to convert.
        if (windowsPath.startsWith("/")) return windowsPath

        // WSL UNC path -> the path inside the distro.
        parseUncPath(windowsPath)?.let { return it.linuxPath }

        // Drive-letter path: "C:\Users\foo" or "C:Users\foo" -> "/mnt/c/Users/foo".
        if (windowsPath.length >= 2 && windowsPath[1] == ':') {
            val drive = windowsPath[0].lowercaseChar()
            val rest = windowsPath.substring(2).replace('\\', '/')
            val withLeadingSlash = if (rest.startsWith("/")) rest else "/$rest"
            return "/mnt/$drive$withLeadingSlash".trimEnd('/').ifEmpty { "/mnt/$drive" }
        }

        // Fallback: normalize separators.
        return windowsPath.replace('\\', '/')
    }

    /**
     * Build the command to run `node <script>` inside a WSL distro from the Windows host.
     *
     * Produces, e.g.:
     * `wsl.exe -d Ubuntu --cd /home/u/proj -- env PORT=0 JETBRAINS_MODE=true node /mnt/c/.../backend.mjs`
     *
     * - The leading `wsl.exe` is resolved on the Windows PATH (System32).
     * - Everything after `--` runs inside the distro, so `env`/`node` are the distro's.
     * - [env] entries are passed via `env K=V` so they reach the WSL process regardless of
     *   WSLENV configuration. [scriptLinuxPath] must already be a WSL-visible path (use
     *   [toWslPath] on the Windows extraction path).
     * - [nodeExec] defaults to `node` (resolved on the distro's PATH). WSL-specific node
     *   discovery is a separate concern.
     *
     * NOTE: `--cd` requires a reasonably recent wsl.exe (Windows 10 2004+). This builder is
     * pure/testable; real-world execution is verified separately (issue #57, plan S4b).
     */
    fun buildWslNodeCommand(
        distro: String,
        linuxCwd: String?,
        env: Map<String, String>,
        scriptLinuxPath: String,
        scriptArgs: List<String> = emptyList(),
        nodeExec: String = "node",
    ): List<String> = buildList {
        add("wsl.exe")
        add("-d"); add(distro)
        if (!linuxCwd.isNullOrBlank()) {
            add("--cd"); add(linuxCwd)
        }
        add("--")
        add("env")
        env.forEach { (k, v) -> add("$k=$v") }
        add(nodeExec)
        add(scriptLinuxPath)
        addAll(scriptArgs)
    }
}
