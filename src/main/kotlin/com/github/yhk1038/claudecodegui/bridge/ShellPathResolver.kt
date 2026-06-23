package com.github.yhk1038.claudecodegui.bridge

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.util.SystemInfo
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Captures environment variables from the user's real login + interactive shell.
 *
 * ## Why
 * A GUI-launched IDE (Dock, app icon, Spotlight) starts in a bare environment that
 * never sourced the user's interactive shell config (`.zshrc`/`.bashrc`). Version
 * managers like nvm/fnm/mise add their bin dirs to PATH there, so the IDE's inherited
 * PATH is missing them — and any `node`/`claude` spawned from the IDE can't be found
 * (#59). The same gap hides `CLAUDE_CONFIG_DIR` when a user exports it from their
 * interactive rc to point the Claude CLI at a non-default data dir (#117).
 *
 * Asking the shell itself is the only robust fix: it works for every version manager
 * and every exported variable at once, instead of hard-coding install layouts.
 *
 * ## How
 * Runs `$SHELL -lic "...; command printenv <VAR>; ..."` once, capturing every variable
 * in [CAPTURED_VARS] in a single shell launch:
 * - `-lic` = login + interactive, so both `.zprofile`/`.zlogin` AND `.zshrc` are read.
 * - Each value is sandwiched between a per-variable random-UUID marker pair so we can
 *   slice it out of any startup noise (prompts, banners, `.zshrc` echo) the shell prints.
 * - `command printenv` bypasses user aliases/functions.
 *
 * This mirrors the approach the official Claude Code VS Code extension uses
 * (`resolveShellPath`). Results are cached per shell; Windows is skipped (no POSIX shell).
 */
object ShellPathResolver {

    private val logger = Logger.getInstance(ShellPathResolver::class.java)

    private const val TIMEOUT_SECONDS = 10L

    // Variables captured from the user's shell in one launch. PATH carries
    // version-manager bin dirs (#59); CLAUDE_CONFIG_DIR points the CLI at a custom
    // data directory (#117).
    private val CAPTURED_VARS = listOf("PATH", "CLAUDE_CONFIG_DIR")

    // Cached per shell binary: varName -> captured value. An empty map means
    // resolved-but-failed (don't retry).
    private val cache = HashMap<String, Map<String, String>>()

    /**
     * Capture [CAPTURED_VARS] from the user's shell. Returns an empty map when
     * unavailable (Windows, no $SHELL, or shell failure). Cached per shell binary.
     */
    @Synchronized
    private fun captured(): Map<String, String> {
        if (SystemInfo.isWindows) return emptyMap()
        val shell = System.getenv("SHELL")?.takeIf { it.isNotBlank() } ?: return emptyMap()

        cache[shell]?.let { return it }

        val resolved = runShell(shell, CAPTURED_VARS) ?: emptyMap()
        cache[shell] = resolved
        return resolved
    }

    /**
     * Resolve the user's shell PATH, or null when unavailable or invalid (Windows,
     * no $SHELL, shell failure, single-entry noise).
     */
    fun resolve(): String? = captured()["PATH"]?.takeIf { looksLikePath(it) }

    /**
     * Resolve a single captured env var (e.g. `CLAUDE_CONFIG_DIR`) from the user's
     * shell, or null when it is unset/blank or capture was unavailable.
     */
    fun resolveEnvVar(name: String): String? = captured()[name]?.takeIf { it.isNotBlank() }

    /** Launch the shell once and capture [vars]. Returns null on any failure. */
    private fun runShell(shell: String, vars: List<String>): Map<String, String>? {
        val marker = UUID.randomUUID().toString().replace("-", "")
        return try {
            // Capture stdout ONLY. An interactive shell can write warnings to stderr
            // (e.g. zsh's `can't change option: zle` without a tty); merging them into
            // stdout risks polluting the marker-sandwiched values. DISCARD routes stderr
            // to the OS null sink, so it can neither corrupt the slice nor fill a pipe
            // buffer and block the shell.
            val pb = ProcessBuilder(shell, "-lic", buildShellCommand(marker, vars))
                .redirectError(ProcessBuilder.Redirect.DISCARD)
            val proc = pb.start()
            val output = proc.inputStream.bufferedReader().use { it.readText() }
            val finished = proc.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            if (!finished) {
                proc.destroyForcibly()
                logger.info("resolveShellEnv: $shell timed out after ${TIMEOUT_SECONDS}s")
                return null
            }
            val result = HashMap<String, String>()
            for (name in vars) {
                val value = extractBetweenMarkers(output, markerFor(marker, name)) ?: continue
                if (value.isNotEmpty()) result[name] = value
            }
            logger.info("resolveShellEnv: $shell -> captured ${result.keys}")
            result
        } catch (e: Exception) {
            logger.info("resolveShellEnv: $shell failed: ${e.message}")
            null
        }
    }

    /** Clear the per-shell cache (for tests / settings changes). */
    @Synchronized
    fun clearCache() = cache.clear()

    // ─── Pure helpers (unit-tested) ─────────────────────────────────

    /**
     * The shell command that prints each variable in [vars] wrapped in its own
     * per-variable marker pair (see [markerFor]).
     */
    fun buildShellCommand(marker: String, vars: List<String>): String =
        vars.joinToString("; ") { name ->
            val m = markerFor(marker, name)
            "printf '$m'; command printenv $name; printf '$m'"
        }

    /**
     * A marker unique to [varName], so concurrently-captured values never collide:
     * the variable name is sandwiched inside the base [marker]. Variable names are
     * shell identifiers (alphanumeric + `_`), so the result is regex/printf-safe.
     */
    fun markerFor(marker: String, varName: String): String = "$marker$varName$marker"

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
