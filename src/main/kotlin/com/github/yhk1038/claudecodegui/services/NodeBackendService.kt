package com.github.yhk1038.claudecodegui.services

import com.github.yhk1038.claudecodegui.bridge.NodeProcessManager
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentHashMap

/**
 * Project-level singleton service that manages a single Node.js backend process.
 *
 * Instead of each ClaudeCodePanel spawning its own NodeProcessManager,
 * all panels share this service so that:
 * - Only one Node.js process runs per project
 * - Retry creates a new manager in the service field, not a local variable
 * - All panels connect to the same port
 * - RPC messages are dispatched to the correct panel via CompositeRpcHandler
 * - If a Node.js backend is already running on the default port, it is reused
 *   instead of spawning a new process (Node.js manages its own lifecycle)
 */
@Service(Service.Level.PROJECT)
class NodeBackendService(private val project: Project) : Disposable {

    private val logger = Logger.getInstance(NodeBackendService::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var nodeProcessManager: NodeProcessManager? = null
    private var portDeferred = CompletableDeferred<Int>()

    // Per-panel RPC handler registry
    private val rpcHandlers = ConcurrentHashMap<String, NodeProcessManager.RpcHandler>()

    /**
     * Delegates RPC calls to the first registered panel handler.
     * When multiple panels are open, the first one in iteration order receives the message.
     */
    private inner class CompositeRpcHandler : NodeProcessManager.RpcHandler {
        private fun activeHandler(): NodeProcessManager.RpcHandler? =
            rpcHandlers.values.firstOrNull()

        override suspend fun openFile(path: String) {
            activeHandler()?.openFile(path)
                ?: logger.warn("No active panel handler for openFile")
        }

        override suspend fun openDiff(filePath: String, oldContent: String, newContent: String, toolUseId: String?) {
            activeHandler()?.openDiff(filePath, oldContent, newContent, toolUseId)
                ?: logger.warn("No active panel handler for openDiff")
        }

        override suspend fun applyDiff(filePath: String, newContent: String, toolUseId: String?): Boolean {
            return activeHandler()?.applyDiff(filePath, newContent, toolUseId)
                ?: run { logger.warn("No active panel handler for applyDiff"); false }
        }

        override suspend fun rejectDiff(toolUseId: String?) {
            activeHandler()?.rejectDiff(toolUseId)
                ?: logger.warn("No active panel handler for rejectDiff")
        }

        override suspend fun newSession() {
            activeHandler()?.newSession()
                ?: logger.warn("No active panel handler for newSession")
        }

        override suspend fun openSettings() {
            activeHandler()?.openSettings()
                ?: logger.warn("No active panel handler for openSettings")
        }

        override suspend fun openTerminal(workingDir: String) {
            activeHandler()?.openTerminal(workingDir)
                ?: logger.warn("No active panel handler for openTerminal")
        }

        override suspend fun openUrl(url: String) {
            activeHandler()?.openUrl(url)
                ?: logger.warn("No active panel handler for openUrl")
        }

        override suspend fun updatePlugin() {
            activeHandler()?.updatePlugin()
                ?: logger.warn("No active panel handler for updatePlugin")
        }

        override suspend fun requiresRestart(): Boolean {
            return activeHandler()?.requiresRestart()
                ?: run { logger.warn("No active panel handler for requiresRestart"); true }
        }
    }

    /**
     * Ensure the backend is started. Called by each panel on init.
     * First call starts the Node.js process; subsequent calls are no-ops.
     * Registers the panel's RPC handler under its panelId.
     */
    @Synchronized
    fun ensureStarted(panelId: String, rpcHandler: NodeProcessManager.RpcHandler) {
        rpcHandlers[panelId] = rpcHandler
        if (nodeProcessManager == null) {
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
    fun releasePanel(panelId: String) {
        rpcHandlers.remove(panelId)
        logger.info("Panel released: $panelId (remaining handlers: ${rpcHandlers.size})")
        // Node.js manages its own lifecycle — no shutdown scheduling here
    }

    private fun startBackend() {
        // Check if a Node.js process is already running on the default port
        if (isBackendAlreadyRunning(DEFAULT_PORT)) {
            logger.info("Reusing existing Node.js backend on port $DEFAULT_PORT")
            portDeferred = CompletableDeferred()
            portDeferred.complete(DEFAULT_PORT)
            return
        }

        portDeferred = CompletableDeferred()
        val manager = NodeProcessManager(project, scope)
        nodeProcessManager = manager
        manager.start(CompositeRpcHandler())
        scope.launch {
            try {
                val port = manager.port.await()
                portDeferred.complete(port)
                logger.info("Node.js backend started on port $port")
            } catch (e: Exception) {
                portDeferred.completeExceptionally(e)
                logger.error("Failed to start Node.js backend", e)
            }
        }
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
        nodeProcessManager?.dispose()
        nodeProcessManager = null
    }

    /**
     * Check if a Node.js backend is already listening on the given port.
     * Any valid HTTP response (2xx–4xx) indicates a running server.
     */
    private fun isBackendAlreadyRunning(port: Int): Boolean {
        return try {
            val url = java.net.URL("http://127.0.0.1:$port/")
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
        // IDE is shutting down — detach from backend, don't kill it.
        // Browser clients may still be connected; Node.js will self-exit
        // via idle shutdown (60s) when all WebSocket connections close.
        // Do NOT cancel scope — cancelling coroutines would close stdout/stderr
        // pipes, causing SIGPIPE in the Node.js process. JVM shutdown handles cleanup.
        detachBackend()
        logger.info("NodeBackendService disposed (backend detached, not killed)")
    }

    companion object {
        const val DEFAULT_PORT = 19836

        fun getInstance(project: Project): NodeBackendService =
            project.getService(NodeBackendService::class.java)
    }
}
