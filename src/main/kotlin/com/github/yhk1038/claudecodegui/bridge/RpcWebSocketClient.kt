package com.github.yhk1038.claudecodegui.bridge

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.WebSocket
import java.util.concurrent.CompletionStage
import java.util.concurrent.CompletableFuture

/**
 * WebSocket client that connects to the Node.js backend's /rpc endpoint.
 * Receives JSON-RPC requests from the backend and dispatches them to
 * the provided RpcHandler (which routes to the correct project's panel).
 *
 * This replaces the old stdout/stdin JSON-RPC communication, enabling
 * reconnection when the IDE restarts without needing to re-spawn the backend.
 */
class RpcWebSocketClient(
    private val scope: CoroutineScope,
    private val rpcHandler: NodeProcessManager.RpcHandler,
    private val onPersistentFailure: (() -> Unit)? = null
) : Disposable {

    private val logger = Logger.getInstance(RpcWebSocketClient::class.java)
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private var webSocket: WebSocket? = null
    private var reconnectJob: Job? = null

    @Volatile
    private var disposed = false

    private var consecutiveFailures = 0
    private val MAX_FAILURES_BEFORE_RESTART = 5

    /**
     * Connect to the RPC WebSocket endpoint.
     * Automatically retries on failure with exponential backoff.
     */
    fun connect(port: Int) {
        connectInternal(port)
    }

    /**
     * Send a JSON-RPC notification (no id, no response expected) to the Node.js backend.
     * Used for IDE-originated events such as native drag-and-drop that the backend then
     * routes to the appropriate webview connection.
     */
    fun sendNotification(method: String, params: JsonObject) {
        val ws = webSocket
        if (ws == null) {
            logger.warn("RPC WebSocket not connected; dropping notification: $method")
            return
        }
        val message = buildJsonObject {
            put("jsonrpc", "2.0")
            put("method", method)
            put("params", params)
        }
        val text = json.encodeToString(JsonObject.serializer(), message)
        logger.debug("[NativeDrop] sendNotification method=$method, payload length=${text.length}")
        ws.sendText(text, true)
    }

    private fun connectInternal(port: Int) {
        if (disposed) return

        val client = HttpClient.newHttpClient()
        val uri = URI.create("ws://127.0.0.1:$port/rpc")

        logger.info("Connecting to RPC WebSocket: $uri")

        client.newWebSocketBuilder()
            .buildAsync(uri, RpcWebSocketListener(port))
            .thenAccept { ws ->
                webSocket = ws
                consecutiveFailures = 0
                logger.info("RPC WebSocket connected to port $port")
            }
            .exceptionally { e ->
                logger.warn("RPC WebSocket connection failed: ${e.message}")
                consecutiveFailures++
                if (consecutiveFailures >= MAX_FAILURES_BEFORE_RESTART) {
                    logger.warn("RPC WebSocket reached $consecutiveFailures consecutive failures, triggering restart")
                    consecutiveFailures = 0
                    scope.launch { onPersistentFailure?.invoke() }
                } else {
                    scheduleReconnect(port)
                }
                null
            }
    }

    private fun scheduleReconnect(port: Int, delayMs: Long = 3000) {
        if (disposed) return
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(delayMs)
            if (!disposed) {
                logger.info("Attempting RPC WebSocket reconnection...")
                connectInternal(port)
            }
        }
    }

    private inner class RpcWebSocketListener(private val port: Int) : WebSocket.Listener {
        private val messageBuffer = StringBuilder()

        override fun onOpen(webSocket: WebSocket) {
            logger.info("RPC WebSocket opened")
            webSocket.request(1)
        }

        override fun onText(webSocket: WebSocket, data: CharSequence, last: Boolean): CompletionStage<*> {
            logger.info("[DEBUG:onText] received data.length=${data.length}, last=$last, preview='${data.toString().take(80)}'")
            messageBuffer.append(data)
            if (last) {
                val message = messageBuffer.toString()
                messageBuffer.clear()
                handleMessage(webSocket, message)
            }
            webSocket.request(1)
            return CompletableFuture.completedFuture(null)
        }

        override fun onClose(webSocket: WebSocket, statusCode: Int, reason: String): CompletionStage<*> {
            logger.info("RPC WebSocket closed: $statusCode $reason")
            this@RpcWebSocketClient.webSocket = null
            scheduleReconnect(port)
            return CompletableFuture.completedFuture(null)
        }

        override fun onError(webSocket: WebSocket, error: Throwable) {
            logger.warn("RPC WebSocket error: ${error.message}")
            this@RpcWebSocketClient.webSocket = null
            scheduleReconnect(port)
        }
    }

    /**
     * Handle incoming JSON-RPC request from Node.js backend.
     * Parse, dispatch to rpcHandler, and send response back.
     */
    private fun handleMessage(ws: WebSocket, message: String) {
        logger.info("[DEBUG:handleMessage] entered, message.length=${message.length}, blank=${message.isBlank()}, preview='${message.take(100)}'")
        if (message.isBlank()) return

        scope.launch {
            try {
                val request = json.parseToJsonElement(message).jsonObject
                val id = request["id"]?.jsonPrimitive?.content
                val method = request["method"]?.jsonPrimitive?.content
                val params = request["params"]?.jsonObject ?: buildJsonObject {}

                if (method == null) {
                    if (id != null) sendError(ws, id, -32600, "Missing method")
                    return@launch
                }

                logger.info("[DEBUG:handleMessage] method=$method, id=$id, params=$params")

                try {
                    val result = dispatchRpc(method, params)
                    if (id != null) sendResult(ws, id, result)
                } catch (e: Exception) {
                    logger.error("Error executing RPC method '$method'", e)
                    if (id != null) sendError(ws, id, -32000, e.message ?: "Internal error")
                }
            } catch (e: Exception) {
                logger.warn("Failed to parse RPC message: ${message.take(200)}")
            }
        }
    }

    /**
     * Dispatch JSON-RPC method to the appropriate RpcHandler method.
     * This is the same dispatch logic that was in NodeProcessManager.handleJsonRpcRequest().
     */
    private suspend fun dispatchRpc(method: String, params: JsonObject): JsonObject {
        return when (method) {
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
            "REFRESH_FILES" -> {
                rpcHandler.refreshFiles(parseRefreshFilePaths(params))
                buildJsonObject {}
            }
            "CREATE_SESSION" -> {
                val workingDir = params["workingDir"]?.jsonPrimitive?.content ?: ""
                rpcHandler.createSession(workingDir)
                buildJsonObject {}
            }
            "OPEN_NEW_TAB" -> {
                val workingDir = params["workingDir"]?.jsonPrimitive?.content ?: ""
                logger.info("[DEBUG:RpcWS] OPEN_NEW_TAB received, params=$params, resolved workingDir='$workingDir'")
                rpcHandler.openNewTab(workingDir)
                buildJsonObject {}
            }
            "OPEN_SETTINGS" -> {
                val workingDir = params["workingDir"]?.jsonPrimitive?.content ?: ""
                logger.info("[DEBUG:RpcWS] OPEN_SETTINGS received, params=$params, resolved workingDir='$workingDir'")
                rpcHandler.openSettings(workingDir)
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
            "PICK_FILES" -> {
                val mode = params["mode"]?.jsonPrimitive?.content ?: "files"
                val multiple = params["multiple"]?.jsonPrimitive?.booleanOrNull ?: true
                val paths = rpcHandler.pickFiles(mode, multiple)
                buildJsonObject {
                    putJsonArray("paths") {
                        paths.forEach { path -> add(path) }
                    }
                }
            }
            "UPDATE_PLUGIN" -> {
                rpcHandler.updatePlugin()
                buildJsonObject {}
            }
            "REQUIRES_RESTART" -> {
                val requires = rpcHandler.requiresRestart()
                buildJsonObject { put("requiresRestart", requires) }
            }
            "GET_IDE_ROOT" -> {
                val workingDir = params["workingDir"]?.jsonPrimitive?.content
                val ideRoot = rpcHandler.getIdeRoot(workingDir)
                buildJsonObject {
                    if (ideRoot != null) put("ideRoot", ideRoot) else put("ideRoot", JsonNull)
                }
            }
            else -> {
                throw IllegalArgumentException("Unknown RPC method: $method")
            }
        }
    }

    private fun sendResult(ws: WebSocket, id: String, result: JsonObject) {
        val response = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", id)
            put("result", result)
        }
        val text = json.encodeToString(JsonObject.serializer(), response)
        ws.sendText(text, true)
    }

    private fun sendError(ws: WebSocket, id: String, code: Int, message: String) {
        val response = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", id)
            putJsonObject("error") {
                put("code", code)
                put("message", message)
            }
        }
        val text = json.encodeToString(JsonObject.serializer(), response)
        ws.sendText(text, true)
    }

    override fun dispose() {
        disposed = true
        reconnectJob?.cancel()
        try {
            webSocket?.sendClose(WebSocket.NORMAL_CLOSURE, "IDE shutting down")
        } catch (e: Exception) {
            logger.debug("Error closing RPC WebSocket: ${e.message}")
        }
        webSocket = null
        logger.info("RpcWebSocketClient disposed")
    }
}

/**
 * Extracts the "paths" string array from REFRESH_FILES params, skipping any
 * non-string entries. Returns an empty list when the param is missing, empty,
 * or not an array. Kept top-level and internal so it can be unit-tested without
 * a live WebSocket.
 */
internal fun parseRefreshFilePaths(params: JsonObject): List<String> {
    val array = params["paths"] as? JsonArray ?: return emptyList()
    return array.mapNotNull { element ->
        (element as? JsonPrimitive)?.takeIf { it.isString }?.content
    }
}
