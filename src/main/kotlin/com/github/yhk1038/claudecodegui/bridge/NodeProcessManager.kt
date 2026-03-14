package com.github.yhk1038.claudecodegui.bridge

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.SystemInfo
import com.intellij.util.EnvironmentUtil
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStreamWriter

/**
 * Manages the Node.js backend process lifecycle.
 *
 * Responsibilities:
 * 1. Find the `node` executable on PATH or well-known locations
 * 2. Locate the backend entry file (dev: project-relative, prod: extracted from JAR)
 * 3. Extract WebView static resources for the WEBVIEW_DIR env var
 * 4. Spawn `node backend.mjs` with correct env vars
 * 5. Read the first stdout line `PORT:{n}\n` -> expose via [port] Deferred
 * 6. Parse subsequent stdout lines as JSON-RPC requests and dispatch to [RpcHandler]
 * 7. Forward stderr to IDE logger
 * 8. Gracefully terminate the process on dispose
 */
class NodeProcessManager(
    private val project: Project,
    private val scope: CoroutineScope
) : Disposable {

    private val logger = Logger.getInstance(NodeProcessManager::class.java)

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    // Server port (fulfilled once the backend prints PORT:{n})
    private val _portDeferred = CompletableDeferred<Int>()
    val port: Deferred<Int> = _portDeferred

    private var process: Process? = null
    private var stdinWriter: BufferedWriter? = null
    private var stdoutJob: Job? = null
    private var stderrJob: Job? = null

    /**
     * Handler interface for JSON-RPC requests coming from the Node.js backend.
     * The Node.js backend calls these when it needs IDE-native functionality.
     */
    interface RpcHandler {
        suspend fun openFile(path: String)
        suspend fun openDiff(filePath: String, oldContent: String, newContent: String, toolUseId: String?)
        suspend fun applyDiff(filePath: String, newContent: String, toolUseId: String?): Boolean
        suspend fun rejectDiff(toolUseId: String?)
        suspend fun newSession()
        suspend fun openSettings()
        suspend fun openTerminal(workingDir: String)
        suspend fun openUrl(url: String)
        suspend fun updatePlugin()
        suspend fun requiresRestart(): Boolean
    }

    /**
     * Start the Node.js backend process.
     *
     * @param rpcHandler Implementation that handles IDE-native RPC calls
     */
    fun start(rpcHandler: RpcHandler) {
        val nodePath = findNodeExecutable()
        if (nodePath == null) {
            logger.error("Node.js executable not found. Ensure 'node' is on PATH or installed in a well-known location.")
            _portDeferred.completeExceptionally(
                IllegalStateException("Node.js executable not found")
            )
            return
        }

        val backendFile = findBackendFile()
        if (backendFile == null) {
            logger.error("Backend entry file (backend.mjs) not found.")
            _portDeferred.completeExceptionally(
                IllegalStateException("Backend entry file not found")
            )
            return
        }

        val webviewDir = extractWebviewResources()

        logger.info("Starting Node.js backend: node=$nodePath, backend=${backendFile.absolutePath}, webviewDir=${webviewDir?.absolutePath}")

        scope.launch(Dispatchers.IO) {
            try {
                val env = buildMap {
                    putAll(EnvironmentUtil.getEnvironmentMap())
                    put("JETBRAINS_MODE", "true")
                    if (webviewDir != null) {
                        put("WEBVIEW_DIR", webviewDir.absolutePath)
                    }
                    // Working directory for Claude CLI sessions
                    project.basePath?.let { put("PROJECT_DIR", it) }
                }

                val pb = ProcessBuilder(nodePath, backendFile.absolutePath)
                    .directory(backendFile.parentFile)
                    .redirectErrorStream(false)

                pb.environment().clear()
                pb.environment().putAll(env)

                val proc = pb.start()
                process = proc

                stdinWriter = BufferedWriter(OutputStreamWriter(proc.outputStream, Charsets.UTF_8))

                // Read stdout: first line is PORT, rest are JSON-RPC
                stdoutJob = scope.launch(Dispatchers.IO) {
                    val reader = BufferedReader(InputStreamReader(proc.inputStream, Charsets.UTF_8))
                    try {
                        readStdout(reader, rpcHandler)
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
                logger.info("Node.js backend exited with code $exitCode")

                if (!_portDeferred.isCompleted) {
                    _portDeferred.completeExceptionally(
                        IllegalStateException("Node.js process exited before printing PORT (exit code: $exitCode)")
                    )
                }
            } catch (e: CancellationException) {
                // Normal shutdown
            } catch (e: Exception) {
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
     * Subsequent lines: JSON-RPC requests
     */
    private suspend fun readStdout(reader: BufferedReader, rpcHandler: RpcHandler) {
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

            // After PORT is read, all lines are JSON-RPC requests
            if (line.isBlank()) continue

            scope.launch {
                try {
                    handleJsonRpcRequest(line, rpcHandler)
                } catch (e: Exception) {
                    logger.error("Error handling JSON-RPC request: $line", e)
                }
            }
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

    /**
     * Parse and dispatch a JSON-RPC request from Node.js backend.
     *
     * Request format:
     * {"jsonrpc":"2.0","id":"rpc-1","method":"OPEN_FILE","params":{"path":"/..."}}
     *
     * Response format (sent to stdin):
     * {"jsonrpc":"2.0","id":"rpc-1","result":{}}\n
     */
    private suspend fun handleJsonRpcRequest(line: String, rpcHandler: RpcHandler) {
        val request = try {
            json.parseToJsonElement(line).jsonObject
        } catch (e: Exception) {
            logger.warn("Failed to parse JSON-RPC request: ${line.take(200)}")
            return
        }

        val id = request["id"]?.jsonPrimitive?.content
        val method = request["method"]?.jsonPrimitive?.content
        val params = request["params"]?.jsonObject ?: buildJsonObject {}

        if (method == null) {
            logger.warn("JSON-RPC request missing 'method': ${line.take(200)}")
            if (id != null) sendRpcError(id, -32600, "Missing method")
            return
        }

        logger.debug("JSON-RPC request: method=$method, id=$id")

        try {
            val result = when (method) {
                "OPEN_FILE" -> {
                    val path = params["path"]?.jsonPrimitive?.content
                        ?: throw IllegalArgumentException("Missing 'path' param")
                    rpcHandler.openFile(path)
                    buildJsonObject {}
                }

                "OPEN_DIFF" -> {
                    val filePath = params["filePath"]?.jsonPrimitive?.content
                        ?: throw IllegalArgumentException("Missing 'filePath' param")
                    val oldContent = params["oldContent"]?.jsonPrimitive?.content ?: ""
                    val newContent = params["newContent"]?.jsonPrimitive?.content ?: ""
                    val toolUseId = params["toolUseId"]?.jsonPrimitive?.content
                    rpcHandler.openDiff(filePath, oldContent, newContent, toolUseId)
                    buildJsonObject {}
                }

                "APPLY_DIFF" -> {
                    val filePath = params["filePath"]?.jsonPrimitive?.content
                        ?: throw IllegalArgumentException("Missing 'filePath' param")
                    val newContent = params["newContent"]?.jsonPrimitive?.content
                        ?: throw IllegalArgumentException("Missing 'newContent' param")
                    val toolUseId = params["toolUseId"]?.jsonPrimitive?.content
                    val applied = rpcHandler.applyDiff(filePath, newContent, toolUseId)
                    buildJsonObject { put("applied", applied) }
                }

                "REJECT_DIFF" -> {
                    val toolUseId = params["toolUseId"]?.jsonPrimitive?.content
                    rpcHandler.rejectDiff(toolUseId)
                    buildJsonObject {}
                }

                "NEW_SESSION" -> {
                    rpcHandler.newSession()
                    buildJsonObject {}
                }

                "OPEN_SETTINGS" -> {
                    rpcHandler.openSettings()
                    buildJsonObject {}
                }

                "OPEN_TERMINAL" -> {
                    val workingDir = params["workingDir"]?.jsonPrimitive?.content
                        ?: throw IllegalArgumentException("Missing 'workingDir' param")
                    rpcHandler.openTerminal(workingDir)
                    buildJsonObject {}
                }

                "OPEN_URL" -> {
                    val url = params["url"]?.jsonPrimitive?.content
                        ?: throw IllegalArgumentException("Missing 'url' param")
                    rpcHandler.openUrl(url)
                    buildJsonObject {}
                }

                "UPDATE_PLUGIN" -> {
                    rpcHandler.updatePlugin()
                    buildJsonObject {}
                }

                "REQUIRES_RESTART" -> {
                    val requires = rpcHandler.requiresRestart()
                    buildJsonObject { put("requiresRestart", requires) }
                }

                else -> {
                    logger.warn("Unknown JSON-RPC method: $method")
                    if (id != null) sendRpcError(id, -32601, "Method not found: $method")
                    return
                }
            }

            if (id != null) {
                sendRpcResult(id, result)
            }
        } catch (e: Exception) {
            logger.error("Error executing JSON-RPC method '$method'", e)
            if (id != null) {
                sendRpcError(id, -32000, e.message ?: "Internal error")
            }
        }
    }

    /**
     * Send a JSON-RPC success response to the Node.js process via stdin.
     */
    private fun sendRpcResult(id: String, result: JsonObject) {
        val response = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", id)
            put("result", result)
        }
        writeToStdin(json.encodeToString(JsonObject.serializer(), response))
    }

    /**
     * Send a JSON-RPC error response to the Node.js process via stdin.
     */
    private fun sendRpcError(id: String, code: Int, message: String) {
        val response = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", id)
            putJsonObject("error") {
                put("code", code)
                put("message", message)
            }
        }
        writeToStdin(json.encodeToString(JsonObject.serializer(), response))
    }

    /**
     * Write a line to the process stdin.
     */
    @Synchronized
    private fun writeToStdin(line: String) {
        try {
            stdinWriter?.let { writer ->
                writer.write(line)
                writer.newLine()
                writer.flush()
            } ?: logger.warn("Cannot write to stdin: writer is null")
        } catch (e: Exception) {
            logger.error("Failed to write to Node.js stdin", e)
        }
    }

    // ─── Node.js / Backend file discovery ───────────────────────────

    /**
     * Find the `node` executable.
     * Tries:
     * 1. `which node` (PATH-based)
     * 2. Well-known locations (nvm, volta, fnm, homebrew, etc.)
     */
    private fun findNodeExecutable(): String? {
        // 1. Environment variable override
        System.getenv("NODE_PATH_OVERRIDE")?.let { envPath ->
            if (File(envPath).exists() && File(envPath).canExecute()) {
                logger.info("Found node via NODE_PATH_OVERRIDE: $envPath")
                return envPath
            }
        }

        // 2. PATH lookup via shell command (EnvironmentUtil provides full shell PATH)
        try {
            val command = if (SystemInfo.isWindows) arrayOf("cmd", "/c", "where", "node") else arrayOf("which", "node")
            val pb = ProcessBuilder(*command).redirectErrorStream(true)
            // Inject shell-aware PATH so lookup succeeds even when IDE is launched from GUI
            pb.environment()["PATH"] = EnvironmentUtil.getEnvironmentMap()["PATH"] ?: System.getenv("PATH") ?: ""
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
            listOf(
                "/usr/local/bin/node",
                "/opt/homebrew/bin/node",
                "$home/.nvm/current/bin/node",
                "$home/.volta/bin/node",
                "$home/.fnm/aliases/default/bin/node",
                "$home/.local/bin/node",
                "/usr/bin/node",
            )
        }

        wellKnownPaths.firstOrNull { File(it).exists() && File(it).canExecute() }?.let { found ->
            logger.info("Found node at well-known location: $found")
            return found
        }

        logger.warn("Node.js executable not found")
        return null
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

        // Heuristic 2: Check environment variable
        System.getenv("PLUGIN_PROJECT_ROOT")?.let { root ->
            val rootFile = File(root)
            if (rootFile.exists() && File(rootFile, "backend/dist/backend.mjs").exists()) {
                return rootFile
            }
        }

        // Heuristic 3: Walk up from class location
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
            val tempDir = File(System.getProperty("java.io.tmpdir"), "claude-code-backend-${project.locationHash}")

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
            val tempDir = File(System.getProperty("java.io.tmpdir"), "claude-code-webview-${project.locationHash}")

            if (tempDir.exists()) {
                tempDir.deleteRecursively()
            }
            tempDir.mkdirs()

            val webviewUrl = javaClass.getResource("/webview/")
            if (webviewUrl != null && webviewUrl.protocol == "jar") {
                extractFromJar(tempDir)
            } else {
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

    private fun extractFromJar(targetDir: File) {
        try {
            val jarPath = javaClass.protectionDomain.codeSource.location.toURI().path
            val jarFile = java.util.jar.JarFile(jarPath)

            jarFile.use { jar ->
                val entries = jar.entries()
                while (entries.hasMoreElements()) {
                    val entry = entries.nextElement()
                    if (entry.name.startsWith("webview/") && !entry.isDirectory) {
                        val relativePath = entry.name.removePrefix("webview/")
                        val targetFile = File(targetDir, relativePath)
                        targetFile.parentFile?.mkdirs()

                        jar.getInputStream(entry).use { input ->
                            targetFile.outputStream().use { output ->
                                input.copyTo(output)
                            }
                        }
                        logger.debug("Extracted from JAR: ${entry.name}")
                    }
                }
            }
        } catch (e: Exception) {
            logger.warn("Failed to extract from JAR, trying classpath fallback", e)
        }
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
        // Intentionally NOT closing stdin or cancelling jobs.
        // Pipes must stay open so Node.js doesn't receive SIGPIPE.
        process = null
        stdinWriter = null
        logger.info("NodeProcessManager detached")
    }

    override fun dispose() {
        logger.info("Disposing NodeProcessManager")

        stdoutJob?.cancel()
        stderrJob?.cancel()

        try {
            stdinWriter?.close()
        } catch (e: Exception) {
            logger.debug("Error closing stdin writer: ${e.message}")
        }

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
        stdinWriter = null
        logger.info("NodeProcessManager disposed")
    }

    /**
     * Check whether the underlying Node.js process is still running.
     */
    val isAlive: Boolean
        get() = process?.isAlive == true
}
