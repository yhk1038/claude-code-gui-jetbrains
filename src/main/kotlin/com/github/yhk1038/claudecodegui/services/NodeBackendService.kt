package com.github.yhk1038.claudecodegui.services

import com.github.yhk1038.claudecodegui.bridge.NodeProcessManager
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicInteger

/**
 * Project-level singleton service that manages a single Node.js backend process.
 *
 * Instead of each ClaudeCodePanel spawning its own NodeProcessManager,
 * all panels share this service so that:
 * - Only one Node.js process runs per project (defect E fix)
 * - Retry creates a new manager in the service field, not a local variable (defect D fix)
 * - All panels connect to the same port
 */
@Service(Service.Level.PROJECT)
class NodeBackendService(private val project: Project) : Disposable {

    private val logger = Logger.getInstance(NodeBackendService::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var nodeProcessManager: NodeProcessManager? = null
    private var portDeferred = CompletableDeferred<Int>()
    private val activePanelCount = AtomicInteger(0)

    /**
     * Ensure the backend is started. Called by each panel on init.
     * First call starts the Node.js process; subsequent calls are no-ops.
     */
    @Synchronized
    fun ensureStarted(rpcHandler: NodeProcessManager.RpcHandler) {
        activePanelCount.incrementAndGet()
        if (nodeProcessManager == null) {
            startBackend(rpcHandler)
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
    fun restart(rpcHandler: NodeProcessManager.RpcHandler) {
        stopBackend()
        startBackend(rpcHandler)
    }

    /**
     * Called by a panel when it is disposed.
     * Decrements the active panel count.
     */
    fun releasePanel() {
        val remaining = activePanelCount.decrementAndGet()
        logger.info("Panel released. Active panels: $remaining")
    }

    private fun startBackend(rpcHandler: NodeProcessManager.RpcHandler) {
        portDeferred = CompletableDeferred()
        val manager = NodeProcessManager(project, scope)
        nodeProcessManager = manager
        manager.start(rpcHandler)
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

    private fun stopBackend() {
        nodeProcessManager?.dispose()
        nodeProcessManager = null
    }

    override fun dispose() {
        stopBackend()
        scope.coroutineContext[Job]?.cancel()
        logger.info("NodeBackendService disposed")
    }

    companion object {
        fun getInstance(project: Project): NodeBackendService =
            project.getService(NodeBackendService::class.java)
    }
}
