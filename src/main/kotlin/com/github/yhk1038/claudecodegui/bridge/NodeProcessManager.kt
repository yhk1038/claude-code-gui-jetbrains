package com.github.yhk1038.claudecodegui.bridge

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.util.SystemInfo
import com.intellij.util.EnvironmentUtil
import com.github.yhk1038.claudecodegui.settings.SettingsManager
import kotlinx.coroutines.*
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

/**
 * Manages the Node.js backend process lifecycle.
 *
 * Responsibilities:
 * 1. Find the `node` executable on PATH or well-known locations
 * 2. Locate the backend entry file (dev: project-relative, prod: extracted from JAR)
 * 3. Extract WebView static resources for the WEBVIEW_DIR env var
 * 4. Spawn `node backend.mjs` with correct env vars
 * 5. Read the first stdout line `PORT:{n}\n` -> expose via [port] Deferred
 * 6. Forward stderr to IDE logger
 * 7. Gracefully terminate the process on dispose
 *
 * JSON-RPC dispatch is handled by [RpcWebSocketClient] via WebSocket /rpc endpoint.
 */
class NodeProcessManager(
    private val scope: CoroutineScope
) : Disposable {

    private val logger = Logger.getInstance(NodeProcessManager::class.java)

    // Server port (fulfilled once the backend prints PORT:{n})
    private val _portDeferred = CompletableDeferred<Int>()
    val port: Deferred<Int> = _portDeferred

    private var process: Process? = null
    private var stdoutJob: Job? = null
    private var stderrJob: Job? = null

    /**
     * Lifecycle of the managed process. [start] runs asynchronously, so for a window
     * after start() returns the OS process does not yet exist and [isAlive] is false.
     * Distinguishing STARTING from DEAD prevents callers (NodeBackendService.ensureStarted)
     * from mistaking a still-spawning backend for a dead one and racing a second spawn —
     * which collides on the port and triggers the port-reclaim kill path. See issue: the
     * duplicate spawn was the trigger behind the IDE-killing EADDRINUSE storm.
     */
    enum class Lifecycle { STARTING, RUNNING, DEAD }

    @Volatile
    private var lifecycle = Lifecycle.STARTING

    /** True only once the process has actually started and later exited (or failed to start). */
    val isDead: Boolean
        get() = lifecycle == Lifecycle.DEAD

    /**
     * Handler interface for JSON-RPC requests coming from the Node.js backend.
     * The Node.js backend calls these when it needs IDE-native functionality.
     */
    interface RpcHandler {
        suspend fun openFile(path: String)
        suspend fun openDiff(filePath: String, oldContent: String, newContent: String, toolUseId: String?)
        suspend fun applyDiff(filePath: String, newContent: String, toolUseId: String?): Boolean
        suspend fun rejectDiff(toolUseId: String?)
        suspend fun refreshFiles(paths: List<String>)
        suspend fun createSession(workingDir: String)
        suspend fun openNewTab(workingDir: String)
        suspend fun openSettings(workingDir: String)
        suspend fun openTerminal(workingDir: String)
        suspend fun openUrl(url: String)
        suspend fun pickFiles(mode: String, multiple: Boolean): List<String>
        suspend fun updatePlugin()
        suspend fun requiresRestart(): Boolean
    }

    /**
     * Start the Node.js backend process.
     */
    fun start() {
        // Everything here — node discovery, shell PATH capture, backend extraction —
        // can block for seconds (the `$SHELL -lic` capture is bounded only by a 10s
        // timeout). It must NOT run on the caller's thread (EDT): start() is reached
        // synchronously from tool-window content creation, so a blocking call here
        // would freeze the IDE UI. Run the whole thing on Dispatchers.IO.
        scope.launch(Dispatchers.IO) {
            val nodePath = findNodeExecutable()
            if (nodePath == null) {
                logger.error(
                    "Node.js executable not found. The plugin searched PATH and common install " +
                        "locations (nvm, volta, fnm, Homebrew) but found nothing.\n" +
                        "How to fix:\n" +
                        "  1. Install Node.js, or make sure 'node' is on your PATH.\n" +
                        "  2. If you use nvm, run 'nvm alias default <version>' so a default is set.\n" +
                        "  3. Or set the NODE_PATH_OVERRIDE environment variable to your node binary " +
                        "(e.g. ~/.nvm/versions/node/v24.16.0/bin/node)."
                )
                lifecycle = Lifecycle.DEAD
                _portDeferred.completeExceptionally(
                    IllegalStateException("Node.js executable not found")
                )
                return@launch
            }

            val backendFile = findBackendFile()
            if (backendFile == null) {
                logger.error("Backend entry file (backend.mjs) not found.")
                lifecycle = Lifecycle.DEAD
                _portDeferred.completeExceptionally(
                    IllegalStateException("Backend entry file not found")
                )
                return@launch
            }

            val webviewDir = extractWebviewResources()

            logger.info("Starting Node.js backend: node=$nodePath, backend=${backendFile.absolutePath}, webviewDir=${webviewDir?.absolutePath}")

            try {
                val env = buildMap {
                    putAll(EnvironmentUtil.getEnvironmentMap())
                    put("JETBRAINS_MODE", "true")
                    // Hand the backend the user's real shell PATH so anything it spawns
                    // (claude, npx, git) is found even when the IDE started from GUI (#59).
                    put("PATH", effectivePath())
                    if (webviewDir != null) {
                        put("WEBVIEW_DIR", webviewDir.absolutePath)
                    }
                    // PROJECT_DIR removed — workingDir is passed via WebSocket message
                }

                val pb = ProcessBuilder(nodePath, backendFile.absolutePath)
                    .directory(backendFile.parentFile)
                    .redirectErrorStream(false)

                pb.environment().clear()
                pb.environment().putAll(env)

                val proc = pb.start()
                process = proc
                lifecycle = Lifecycle.RUNNING

                // Read stdout: first line is PORT, rest are logged
                stdoutJob = scope.launch(Dispatchers.IO) {
                    val reader = BufferedReader(InputStreamReader(proc.inputStream, Charsets.UTF_8))
                    try {
                        readStdout(reader)
                    } catch (e: CancellationException) {
                        // Normal shutdown
                    } catch (e: Exception) {
                        logger.error("Error reading Node.js stdout", e)
                        if (!_portDeferred.isCompleted) {
                            _portDeferred.completeExceptionally(e)
                        }
                    }
                }

                // Read stderr -> IDE log
                stderrJob = scope.launch(Dispatchers.IO) {
                    val reader = BufferedReader(InputStreamReader(proc.errorStream, Charsets.UTF_8))
                    try {
                        readStderr(reader)
                    } catch (e: CancellationException) {
                        // Normal shutdown
                    } catch (e: Exception) {
                        logger.warn("Error reading Node.js stderr", e)
                    }
                }

                // Wait for process to exit and log the result
                val exitCode = proc.waitFor()
                lifecycle = Lifecycle.DEAD
                logger.info("Node.js backend exited with code $exitCode")

                if (!_portDeferred.isCompleted) {
                    _portDeferred.completeExceptionally(
                        IllegalStateException("Node.js process exited before printing PORT (exit code: $exitCode)")
                    )
                }
            } catch (e: CancellationException) {
                // Normal shutdown
            } catch (e: Exception) {
                lifecycle = Lifecycle.DEAD
                logger.error("Failed to start Node.js backend", e)
                if (!_portDeferred.isCompleted) {
                    _portDeferred.completeExceptionally(e)
                }
            }
        }
    }

    /**
     * Read stdout line by line.
     * First line: PORT:{n}
     * Subsequent lines are logged (JSON-RPC is now handled via WebSocket /rpc).
     */
    private fun readStdout(reader: BufferedReader) {
        var portRead = false

        while (true) {
            val line = reader.readLine() ?: break // EOF

            if (!portRead) {
                // Expect first line to be PORT:{n}
                if (line.startsWith("PORT:")) {
                    val portStr = line.removePrefix("PORT:").trim()
                    val portNum = portStr.toIntOrNull()
                    if (portNum != null) {
                        logger.info("Node.js backend listening on port $portNum")
                        _portDeferred.complete(portNum)
                        portRead = true
                    } else {
                        logger.error("Invalid PORT line from Node.js backend: $line")
                        _portDeferred.completeExceptionally(
                            IllegalStateException("Invalid PORT line: $line")
                        )
                        return
                    }
                } else {
                    // Not a PORT line — might be debug output before PORT
                    logger.info("[Node.js pre-PORT] $line")
                }
                continue
            }

            // After PORT is read, log any subsequent stdout lines
            if (line.isBlank()) continue
            logger.info("[Node.js stdout] $line")
        }
    }

    /**
     * Read stderr and forward to IDE log.
     */
    private fun readStderr(reader: BufferedReader) {
        while (true) {
            val line = reader.readLine() ?: break
            if (line.isNotBlank()) {
                System.err.println("[Node.js] $line")
                logger.info("[Node.js] $line")
            }
        }
    }

    // ─── Node.js / Backend file discovery ───────────────────────────

    /**
     * The PATH to use for `node` discovery and the backend process: the user's real
     * shell PATH (captured via [ShellPathResolver], carries nvm/fnm/etc.) merged ahead
     * of the IDE-inherited PATH. The merge keeps the inherited PATH as a fallback when
     * shell capture fails (no $SHELL, Windows, timeout). Computed once per backend start.
     */
    private val effectivePathValue: String by lazy {
        val basePath = EnvironmentUtil.getEnvironmentMap()["PATH"] ?: System.getenv("PATH") ?: ""
        ShellPathResolver.mergePaths(ShellPathResolver.resolve(), basePath, File.pathSeparator)
    }

    private fun effectivePath(): String = effectivePathValue

    /**
     * Find the `node` executable.
     * Tries:
     * 1. `which node` (PATH-based)
     * 2. Well-known locations (nvm, volta, fnm, homebrew, etc.)
     */
    private fun findNodeExecutable(): String? {
        // 0. User-configured override from settings (highest priority — #22).
        //    Read straight from ~/.claude-code-gui/settings.js: this runs BEFORE the
        //    backend is spawned, so we can't ask the backend. SettingsManager reads
        //    the file synchronously and findNodeExecutable already runs off the EDT.
        //    Lets users on `n`/`nvm` pin an exact node when PATH holds an incompatible
        //    one, and provides a recovery path that survives a non-bootable backend.
        NodeExecutableResolver.normalizeConfiguredNodePath(
            SettingsManager.getInstance().get("nodePath")?.jsonPrimitive?.contentOrNull
        )?.let { configured ->
            val file = File(configured)
            if (file.exists() && file.canExecute()) {
                logger.info("Found node via settings nodePath: $configured")
                return configured
            }
            logger.warn("Configured nodePath is not an executable file, ignoring: $configured")
        }

        // 1. Environment variable override
        System.getenv("NODE_PATH_OVERRIDE")?.let { envPath ->
            if (File(envPath).exists() && File(envPath).canExecute()) {
                logger.info("Found node via NODE_PATH_OVERRIDE: $envPath")
                return envPath
            }
        }

        // 2. PATH lookup via shell command (effectivePath captures the user's real
        //    shell PATH so the lookup succeeds even when the IDE is launched from GUI)
        try {
            val command = if (SystemInfo.isWindows) arrayOf("cmd", "/c", "where", "node") else arrayOf("which", "node")
            val pb = ProcessBuilder(*command).redirectErrorStream(true)
            // Inject shell-aware PATH so lookup succeeds even when IDE is launched from GUI
            pb.environment()["PATH"] = effectivePath()
            val proc = pb.start()
            val output = proc.inputStream.bufferedReader().readText().trim()
            val exitCode = proc.waitFor()
            // `where` on Windows may return multiple lines; take the first
            val firstLine = output.lines().firstOrNull()?.trim().orEmpty()
            if (exitCode == 0 && firstLine.isNotBlank() && File(firstLine).exists()) {
                logger.info("Found node in PATH: $firstLine")
                return firstLine
            }
        } catch (e: Exception) {
            logger.debug("PATH lookup for node failed: ${e.message}")
        }

        // 3. Well-known locations
        val wellKnownPaths = if (SystemInfo.isWindows) {
            val appData = System.getenv("APPDATA") ?: ""
            val programFiles = System.getenv("ProgramFiles") ?: "C:\\Program Files"
            val localAppData = System.getenv("LOCALAPPDATA") ?: ""
            listOf(
                "$programFiles\\nodejs\\node.exe",
                "$appData\\nvm\\current\\node.exe",
                "$localAppData\\volta\\bin\\node.exe",
                "$localAppData\\fnm\\aliases\\default\\bin\\node.exe",
            )
        } else {
            val home = System.getenv("HOME") ?: return null
            buildList {
                add("/usr/local/bin/node")
                add("/opt/homebrew/bin/node")
                // nvm has NO `current` symlink — scan ~/.nvm/versions/node/ and honour
                // the default alias instead, otherwise nvm users are never matched (#59).
                findNvmNode(home)?.let { add(it) }
                add("$home/.volta/bin/node")
                add("$home/.fnm/aliases/default/bin/node")
                add("$home/.local/bin/node")
                add("/usr/bin/node")
            }
        }

        wellKnownPaths.firstOrNull { File(it).exists() && File(it).canExecute() }?.let { found ->
            logger.info("Found node at well-known location: $found")
            return found
        }

        logger.warn("Node.js executable not found")
        return null
    }

    /**
     * Resolve the nvm-managed `node` binary by scanning `~/.nvm/versions/node/` and
     * honouring `~/.nvm/alias/default`. nvm does not maintain a `current` symlink, so a
     * static well-known path can never find it — the directory must be scanned (#59).
     *
     * Version-selection policy lives in [NodeExecutableResolver]; this method only does
     * the filesystem glue.
     */
    private fun findNvmNode(home: String): String? {
        val versionsDir = File(home, ".nvm/versions/node")
        if (!versionsDir.isDirectory) return null

        val installed = versionsDir.listFiles { f -> f.isDirectory }?.map { it.name } ?: return null
        if (installed.isEmpty()) return null

        val defaultAlias = File(home, ".nvm/alias/default")
            .takeIf { it.isFile }
            ?.readText()

        val chosen = NodeExecutableResolver.selectNvmVersion(installed, defaultAlias) ?: return null
        val nodePath = File(versionsDir, "$chosen/bin/node")
        return if (nodePath.exists() && nodePath.canExecute()) {
            logger.info("Found node via nvm scan: ${nodePath.absolutePath} (alias=${defaultAlias?.trim()})")
            nodePath.absolutePath
        } else {
            null
        }
    }

    /**
     * Find the backend entry file.
     *
     * Dev mode: look for `backend/dist/backend.mjs` relative to project root.
     * Production: extract from JAR resource `/backend/backend.mjs` to temp directory.
     */
    private fun findBackendFile(): File? {
        val devMode = System.getProperty("claude.dev.mode", "false").toBoolean() ||
                System.getenv("CLAUDE_DEV_MODE") == "true"

        if (devMode) {
            // Dev mode: look in project's backend/dist/
            val projectRoot = findPluginProjectRoot()
            if (projectRoot != null) {
                val devBackend = File(projectRoot, "backend/dist/backend.mjs")
                if (devBackend.exists()) {
                    logger.info("Using dev backend: ${devBackend.absolutePath}")
                    return devBackend
                }
                logger.warn("Dev mode but backend not found at: ${devBackend.absolutePath}")
            }
        }

        // Production: extract from JAR
        return extractBackendFromJar()
    }

    /**
     * Try to find the plugin project root by looking for build.gradle.kts
     * up from the classpath or using project basePath heuristics.
     */
    private fun findPluginProjectRoot(): File? {
        // Heuristic 1: Check if we're running from Gradle runIde (common dev scenario)
        // The working directory is often the project root in that case
        val cwd = File(System.getProperty("user.dir"))
        if (File(cwd, "backend/dist/backend.mjs").exists()) {
            return cwd
        }

        // Heuristic 2: Check system property (set by runIde task in build.gradle.kts)
        System.getProperty("plugin.project.root")?.let { root ->
            val rootFile = File(root)
            if (rootFile.exists() && File(rootFile, "backend/dist/backend.mjs").exists()) {
                return rootFile
            }
        }

        // Heuristic 3: Check environment variable (manual override)
        System.getenv("PLUGIN_PROJECT_ROOT")?.let { root ->
            val rootFile = File(root)
            if (rootFile.exists() && File(rootFile, "backend/dist/backend.mjs").exists()) {
                return rootFile
            }
        }

        // Heuristic 4: Walk up from class location
        try {
            val classUrl = javaClass.protectionDomain.codeSource?.location?.toURI()
            if (classUrl != null) {
                var dir = File(classUrl).parentFile
                repeat(5) {
                    if (dir != null && File(dir, "backend/dist/backend.mjs").exists()) {
                        return dir
                    }
                    dir = dir?.parentFile
                }
            }
        } catch (e: Exception) {
            logger.debug("Class location lookup failed: ${e.message}")
        }

        return null
    }

    /**
     * Extract backend.mjs from JAR resources to a temp directory.
     */
    private fun extractBackendFromJar(): File? {
        return try {
            val tempDir = File(System.getProperty("java.io.tmpdir"), "claude-code-backend")

            // Always re-extract for latest version
            if (tempDir.exists()) {
                tempDir.deleteRecursively()
            }
            tempDir.mkdirs()

            // Try to extract backend.mjs from /backend/ resource path
            val backendStream = javaClass.getResourceAsStream("/backend/backend.mjs")
            if (backendStream != null) {
                val targetFile = File(tempDir, "backend.mjs")
                backendStream.use { input ->
                    targetFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
                logger.info("Extracted backend.mjs to: ${targetFile.absolutePath}")
                return targetFile
            }

            logger.warn("Backend resource /backend/backend.mjs not found in JAR")
            null
        } catch (e: Exception) {
            logger.error("Failed to extract backend from JAR", e)
            null
        }
    }

    /**
     * Extract WebView static resources for the Node.js backend to serve.
     *
     * Dev mode: return the webview dist directory directly (Vite build output).
     * Production: extract from JAR /webview/ to temp directory.
     */
    private fun extractWebviewResources(): File? {
        val devMode = System.getProperty("claude.dev.mode", "false").toBoolean() ||
                System.getenv("CLAUDE_DEV_MODE") == "true"

        if (devMode) {
            val projectRoot = findPluginProjectRoot()
            if (projectRoot != null) {
                val devWebview = File(projectRoot, "webview/dist")
                if (devWebview.exists()) {
                    logger.info("Using dev webview dir: ${devWebview.absolutePath}")
                    return devWebview
                }
            }
        }

        // Production: extract from JAR
        return try {
            val tempDir = File(System.getProperty("java.io.tmpdir"), "claude-code-webview")

            if (tempDir.exists()) {
                tempDir.deleteRecursively()
            }
            tempDir.mkdirs()

            // Production: locate the plugin JAR that ships /webview/ and extract it
            // recursively. Do NOT gate this on getResource("/webview/"): IntelliJ's
            // PluginClassLoader does not reliably resolve *directory* resource URLs, so
            // that check silently fell through to the dev/runtime fallback below and left
            // assets/ unextracted — every asset 404s and the panel renders blank (#52).
            val webviewJar = locateWebviewJar()
            if (webviewJar != null) {
                extractFromJar(tempDir, webviewJar)
            } else {
                // Dev / IDE runtime: resources live on the filesystem, not in a JAR.
                val webviewUrl = javaClass.getResource("/webview/")
                // IDE runtime — try dynamic scanning of /webview/ directory first
                var dynamicScanSucceeded = false
                if (webviewUrl != null && webviewUrl.protocol == "file") {
                    try {
                        val webviewDir = File(webviewUrl.toURI())
                        if (webviewDir.isDirectory) {
                            webviewDir.walkTopDown().filter { it.isFile }.forEach { file ->
                                val relativePath = file.relativeTo(webviewDir).path
                                val targetFile = File(tempDir, relativePath)
                                targetFile.parentFile?.mkdirs()
                                file.inputStream().use { input ->
                                    targetFile.outputStream().use { output ->
                                        input.copyTo(output)
                                    }
                                }
                                logger.debug("Extracted (scanned): $relativePath")
                            }
                            logger.info("Dynamically scanned and extracted all webview resources")
                            dynamicScanSucceeded = true
                        }
                    } catch (e: Exception) {
                        logger.debug("Dynamic webview scanning failed, falling back to known resources: ${e.message}")
                    }
                }

                if (!dynamicScanSucceeded) {
                    // Fallback: extract known resources individually
                    val resources = listOf(
                        "index.html",
                        "favicon.svg",
                        "favicon-unread.svg",
                        "welcome-art-dark.svg",
                        "welcome-art-light.svg"
                    )

                    for (resource in resources) {
                        val inputStream = javaClass.getResourceAsStream("/webview/$resource")
                        if (inputStream != null) {
                            val targetFile = File(tempDir, resource)
                            targetFile.parentFile?.mkdirs()
                            inputStream.use { input ->
                                targetFile.outputStream().use { output ->
                                    input.copyTo(output)
                                }
                            }
                            logger.debug("Extracted: $resource")
                        }
                    }

                    // Also try to extract assets/ directory entries
                    extractAssetsFromClasspath(tempDir)
                }
            }

            logger.info("Extracted WebView resources to: ${tempDir.absolutePath}")
            tempDir
        } catch (e: Exception) {
            logger.error("Failed to extract WebView resources", e)
            null
        }
    }

    /**
     * Locate the plugin JAR that ships the bundled `/webview/` resources.
     *
     * Anchored on a *file* resource (`index.html`) rather than the `/webview/`
     * directory. IntelliJ's PluginClassLoader reliably resolves file resources to
     * `jar:` URLs, but does NOT reliably return a URL for *directory* resources, so
     * `getResource("/webview/")` could be null/non-jar and silently skip the recursive
     * extraction below — leaving assets/ unextracted and the panel blank (#52).
     *
     * The containing JAR is resolved via [java.net.JarURLConnection], which parses the
     * `jar:` URL with the JDK rather than hand-munging the URL path — correct across
     * platforms (Windows drive letters, percent-encoded spaces).
     *
     * Returns the JAR file containing webview/index.html, or null when the resources
     * live on the filesystem (dev / IDE runtime) instead of a packaged JAR.
     */
    private fun locateWebviewJar(): File? {
        val fileUrl = javaClass.getResource("/webview/index.html") ?: return null
        if (fileUrl.protocol != "jar") return null

        return try {
            val connection = fileUrl.openConnection() as? java.net.JarURLConnection ?: return null
            // jarFileURL is the file: URL of the containing JAR, parsed by the JDK.
            val jar = File(connection.jarFileURL.toURI())
            if (jar.isFile) jar else null
        } catch (e: Exception) {
            logger.debug("Could not resolve webview JAR from $fileUrl: ${e.message}")
            null
        }
    }

    /**
     * Recursively extract every `webview/` entry from [jarFile] into [targetDir],
     * recreating subdirectories (notably `assets/`). Verify the hashed JS bundle landed
     * and throw on an incomplete extraction, so the caller surfaces a real error instead
     * of silently serving a broken sandbox to the user (blank panel).
     */
    private fun extractFromJar(targetDir: File, jarFile: File) {
        var extractedCount = 0
        java.util.jar.JarFile(jarFile).use { jar ->
            val entries = jar.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                if (!entry.name.startsWith("webview/") || entry.isDirectory) continue

                val relativePath = entry.name.removePrefix("webview/")
                val targetFile = File(targetDir, relativePath)
                targetFile.parentFile?.mkdirs()

                jar.getInputStream(entry).use { input ->
                    targetFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
                extractedCount++
            }
        }

        // Hard verification: a real production build must have an assets/ directory
        // with at least the hashed JS bundle. An empty extraction means the WebView
        // would 404 on every page load — fail loudly so the user gets a real error
        // instead of a blank panel.
        val assetsDir = File(targetDir, "assets")
        val hasHashedBundle = assetsDir.isDirectory &&
            assetsDir.listFiles()?.any { it.name.startsWith("index-") && it.name.endsWith(".js") } == true
        if (extractedCount == 0 || !hasHashedBundle) {
            throw IllegalStateException(
                "JAR extraction produced incomplete webview resources " +
                    "(files=$extractedCount, hashedBundle=$hasHashedBundle, jar=${jarFile.absolutePath})"
            )
        }
        logger.info("Extracted $extractedCount webview entries from JAR: ${jarFile.absolutePath}")
    }

    /**
     * Try to extract assets from classpath when not running from JAR.
     * This is a best-effort approach for IDE development runtime.
     */
    private fun extractAssetsFromClasspath(targetDir: File) {
        // Try dynamic directory scanning first (works in IDE runtime where resources are on filesystem)
        val assetsUrl = javaClass.getResource("/webview/assets/")
        if (assetsUrl != null && assetsUrl.protocol == "file") {
            try {
                val assetsDir = File(assetsUrl.toURI())
                if (assetsDir.isDirectory) {
                    assetsDir.listFiles()?.forEach { file ->
                        if (file.isFile) {
                            val relativePath = "assets/${file.name}"
                            val targetFile = File(targetDir, relativePath)
                            targetFile.parentFile?.mkdirs()
                            file.inputStream().use { input ->
                                targetFile.outputStream().use { output ->
                                    input.copyTo(output)
                                }
                            }
                            logger.debug("Extracted asset (scanned): $relativePath")
                        }
                    }
                    return
                }
            } catch (e: Exception) {
                logger.debug("Directory scanning failed, falling back to known assets: ${e.message}")
            }
        }

        // Fallback: extract known assets individually from classpath
        val knownAssets = listOf(
            "assets/index.js",
            "assets/index.css",
            "assets/codicon.ttf",
            "assets/clawd.svg",
            "assets/claude-code-logo.svg"
        )

        for (asset in knownAssets) {
            val stream = javaClass.getResourceAsStream("/webview/$asset")
            if (stream != null) {
                val targetFile = File(targetDir, asset)
                targetFile.parentFile?.mkdirs()
                stream.use { input ->
                    targetFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
                logger.debug("Extracted asset: $asset")
            }
        }
    }

    // ─── Lifecycle ──────────────────────────────────────────────────

    /**
     * Detach from the Node.js process without killing it.
     * Does NOT close stdin/stdout/stderr pipes or cancel coroutines —
     * closing pipes would cause SIGPIPE/EPIPE in the Node.js process.
     * JVM shutdown will clean up naturally.
     * The Node.js backend will self-exit via its idle shutdown timer
     * when all WebSocket connections are closed.
     */
    fun detach() {
        logger.info("Detaching from NodeProcessManager (process stays alive)")
        // Intentionally NOT cancelling jobs.
        // Pipes must stay open so Node.js doesn't receive SIGPIPE.
        process = null
        logger.info("NodeProcessManager detached")
    }

    override fun dispose() {
        logger.info("Disposing NodeProcessManager")
        lifecycle = Lifecycle.DEAD

        stdoutJob?.cancel()
        stderrJob?.cancel()

        process?.let { proc ->
            if (proc.isAlive) {
                proc.destroy()
                // Give it a moment to terminate gracefully
                try {
                    val exited = proc.waitFor(3, java.util.concurrent.TimeUnit.SECONDS)
                    if (!exited) {
                        logger.warn("Node.js process did not terminate gracefully, forcing...")
                        proc.destroyForcibly()
                    }
                } catch (e: InterruptedException) {
                    proc.destroyForcibly()
                }
            }
        }

        process = null
        logger.info("NodeProcessManager disposed")
    }

    /**
     * Check whether the underlying Node.js process is still running.
     */
    val isAlive: Boolean
        get() = process?.isAlive == true
}
