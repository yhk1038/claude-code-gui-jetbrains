package com.github.yhk1038.claudecodegui.bridge

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.util.SystemInfo
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Captures the user's real shell PATH by launching their login + interactive shell.
 *
 * ## Why
 * A GUI-launched IDE (Dock, app icon, Spotlight) starts in a bare environment that
 * never sourced the user's interactive shell config (`.zshrc`/`.bashrc`). Version
 * managers like nvm/fnm/mise add their bin dirs there, so the IDE's inherited PATH
 * is missing them — and any `node`/`claude` spawned from the IDE can't be found (#59).
 *
 * Asking the shell itself for its PATH is the only robust fix: it works for every
 * version manager at once, instead of hard-coding each one's install layout.
 *
 * ## How
 * Runs `$SHELL -lic "printf '<UUID>'; command printenv PATH; printf '<UUID>'"`:
 * - `-lic` = login + interactive, so both `.zprofile`/`.zlogin` AND `.zshrc` are read.
 * - The PATH is sandwiched between two random-UUID markers so we can slice it out of
 *   any startup noise (prompts, banners, `.zshrc` echo) the shell prints.
 * - `command printenv` bypasses user aliases/functions.
 *
 * This mirrors the approach the official Claude Code VS Code extension uses
 * (`resolveShellPath`). Results are cached per shell; Windows is skipped (no POSIX shell).
 */
object ShellPathResolver {

    private val logger = Logger.getInstance(ShellPathResolver::class.java)

    private const val TIMEOUT_SECONDS = 10L

    // Cached PATH per shell binary. Empty string = resolved-but-failed (don't retry).
    private val cache = HashMap<String, String>()

    /**
     * Resolve the user's shell PATH, or null when unavailable (Windows, no $SHELL,
     * shell failure, or invalid output). Cached per shell binary.
     */
    @Synchronized
    fun resolve(): String? {
        if (SystemInfo.isWindows) return null
        val shell = System.getenv("SHELL")?.takeIf { it.isNotBlank() } ?: return null

        cache[shell]?.let { return it.ifEmpty { null } }

        val resolved = runShell(shell)
        cache[shell] = resolved ?: ""
        return resolved
    }

    /** Launch the shell and capture its PATH. Returns null on any failure. */
    private fun runShell(shell: String): String? {
        val marker = UUID.randomUUID().toString().replace("-", "")
        return try {
            // Capture stdout ONLY. An interactive shell can write warnings to stderr
            // (e.g. zsh's `can't change option: zle` without a tty); merging them into
            // stdout risks polluting the marker-sandwiched PATH. DISCARD routes stderr
            // to the OS null sink, so it can neither corrupt the slice nor fill a pipe
            // buffer and block the shell.
            val pb = ProcessBuilder(shell, "-lic", buildShellCommand(marker))
                .redirectError(ProcessBuilder.Redirect.DISCARD)
            val proc = pb.start()
            val output = proc.inputStream.bufferedReader().use { it.readText() }
            val finished = proc.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            if (!finished) {
                proc.destroyForcibly()
                logger.info("resolveShellPath: $shell timed out after ${TIMEOUT_SECONDS}s")
                return null
            }
            val path = extractBetweenMarkers(output, marker)
            if (looksLikePath(path)) {
                logger.info("resolveShellPath: $shell -> ${path!!.split(":").size} entries")
                path
            } else {
                logger.info("resolveShellPath: $shell returned empty/invalid PATH")
                null
            }
        } catch (e: Exception) {
            logger.info("resolveShellPath: $shell failed: ${e.message}")
            null
        }
    }

    /** Clear the per-shell cache (for tests / settings changes). */
    @Synchronized
    fun clearCache() = cache.clear()

    // ─── Pure helpers (unit-tested) ─────────────────────────────────

    /** The shell command that prints the marker-wrapped PATH. */
    fun buildShellCommand(marker: String): String =
        "printf '$marker'; command printenv PATH; printf '$marker'"

    /**
     * Slice the text between the first pair of [marker] occurrences and trim it.
     * Returns null when fewer than two markers are present.
     */
    fun extractBetweenMarkers(output: String, marker: String): String? {
        val escaped = Regex.escape(marker)
        val match = Regex("$escaped([\\s\\S]*?)$escaped").find(output) ?: return null
        return match.groupValues[1].trim()
    }

    /** A real PATH has at least one separator; reject blank / single-entry noise. */
    fun looksLikePath(value: String?): Boolean =
        !value.isNullOrBlank() && value.contains(":")

    /**
     * Merge the captured [shellPath] (which carries nvm/fnm/etc.) ahead of [basePath]
     * (the IDE-inherited PATH), de-duplicating and preserving first-seen order. Shell
     * entries win so version-manager binaries take precedence; the base survives as a
     * fallback when capture failed. [separator] is the platform path separator.
     */
    fun mergePaths(shellPath: String?, basePath: String, separator: String): String {
        val seen = LinkedHashSet<String>()
        (shellPath.orEmpty().split(separator) + basePath.split(separator))
            .filter { it.isNotEmpty() }
            .forEach { seen.add(it) }
        return seen.joinToString(separator)
    }
}
