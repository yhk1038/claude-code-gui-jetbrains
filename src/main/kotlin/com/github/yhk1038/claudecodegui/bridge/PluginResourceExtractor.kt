package com.github.yhk1038.claudecodegui.bridge

import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.application.PathManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.extensions.PluginId
import java.io.File
import java.nio.channels.FileChannel
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.util.UUID

/** Final on-disk locations the backend serves from. */
data class ExtractedResources(val webviewDir: File, val backendFile: File)

/**
 * Extracts the plugin's bundled `webview/` static files and `backend.mjs` from the
 * plugin JAR into a **version-scoped** directory, at most once per
 * (IDE product, plugin version). Replaces the previous per-project-root extraction
 * in [NodeProcessManager] that caused issue #149.
 *
 * ## Why version-scoped, extract-once, never-delete-on-exit (issues #57, #120, #149)
 *
 * The bundle content depends only on the plugin *version* (same version → identical
 * `index.html`/`assets/`/`backend.mjs`), never on the project root. The old code keyed
 * the temp dir on `project.basePath.hashCode()` and re-extracted (delete + unpack) on
 * every backend spawn, then deleted the dir on process exit (#120). Because the path
 * was deterministic per root, successive backend *generations* shared it, so an old
 * generation's exit-cleanup deleted the dir a new generation was actively serving →
 * HTTP 404 `Not found` (#149).
 *
 * This extractor removes all three failure modes at once:
 *  - **Key = plugin version** under [baseDir]: every project root shares one dir, so no
 *    per-root duplication and no per-root accumulation (#120).
 *  - **Extract once, skip if present**: no destructive re-extraction of a live dir (#57).
 *  - **Never delete on process exit**: nothing races a serving dir (#149). Stale *other
 *    version* dirs are pruned right after a successful extraction instead.
 *
 * ## Concurrency & atomicity
 *
 * Two IDEs (or two instances) on the same [baseDir] can extract the same version
 * concurrently. A `.lock` file ([FileChannel.tryLock]) serializes the first extraction,
 * and the unpack happens into a sibling `.tmp-<uuid>` dir under the *same parent* as the
 * final dir (guaranteeing the same volume) before an atomic rename. The hashed-bundle
 * verification runs on the temp dir **before** the rename, so the final version dir only
 * ever appears complete. `ATOMIC_MOVE` falls back to a non-atomic replace when the
 * platform/filesystem rejects it (the extraction gate means no one reads mid-rename).
 *
 * Dev mode (running from the source tree) returns the source `webview/dist` and
 * `backend/dist/backend.mjs` directly and never extracts — the version-key scheme
 * applies to production JAR extraction only.
 */
class PluginResourceExtractor(
    /** Parent dir holding the per-version subdirectories. Injectable for tests. */
    private val baseDir: File = defaultBaseDir(),
    /** Plugin version = the version-scope key. Injectable for tests. */
    private val version: String = defaultVersion(),
    /** Classloader anchor used to read bundled resources. Injectable for tests. */
    private val resourceAnchor: Class<*> = PluginResourceExtractor::class.java,
    /**
     * Performs the actual unpack into the given (webviewTarget, backendDirTarget).
     * Defaults to JAR/classpath extraction; tests inject a fake to exercise the
     * skip/lock/rename/prune orchestration without a real JAR.
     */
    private val unpack: ((webviewTarget: File, backendDirTarget: File) -> Unit)? = null,
) {
    private val logger = Logger.getInstance(PluginResourceExtractor::class.java)

    /**
     * Resolve the served resource locations, extracting on first use for this version.
     * Blocking (filesystem + JAR IO) — callers MUST run this off the EDT.
     */
    fun resolve(): ExtractedResources {
        resolveDevResources()?.let {
            logger.info("Using dev source-tree resources: webview=${it.webviewDir}, backend=${it.backendFile}")
            return it
        }
        return resolveProductionResources()
    }

    // ── Production: version-scoped extract-once ─────────────────────────────

    private fun resolveProductionResources(): ExtractedResources {
        val versionDir = File(baseDir, version)
        val result = ExtractedResources(
            webviewDir = File(versionDir, WEBVIEW_SUBDIR),
            backendFile = File(File(versionDir, BACKEND_SUBDIR), BACKEND_ENTRY),
        )

        if (isComplete(result)) {
            pruneOtherVersions()
            return result
        }

        baseDir.mkdirs()
        withBaseLock {
            // Re-check under the lock: another process may have completed the
            // extraction while we waited for the lock.
            if (!isComplete(result)) {
                extractVersion(versionDir, result)
            }
        }
        pruneOtherVersions()
        return result
    }

    /** A version dir counts as complete only when both the hashed JS bundle and backend.mjs exist. */
    private fun isComplete(r: ExtractedResources): Boolean =
        hasHashedBundle(r.webviewDir) && r.backendFile.isFile

    private fun hasHashedBundle(webviewDir: File): Boolean {
        val assets = File(webviewDir, "assets")
        return assets.isDirectory &&
            assets.listFiles()?.any { it.name.startsWith("index-") && it.name.endsWith(".js") } == true
    }

    /**
     * Unpack into a sibling temp dir under [baseDir] (same volume → atomic rename works),
     * verify, then rename into place. Any pre-existing partial [versionDir] is removed
     * first so the rename target is absent (required for a POSIX/Windows atomic rename).
     */
    private fun extractVersion(versionDir: File, expected: ExtractedResources) {
        val tmp = File(baseDir, ".tmp-${UUID.randomUUID()}")
        try {
            tmp.deleteRecursively()
            val tmpWebview = File(tmp, WEBVIEW_SUBDIR)
            val tmpBackendDir = File(tmp, BACKEND_SUBDIR)
            tmpWebview.mkdirs()
            tmpBackendDir.mkdirs()

            (unpack ?: ::extractFromPluginJar).invoke(tmpWebview, tmpBackendDir)

            // Verify BEFORE renaming so the final version dir never appears incomplete.
            val tmpResult = ExtractedResources(tmpWebview, File(tmpBackendDir, BACKEND_ENTRY))
            if (!isComplete(tmpResult)) {
                throw IllegalStateException(
                    "Incomplete extraction (hashedBundle=${hasHashedBundle(tmpWebview)}, " +
                        "backend=${tmpResult.backendFile.exists()}) into $tmp"
                )
            }

            // Remove any stale partial target, then atomically move temp → final.
            versionDir.deleteRecursively()
            versionDir.parentFile?.mkdirs()
            moveIntoPlace(tmp, versionDir)
            logger.info("Extracted plugin resources for version $version → $versionDir")
        } finally {
            // If the move succeeded, tmp no longer exists; otherwise clean the partial.
            tmp.deleteRecursively()
        }
    }

    /** Atomic rename with a non-atomic fallback for cross-filesystem / Windows edge cases. */
    private fun moveIntoPlace(src: File, dst: File) {
        try {
            Files.move(src.toPath(), dst.toPath(), StandardCopyOption.ATOMIC_MOVE)
        } catch (e: AtomicMoveNotSupportedException) {
            logger.warn("ATOMIC_MOVE unsupported ($src → $dst); falling back to non-atomic move", e)
            // The extraction gate guarantees no backend reads $dst until resolve() returns,
            // so a brief non-atomic window is safe here.
            Files.move(src.toPath(), dst.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }

    /**
     * Delete sibling version dirs that are NOT the current version. Best-effort: a dir
     * still locked by another running process (e.g. Windows holding backend.mjs) is left
     * for the next run. The current version dir is never touched (issue #149 / E1).
     */
    private fun pruneOtherVersions() {
        val siblings = baseDir.listFiles() ?: return
        for (dir in siblings) {
            if (!dir.isDirectory) continue
            if (dir.name == version) continue
            if (dir.name.startsWith(".tmp-") || dir.name == LOCK_NAME) continue
            val ok = dir.deleteRecursively()
            if (ok) logger.info("Pruned stale plugin-resource version dir: ${dir.name}")
            else logger.debug("Could not prune ${dir.name} (in use?); leaving for next run")
        }
    }

    /** Serialize first-time extraction across processes via a lock file under [baseDir]. */
    private fun <T> withBaseLock(block: () -> T): T {
        val lockFile = File(baseDir, LOCK_NAME)
        FileChannel.open(
            lockFile.toPath(),
            StandardOpenOption.CREATE,
            StandardOpenOption.WRITE,
        ).use { channel ->
            channel.lock().use { return block() }
        }
    }

    // ── Production: JAR / classpath extraction (ported from NodeProcessManager) ──

    private fun extractFromPluginJar(webviewTarget: File, backendDirTarget: File) {
        extractBackend(backendDirTarget)
        extractWebview(webviewTarget)
    }

    private fun extractBackend(backendDirTarget: File) {
        val stream = resourceAnchor.getResourceAsStream("/backend/$BACKEND_ENTRY")
            ?: throw IllegalStateException("Backend resource /backend/$BACKEND_ENTRY not found in plugin")
        val target = File(backendDirTarget, BACKEND_ENTRY)
        target.parentFile?.mkdirs()
        stream.use { input -> target.outputStream().use { input.copyTo(it) } }
    }

    private fun extractWebview(webviewTarget: File) {
        val webviewJar = locateWebviewJar()
        if (webviewJar != null) {
            extractWebviewFromJar(webviewTarget, webviewJar)
            return
        }
        // Dev / IDE runtime: resources live on the filesystem, not in a JAR.
        val webviewUrl = resourceAnchor.getResource("/webview/")
        if (webviewUrl != null && webviewUrl.protocol == "file") {
            try {
                val dir = File(webviewUrl.toURI())
                if (dir.isDirectory) {
                    dir.walkTopDown().filter { it.isFile }.forEach { file ->
                        val rel = file.relativeTo(dir).path
                        val out = File(webviewTarget, rel)
                        out.parentFile?.mkdirs()
                        file.inputStream().use { input -> out.outputStream().use { input.copyTo(it) } }
                    }
                    return
                }
            } catch (e: Exception) {
                logger.debug("Dynamic webview scan failed, falling back to known resources: ${e.message}")
            }
        }
        // Fallback: extract known top-level resources + assets individually.
        for (resource in KNOWN_WEBVIEW_RESOURCES) {
            resourceAnchor.getResourceAsStream("/webview/$resource")?.let { stream ->
                val out = File(webviewTarget, resource)
                out.parentFile?.mkdirs()
                stream.use { input -> out.outputStream().use { input.copyTo(it) } }
            }
        }
        extractAssetsFromClasspath(webviewTarget)
    }

    /**
     * Locate the plugin JAR shipping `/webview/`. Anchored on a *file* resource
     * (`index.html`) rather than the `/webview/` directory: IntelliJ's PluginClassLoader
     * reliably resolves file resources to `jar:` URLs but not directory resources (#52).
     */
    private fun locateWebviewJar(): File? {
        val fileUrl = resourceAnchor.getResource("/webview/index.html") ?: return null
        if (fileUrl.protocol != "jar") return null
        return try {
            val connection = fileUrl.openConnection() as? java.net.JarURLConnection ?: return null
            val jar = File(connection.jarFileURL.toURI())
            if (jar.isFile) jar else null
        } catch (e: Exception) {
            logger.debug("Could not resolve webview JAR from $fileUrl: ${e.message}")
            null
        }
    }

    private fun extractWebviewFromJar(targetDir: File, jarFile: File) {
        var count = 0
        java.util.jar.JarFile(jarFile).use { jar ->
            val entries = jar.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                if (!entry.name.startsWith("webview/") || entry.isDirectory) continue
                val rel = entry.name.removePrefix("webview/")
                val out = File(targetDir, rel)
                out.parentFile?.mkdirs()
                jar.getInputStream(entry).use { input -> out.outputStream().use { input.copyTo(it) } }
                count++
            }
        }
        logger.info("Extracted $count webview entries from JAR: ${jarFile.absolutePath}")
    }

    private fun extractAssetsFromClasspath(targetDir: File) {
        val assetsUrl = resourceAnchor.getResource("/webview/assets/")
        if (assetsUrl != null && assetsUrl.protocol == "file") {
            try {
                val assetsDir = File(assetsUrl.toURI())
                if (assetsDir.isDirectory) {
                    assetsDir.listFiles()?.forEach { file ->
                        if (file.isFile) {
                            val out = File(targetDir, "assets/${file.name}")
                            out.parentFile?.mkdirs()
                            file.inputStream().use { input -> out.outputStream().use { input.copyTo(it) } }
                        }
                    }
                    return
                }
            } catch (e: Exception) {
                logger.debug("Assets scan failed, falling back to known assets: ${e.message}")
            }
        }
        for (asset in KNOWN_ASSETS) {
            resourceAnchor.getResourceAsStream("/webview/$asset")?.let { stream ->
                val out = File(targetDir, asset)
                out.parentFile?.mkdirs()
                stream.use { input -> out.outputStream().use { input.copyTo(it) } }
            }
        }
    }

    // ── Dev mode: source-tree resources (no extraction) ─────────────────────

    private fun resolveDevResources(): ExtractedResources? {
        val devMode = System.getProperty("claude.dev.mode", "false").toBoolean() ||
            System.getenv("CLAUDE_DEV_MODE") == "true"
        if (!devMode) return null
        val projectRoot = findPluginProjectRoot() ?: return null
        val devWebview = File(projectRoot, "webview/dist")
        val devBackend = File(projectRoot, "backend/dist/$BACKEND_ENTRY")
        if (!devWebview.exists() || !devBackend.exists()) {
            logger.warn("Dev mode but source-tree resources missing (webview=${devWebview.exists()}, backend=${devBackend.exists()})")
            return null
        }
        return ExtractedResources(devWebview, devBackend)
    }

    private fun findPluginProjectRoot(): File? {
        val cwd = File(System.getProperty("user.dir"))
        if (File(cwd, "backend/dist/$BACKEND_ENTRY").exists()) return cwd
        System.getProperty("plugin.project.root")?.let { root ->
            val f = File(root)
            if (File(f, "backend/dist/$BACKEND_ENTRY").exists()) return f
        }
        System.getenv("PLUGIN_PROJECT_ROOT")?.let { root ->
            val f = File(root)
            if (File(f, "backend/dist/$BACKEND_ENTRY").exists()) return f
        }
        try {
            val classUrl = javaClass.protectionDomain.codeSource?.location?.toURI()
            if (classUrl != null) {
                var dir: File? = File(classUrl).parentFile
                repeat(5) {
                    if (dir != null && File(dir, "backend/dist/$BACKEND_ENTRY").exists()) return dir
                    dir = dir?.parentFile
                }
            }
        } catch (e: Exception) {
            logger.debug("Class location lookup failed: ${e.message}")
        }
        return null
    }

    companion object {
        const val PLUGIN_ID = "com.github.yhk1038.claude-code-gui"
        private const val ROOT_DIR_NAME = "claude-code-gui"
        private const val WEBVIEW_SUBDIR = "webview"
        private const val BACKEND_SUBDIR = "backend"
        private const val BACKEND_ENTRY = "backend.mjs"
        private const val LOCK_NAME = ".lock"

        private val KNOWN_WEBVIEW_RESOURCES = listOf(
            "index.html",
            "favicon.svg",
            "favicon-unread.svg",
            "welcome-art-dark.svg",
            "welcome-art-light.svg",
        )
        private val KNOWN_ASSETS = listOf(
            "assets/index.js",
            "assets/index.css",
            "assets/codicon.ttf",
            "assets/clawd.svg",
            "assets/claude-code-logo.svg",
        )

        /** Version-scoped resource root under the IDE's plugin temp path (per IDE product+version). */
        private fun defaultBaseDir(): File = File(PathManager.getPluginTempPath(), ROOT_DIR_NAME)

        /** Plugin version from the runtime descriptor; the version-scope key. */
        private fun defaultVersion(): String =
            PluginManager.getPlugin(PluginId.getId(PLUGIN_ID))?.version ?: "unknown"
    }
}
