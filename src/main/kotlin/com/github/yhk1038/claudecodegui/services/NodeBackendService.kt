package com.github.yhk1038.claudecodegui.services

import com.github.yhk1038.claudecodegui.bridge.NodeProcessManager
import com.github.yhk1038.claudecodegui.bridge.RpcWebSocketClient
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.extensions.PluginId
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentHashMap

/**
 * Application-level singleton service that manages a single Node.js backend process.
 *
 * Instead of each ClaudeCodePanel spawning its own NodeProcessManager,
 * all panels across all projects share this service so that:
 * - Only one Node.js process runs per computer (application level)
 * - Retry creates a new manager in the service field, not a local variable
 * - All panels connect to the same port
 * - RPC messages are dispatched to the correct project handler via CompositeRpcHandler
 *   using projectBasePath + panelId as the registry key
 * - If a Node.js backend is already running on the default port, it is reused
 *   instead of spawning a new process (Node.js manages its own lifecycle)
 */
@Service(Service.Level.APP)
class NodeBackendService : Disposable {

    private val logger = Logger.getInstance(NodeBackendService::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var nodeProcessManager: NodeProcessManager? = null
    private var rpcClient: RpcWebSocketClient? = null
    private var portDeferred = CompletableDeferred<Int>()

    // Per-panel RPC handler registry: key = "projectBasePath::panelId"
    // Value = Pair(projectBasePath, handler)
    private val rpcHandlers = ConcurrentHashMap<String, Pair<String, NodeProcessManager.RpcHandler>>()

    /**
     * Delegates RPC calls to the most specific handler based on file path or workingDir.
     * Uses longest-prefix matching on projectBasePath to find the correct project's handler.
     */
    private inner class CompositeRpcHandler : NodeProcessManager.RpcHandler {

        private fun handlerForPath(path: String?): NodeProcessManager.RpcHandler? {
            if (path == null) return rpcHandlers.values.firstOrNull()?.second
            return rpcHandlers.values
                .filter { (basePath, _) -> path.startsWith(basePath) }
                .maxByOrNull { (basePath, _) -> basePath.length }
                ?.second
                ?: rpcHandlers.values.firstOrNull()?.second
        }

        private fun handlerForWorkingDir(workingDir: String?): NodeProcessManager.RpcHandler? {
            logger.info("[DEBUG:handlerForWorkingDir] workingDir='$workingDir', isNullOrBlank=${workingDir.isNullOrBlank()}, rpcHandlers.keys=${rpcHandlers.keys}")
            if (workingDir == null) return rpcHandlers.values.firstOrNull()?.second
            val matched = rpcHandlers.values
                .filter { (basePath, _) -> workingDir.startsWith(basePath) }
            logger.info("[DEBUG:handlerForWorkingDir] matched=${matched.size}, basePaths=${rpcHandlers.values.map { it.first }}")
            return matched
                .maxByOrNull { (basePath, _) -> basePath.length }
                ?.second
                ?: rpcHandlers.values.firstOrNull()?.second
        }

        override suspend fun openFile(path: String) {
            handlerForPath(path)?.openFile(path)
                ?: logger.warn("No handler for openFile: $path")
        }

        override suspend fun openDiff(filePath: String, oldContent: String, newContent: String, toolUseId: String?) {
            handlerForPath(filePath)?.openDiff(filePath, oldContent, newContent, toolUseId)
                ?: logger.warn("No handler for openDiff: $filePath")
        }

        override suspend fun applyDiff(filePath: String, newContent: String, toolUseId: String?): Boolean {
            return handlerForPath(filePath)?.applyDiff(filePath, newContent, toolUseId)
                ?: run { logger.warn("No handler for applyDiff: $filePath"); false }
        }

        override suspend fun rejectDiff(toolUseId: String?) {
            rpcHandlers.values.firstOrNull()?.second?.rejectDiff(toolUseId)
                ?: logger.warn("No active panel handler for rejectDiff")
        }

        override suspend fun createSession(workingDir: String) {
            handlerForWorkingDir(workingDir)?.createSession(workingDir)
                ?: logger.warn("No handler for createSession: $workingDir")
        }

        override suspend fun openNewTab(workingDir: String) {
            handlerForWorkingDir(workingDir)?.openNewTab(workingDir)
                ?: logger.warn("No handler for openNewTab: $workingDir")
        }

        override suspend fun openSettings(workingDir: String) {
            handlerForWorkingDir(workingDir)?.openSettings(workingDir)
                ?: logger.warn("No handler for openSettings: $workingDir")
        }

        override suspend fun openTerminal(workingDir: String) {
            handlerForWorkingDir(workingDir)?.openTerminal(workingDir)
                ?: logger.warn("No handler for openTerminal: $workingDir")
        }

        override suspend fun openUrl(url: String) {
            rpcHandlers.values.firstOrNull()?.second?.openUrl(url)
                ?: logger.warn("No active panel handler for openUrl")
        }

        override suspend fun updatePlugin() {
            rpcHandlers.values.firstOrNull()?.second?.updatePlugin()
                ?: logger.warn("No active panel handler for updatePlugin")
        }

        override suspend fun requiresRestart(): Boolean {
            return rpcHandlers.values.firstOrNull()?.second?.requiresRestart()
                ?: run { logger.warn("No active panel handler for requiresRestart"); true }
        }
    }

    /**
     * Ensure the backend is started. Called by each panel on init.
     * First call starts the Node.js process; subsequent calls are no-ops.
     * Registers the panel's RPC handler under "projectBasePath::panelId".
     */
    @Synchronized
    fun ensureStarted(projectBasePath: String, panelId: String, rpcHandler: NodeProcessManager.RpcHandler) {
        val key = "$projectBasePath::$panelId"
        rpcHandlers[key] = Pair(projectBasePath, rpcHandler)
        if (nodeProcessManager == null && rpcClient == null) {
            startBackend()
        } else if (nodeProcessManager?.isAlive == false && !isBackendAlreadyRunning(DEFAULT_PORT)) {
            logger.info("Node.js backend process is dead, restarting...")
            restart()
        }
    }

    /**
     * Await the backend port. Suspends until the Node.js process prints PORT:{n}.
     */
    suspend fun awaitPort(): Int = portDeferred.await()

    /**
     * Restart the backend. Disposes the current process and starts a new one.
     * Used by retry logic when the initial start fails.
     */
    @Synchronized
    fun restart() {
        stopBackend()
        startBackend()
    }

    /**
     * Called by a panel when it is disposed.
     * Removes the panel's RPC handler from the registry.
     * Node.js manages its own lifecycle — no shutdown scheduling here.
     */
    fun releasePanel(projectBasePath: String, panelId: String) {
        val key = "$projectBasePath::$panelId"
        rpcHandlers.remove(key)
        logger.info("Panel released: $key (remaining handlers: ${rpcHandlers.size})")
        // Node.js manages its own lifecycle — no shutdown scheduling here
    }

    private fun startBackend() {
        // Check if a Node.js process is already running on the default port
        if (isBackendAlreadyRunning(DEFAULT_PORT)) {
            val backendVersion = getBackendVersion(DEFAULT_PORT)
            val pluginVersion = getPluginVersion()

            val shouldReplace = when {
                backendVersion == null -> true  // No /version endpoint → pre-upgrade backend
                pluginVersion == null -> false  // Can't determine plugin version → safe to reuse
                else -> isVersionLower(backendVersion, pluginVersion)
            }

            if (shouldReplace) {
                logger.info("Replacing stale backend (backend=$backendVersion, plugin=$pluginVersion)")
                killProcessOnPort(DEFAULT_PORT)
                Thread.sleep(500)
                // Fall through to spawn a new process below
            } else {
                logger.info("Reusing existing Node.js backend on port $DEFAULT_PORT (backend=$backendVersion, plugin=$pluginVersion)")
                portDeferred = CompletableDeferred()
                portDeferred.complete(DEFAULT_PORT)
                connectRpcWebSocket(DEFAULT_PORT)
                return
            }
        }

        portDeferred = CompletableDeferred()
        val manager = NodeProcessManager(scope)
        nodeProcessManager = manager
        manager.start()
        scope.launch {
            try {
                val port = manager.port.await()
                portDeferred.complete(port)
                logger.info("Node.js backend started on port $port")
                connectRpcWebSocket(port)
            } catch (e: Exception) {
                portDeferred.completeExceptionally(e)
                logger.error("Failed to start Node.js backend", e)
            }
        }
    }

    /**
     * Connect the RPC WebSocket client to the backend's /rpc endpoint.
     * This replaces the old stdout/stdin JSON-RPC communication.
     */
    private fun connectRpcWebSocket(port: Int) {
        rpcClient?.dispose()
        val client = RpcWebSocketClient(scope, CompositeRpcHandler()) {
            // Backend seems dead — force restart
            forceRestart()
        }
        rpcClient = client
        client.connect(port)
        logger.info("RPC WebSocket client connecting to port $port")
    }

    /**
     * Force-restart the backend when the RPC WebSocket client detects
     * persistent connection failures (stale/dead backend).
     */
    @Synchronized
    private fun forceRestart() {
        logger.warn("Forcing backend restart due to persistent RPC connection failure")
        stopBackend()
        nodeProcessManager = null
        rpcClient = null
        startBackend()
    }

    /**
     * Detach from the backend without killing it.
     * The Node.js process continues running for browser clients
     * and will self-exit via its idle shutdown timer.
     */
    private fun detachBackend() {
        nodeProcessManager?.detach()
        nodeProcessManager = null
    }

    /**
     * Kill the backend process immediately.
     * Used by restart() to ensure a clean slate.
     */
    private fun stopBackend() {
        rpcClient?.dispose()
        rpcClient = null
        nodeProcessManager?.dispose()
        nodeProcessManager = null
    }

    /**
     * Query the running backend's version via HTTP GET /version.
     * Returns the version string (e.g. "0.11.5") or null if unreachable.
     */
    private fun getBackendVersion(port: Int): String? {
        return try {
            val url = java.net.URI("http://127.0.0.1:$port/version").toURL()
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.connectTimeout = 2000
            conn.readTimeout = 2000
            conn.requestMethod = "GET"
            val code = conn.responseCode
            if (code == 200) {
                val body = conn.inputStream.bufferedReader().readText()
                conn.disconnect()
                Regex(""""version"\s*:\s*"([^"]+)"""").find(body)?.groupValues?.get(1)
            } else {
                conn.disconnect()
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Get the current plugin version from the IDE's plugin descriptor.
     */
    private fun getPluginVersion(): String? {
        return PluginManagerCore.getPlugin(PluginId.getId(PLUGIN_ID))?.version
    }

    /**
     * Compare two semver strings. Returns true if [version] < [than].
     */
    private fun isVersionLower(version: String, than: String): Boolean {
        val v1 = version.split(".").map { it.toIntOrNull() ?: 0 }
        val v2 = than.split(".").map { it.toIntOrNull() ?: 0 }
        val maxLen = maxOf(v1.size, v2.size)
        for (i in 0 until maxLen) {
            val a = v1.getOrElse(i) { 0 }
            val b = v2.getOrElse(i) { 0 }
            if (a < b) return true
            if (a > b) return false
        }
        return false
    }

    /**
     * Kill any process listening on the given port.
     */
    private fun killProcessOnPort(port: Int) {
        try {
            val os = System.getProperty("os.name").lowercase()
            if (os.contains("win")) {
                val output = ProcessBuilder("cmd", "/c", "netstat -ano | findstr :$port")
                    .start().inputStream.bufferedReader().readText().trim()
                val pids = output.lines()
                    .mapNotNull { it.trim().split("\\s+".toRegex()).lastOrNull()?.toIntOrNull() }
                    .filter { it > 0 }
                    .toSet()
                pids.forEach { pid ->
                    ProcessBuilder("taskkill", "/F", "/PID", pid.toString())
                        .start().waitFor(3, java.util.concurrent.TimeUnit.SECONDS)
                }
            } else {
                val pids = ProcessBuilder("lsof", "-ti", ":$port")
                    .start().inputStream.bufferedReader().readText().trim()
                if (pids.isNotEmpty()) {
                    pids.split("\n").forEach { pidStr ->
                        val pid = pidStr.trim().toIntOrNull()
                        if (pid != null && pid > 0) {
                            ProcessBuilder("kill", "-9", pid.toString())
                                .start().waitFor(3, java.util.concurrent.TimeUnit.SECONDS)
                        }
                    }
                }
            }
            logger.info("Killed stale backend process on port $port")
        } catch (e: Exception) {
            logger.warn("Failed to kill process on port $port", e)
        }
    }

    /**
     * Check if a Node.js backend is already listening on the given port.
     * Any valid HTTP response (2xx–4xx) indicates a running server.
     */
    private fun isBackendAlreadyRunning(port: Int): Boolean {
        return try {
            val url = java.net.URI("http://127.0.0.1:$port/").toURL()
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.connectTimeout = 2000
            conn.readTimeout = 2000
            conn.requestMethod = "GET"
            val code = conn.responseCode
            conn.disconnect()
            code in 200..499  // Any valid HTTP response means server is running
        } catch (_: Exception) {
            false
        }
    }

    override fun dispose() {
        // IDE is shutting down — dispose RPC client and detach from backend.
        // Browser clients may still be connected; Node.js will self-exit
        // via idle shutdown (60s) when all WebSocket connections close.
        // Do NOT cancel scope — cancelling coroutines would close stdout/stderr
        // pipes, causing SIGPIPE in the Node.js process. JVM shutdown handles cleanup.
        rpcClient?.dispose()
        rpcClient = null
        detachBackend()
        logger.info("NodeBackendService disposed (backend detached, not killed)")
    }

    companion object {
        const val DEFAULT_PORT = 19836
        private const val PLUGIN_ID = "com.github.yhk1038.claude-code-gui"

        fun getInstance(): NodeBackendService =
            ApplicationManager.getApplication().getService(NodeBackendService::class.java)
    }
}
