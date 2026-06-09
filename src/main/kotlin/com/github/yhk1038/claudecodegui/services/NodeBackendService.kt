package com.github.yhk1038.claudecodegui.services

import com.github.yhk1038.claudecodegui.bridge.NodeProcessManager
import com.github.yhk1038.claudecodegui.bridge.RpcWebSocketClient
import com.github.yhk1038.claudecodegui.bridge.WslPathResolver
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.putJsonArray
import java.util.concurrent.ConcurrentHashMap

/**
 * Application-level service that manages **one Node.js backend per IDE project
 * root** (`project.basePath`).
 *
 * This mirrors VS Code's Remote model, where each workspace gets its own
 * extension host running in that workspace's execution environment. For us the
 * "extension host" is the Node.js backend, and the unit that decides the
 * execution environment is the IDE project root: a root inside WSL
 * (`\\wsl.localhost\<distro>\...`) must run its backend inside that distro, a
 * native root runs natively. Sharing one backend across roots can't satisfy
 * that, so each root gets its own backend on its own OS-assigned port.
 *
 * Key = `project.basePath` (NOT workingDir): nested working-directory navigation
 * (#43) changes the session cwd within a root but never the root, so it must not
 * spawn or switch backends.
 *
 * Background: issue #57. The previous model (single fixed-port backend shared by
 * all roots and all IDE instances, #76) is superseded here; cross-IDE backend
 * sharing is intentionally dropped (each IDE instance runs its own per-root
 * backends, distinguished by dynamic ports).
 */
@Service(Service.Level.APP)
class NodeBackendService : Disposable {

    private val logger = Logger.getInstance(NodeBackendService::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // key = IDE 프로젝트 루트 (project.basePath)
    private val backends = ConcurrentHashMap<String, BackendInstance>()

    /**
     * One Node.js backend dedicated to a single IDE project root. Owns its
     * process, RPC socket, port, and the per-panel handlers for that root.
     */
    private inner class BackendInstance(private val basePath: String) {
        // Stable per-root tag so this backend's extraction temp dirs don't collide
        // with other roots' backends (plan S2b). Same root → same tag → safe reuse.
        private val instanceTag: String = Integer.toHexString(basePath.hashCode())
        private var nodeProcessManager: NodeProcessManager? = null
        private var rpcClient: RpcWebSocketClient? = null

        @Volatile
        var portDeferred = CompletableDeferred<Int>()
            private set

        // The port this backend last bound. Reused on respawn so an already-loaded
        // WebView (pointing at this port) reconnects instead of being stranded on a
        // stale port. 0 = never started → OS assigns a free port on first start.
        @Volatile
        private var lastPort: Int = 0

        // panelId -> handler. The Claude Code editor tabs open under this root.
        val handlers = ConcurrentHashMap<String, NodeProcessManager.RpcHandler>()

        /**
         * RPC requests from this backend always concern this one project root, so
         * they are delegated to any registered panel handler for the root (all
         * equivalent — same project). Only [getIdeRoot] is pinned to [basePath].
         */
        private inner class Router : NodeProcessManager.RpcHandler {
            private fun any(): NodeProcessManager.RpcHandler? = handlers.values.firstOrNull()
            private fun warn(op: String): Nothing? {
                logger.warn("No panel handler for $op (basePath=$basePath)"); return null
            }

            override suspend fun openFile(path: String) {
                any()?.openFile(path) ?: warn("openFile")
            }

            override suspend fun openDiff(filePath: String, oldContent: String, newContent: String, toolUseId: String?) {
                any()?.openDiff(filePath, oldContent, newContent, toolUseId) ?: warn("openDiff")
            }

            override suspend fun applyDiff(filePath: String, newContent: String, toolUseId: String?): Boolean =
                any()?.applyDiff(filePath, newContent, toolUseId) ?: run { warn("applyDiff"); false }

            override suspend fun rejectDiff(toolUseId: String?) {
                any()?.rejectDiff(toolUseId) ?: warn("rejectDiff")
            }

            override suspend fun refreshFiles(paths: List<String>) {
                if (paths.isEmpty()) return
                any()?.refreshFiles(paths) ?: warn("refreshFiles")
            }

            override suspend fun createSession(workingDir: String) {
                any()?.createSession(workingDir) ?: warn("createSession")
            }

            override suspend fun openNewTab(workingDir: String) {
                any()?.openNewTab(workingDir) ?: warn("openNewTab")
            }

            override suspend fun openSettings(workingDir: String) {
                any()?.openSettings(workingDir) ?: warn("openSettings")
            }

            override suspend fun openTerminal(workingDir: String) {
                any()?.openTerminal(workingDir) ?: warn("openTerminal")
            }

            override suspend fun openUrl(url: String) {
                any()?.openUrl(url) ?: warn("openUrl")
            }

            override suspend fun pickFiles(mode: String, multiple: Boolean): List<String> =
                any()?.pickFiles(mode, multiple) ?: run { warn("pickFiles"); emptyList() }

            override suspend fun updatePlugin() {
                any()?.updatePlugin() ?: warn("updatePlugin")
            }

            override suspend fun requiresRestart(): Boolean =
                any()?.requiresRestart() ?: run { warn("requiresRestart"); true }

            override suspend fun getIdeRoot(workingDir: String?): String? = basePath.ifBlank { null }
        }

        @Synchronized
        fun start() {
            // Alive → nothing to do. A backend that started and then exited (e.g. the
            // Node idle-shutdown timer fired between panels) reports isDead == true and
            // must be respawned — otherwise we'd hand callers a port no one is listening
            // on. (A still-spawning manager reports isDead == false, so concurrent panel
            // inits don't race a duplicate spawn.)
            nodeProcessManager?.let { if (!it.isDead) return }
            nodeProcessManager?.let { stop() } // clean up a dead manager/socket

            portDeferred = CompletableDeferred()
            // A WSL project root (UNC basePath) runs its backend inside the distro so
            // node/claude execute as Linux natives (issue #57); a native root runs locally.
            val wsl = WslPathResolver.parseUncPath(basePath)
            val manager = NodeProcessManager(
                scope,
                // Reuse the last bound port on respawn (0 only on first start) so a WebView
                // already pointing at this port reconnects instead of hitting a dead port.
                requestedPort = lastPort,
                instanceTag = instanceTag,
                wslDistro = wsl?.distro,
                wslCwd = wsl?.linuxPath,
            )
            nodeProcessManager = manager
            manager.start()
            scope.launch {
                try {
                    val port = manager.port.await()
                    lastPort = port
                    portDeferred.complete(port)
                    logger.info("Node.js backend for '$basePath' started on port $port")
                    connect(port)
                } catch (e: Exception) {
                    portDeferred.completeExceptionally(e)
                    logger.error("Failed to start Node.js backend for '$basePath'", e)
                }
            }
        }

        private fun connect(port: Int) {
            rpcClient?.dispose()
            val client = RpcWebSocketClient(
                scope,
                Router(),
                onPersistentFailure = { restart() },
                onConnected = { registerRoot() },
            )
            rpcClient = client
            client.connect(port)
            logger.info("RPC WebSocket client connecting to port $port (basePath=$basePath)")
        }

        /** Tell the backend which IDE project root this socket serves, for IDE-bound routing. */
        private fun registerRoot() {
            if (basePath.isBlank()) return
            val params = buildJsonObject { putJsonArray("roots") { add(basePath) } }
            rpcClient?.sendNotification("REGISTER_PROJECT_ROOTS", params)
        }

        @Synchronized
        fun restart() {
            stop()
            start()
        }

        fun sendNotification(method: String, params: JsonObject) {
            rpcClient?.sendNotification(method, params)
                ?: logger.warn("Cannot send '$method' — RPC client not ready (basePath=$basePath)")
        }

        suspend fun awaitPort(): Int = portDeferred.await()

        /** Kill the process — used by restart() for a clean slate. */
        fun stop() {
            rpcClient?.dispose(); rpcClient = null
            nodeProcessManager?.dispose(); nodeProcessManager = null
        }

        /** Detach without killing — the Node.js process self-exits on idle. */
        fun detach() {
            rpcClient?.dispose(); rpcClient = null
            nodeProcessManager?.detach(); nodeProcessManager = null
        }
    }

    /**
     * Ensure the backend for [projectBasePath] is started and register this
     * panel's RPC handler. First call for a root spawns its Node.js process;
     * later calls just register the handler.
     */
    @Synchronized
    fun ensureStarted(projectBasePath: String, panelId: String, rpcHandler: NodeProcessManager.RpcHandler) {
        val inst = backends.getOrPut(projectBasePath) { BackendInstance(projectBasePath) }
        inst.handlers[panelId] = rpcHandler
        inst.start() // no-op if already running
    }

    /** Await the port of the backend serving [projectBasePath]. */
    suspend fun awaitPort(projectBasePath: String): Int =
        (backends[projectBasePath]
            ?: error("No backend registered for project root: $projectBasePath")).awaitPort()

    /** Restart the backend for [projectBasePath] (retry path). */
    @Synchronized
    fun restart(projectBasePath: String) {
        backends[projectBasePath]?.restart()
            ?: logger.warn("restart: no backend for project root $projectBasePath")
    }

    /** Send a JSON-RPC notification to the backend serving [projectBasePath]. */
    fun sendNotification(projectBasePath: String, method: String, params: JsonObject) {
        backends[projectBasePath]?.sendNotification(method, params)
            ?: logger.warn("sendNotification: no backend for project root $projectBasePath")
    }

    /**
     * Remove a panel's handler from its root's backend. The Node.js process is
     * left running — it self-exits via its idle shutdown timer when all WebSocket
     * connections close.
     */
    fun releasePanel(projectBasePath: String, panelId: String) {
        val inst = backends[projectBasePath] ?: return
        inst.handlers.remove(panelId)
        logger.info("Panel released: $projectBasePath::$panelId (remaining handlers: ${inst.handlers.size})")
    }

    override fun dispose() {
        // IDE shutting down — dispose RPC clients and detach from the processes.
        // Browser clients may still be connected; Node.js self-exits on idle.
        // Do NOT cancel scope — that would close stdout/stderr pipes and SIGPIPE Node.
        backends.values.forEach { it.detach() }
        backends.clear()
        logger.info("NodeBackendService disposed (backends detached, not killed)")
    }

    companion object {
        fun getInstance(): NodeBackendService =
            ApplicationManager.getApplication().getService(NodeBackendService::class.java)
    }
}
