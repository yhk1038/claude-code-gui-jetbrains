package com.github.yhk1038.claudecodegui.bridge

import com.github.yhk1038.claudecodegui.services.ClaudeCliService
import com.github.yhk1038.claudecodegui.services.ClaudeSessionService
import com.github.yhk1038.claudecodegui.services.DiffService
import com.github.yhk1038.claudecodegui.services.SessionData
import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodePanel
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import kotlinx.coroutines.*
import kotlinx.serialization.json.*

/**
 * Bridge coordinator between ClaudeCliService and WebView
 * Handles bidirectional message routing and state synchronization
 */
class WebViewBridge(
    private val cliService: ClaudeCliService,
    private val panel: ClaudeCodePanel,
    private val scope: CoroutineScope,
    private val project: com.intellij.openapi.project.Project
) {
    private val logger = Logger.getInstance(WebViewBridge::class.java)
    private val diffService: DiffService = DiffService.getInstance(project)
    private val sessionService: ClaudeSessionService = project.service()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        prettyPrint = false
    }

    // Track current session state
    private var currentSessionId: String? = null
    private var isWaitingPermission = false
    private val pendingToolUses = mutableMapOf<String, ToolUseBlock>()

    // Jobs for message subscriptions
    private var messageSubscription: Job? = null
    private var errorSubscription: Job? = null

    init {
        setupCliListeners()
    }

    /**
     * Set up listeners for CLI service messages
     */
    private fun setupCliListeners() {
        // Subscribe to parsed messages from CLI
        messageSubscription = cliService.subscribeToMessages { message ->
            handleCliMessage(message)
        }

        // Subscribe to CLI service errors
        errorSubscription = cliService.subscribeToErrors { error ->
            handleCliError(error)
        }

        logger.info("WebViewBridge listeners initialized")
    }

    /**
     * Handle incoming IPC message from WebView
     */
    suspend fun handleWebViewMessage(type: String, requestId: String, payload: JsonObject): JsonObject {
        logger.debug("Received WebView message: type=$type, requestId=$requestId")

        return try {
            when (type) {
                "SEND_MESSAGE" -> handleSendMessage(payload)
                "SESSION_CHANGE" -> handleSessionChange(payload)
                "TOOL_RESPONSE" -> handleToolResponse(payload)
                "OPEN_DIFF" -> handleOpenDiff(payload)
                "APPLY_DIFF" -> handleApplyDiff(payload)
                "REJECT_DIFF" -> handleRejectDiff(payload)
                "START_SESSION" -> handleStartSession(payload)
                "STOP_SESSION" -> handleStopSession()
                "GET_SESSIONS" -> handleGetSessions(payload)
                "LOAD_SESSION" -> handleLoadSession(payload)
                "LOAD_SESSIONS" -> handleLoadSessions()
                "SAVE_SESSION" -> handleSaveSession(payload)
                "DELETE_SESSION" -> handleDeleteSession(payload)
                else -> {
                    logger.warn("Unknown message type: $type")
                    buildJsonObject {
                        put("status", "error")
                        put("error", "Unknown message type: $type")
                    }
                }
            }
        } catch (e: Exception) {
            logger.error("Error handling WebView message: $type", e)
            buildJsonObject {
                put("status", "error")
                put("error", e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Handle SEND_MESSAGE - User sends message to Claude
     */
    private suspend fun handleSendMessage(payload: JsonObject): JsonObject {
        val message = payload["content"]?.jsonPrimitive?.content
        if (message == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Missing content field")
            }
        }

        if (!cliService.isServiceRunning()) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Service not running")
            }
        }

        cliService.sendMessage(message)

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle SESSION_CHANGE - Request to change session
     */
    private suspend fun handleSessionChange(payload: JsonObject): JsonObject {
        val sessionId = payload["sessionId"]?.jsonPrimitive?.content

        currentSessionId = sessionId
        logger.info("Session changed: $sessionId")

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle TOOL_RESPONSE - User approves/rejects tool use
     */
    private suspend fun handleToolResponse(payload: JsonObject): JsonObject {
        val toolUseId = payload["toolUseId"]?.jsonPrimitive?.content
        val approved = payload["approved"]?.jsonPrimitive?.boolean ?: false
        val resultContent = payload["result"]?.jsonPrimitive?.content

        if (toolUseId == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Missing toolUseId")
            }
        }

        // Build tool result message
        val toolResult = if (approved) {
            ToolResult(
                tool_use_id = toolUseId,
                content = resultContent ?: "Tool execution approved",
                is_error = false
            )
        } else {
            ToolResult(
                tool_use_id = toolUseId,
                content = resultContent ?: "Tool execution rejected by user",
                is_error = true
            )
        }

        // Serialize and send to CLI
        val resultJson = json.encodeToString(ToolResult.serializer(), toolResult)
        cliService.sendMessage(resultJson)

        // Clear pending state
        pendingToolUses.remove(toolUseId)
        isWaitingPermission = false

        logger.info("Tool response sent: toolUseId=$toolUseId, approved=$approved")

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle OPEN_DIFF - Open IDE diff viewer
     */
    private suspend fun handleOpenDiff(payload: JsonObject): JsonObject {
        val filePath = payload["filePath"]?.jsonPrimitive?.content
        val oldContent = payload["oldContent"]?.jsonPrimitive?.content ?: ""
        val newContent = payload["newContent"]?.jsonPrimitive?.content

        if (filePath == null || newContent == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Missing filePath or newContent")
            }
        }

        // Open diff viewer
        diffService.openDiffViewer(filePath, oldContent, newContent)

        logger.info("Opened diff viewer: $filePath")

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle APPLY_DIFF - Apply file changes
     */
    private suspend fun handleApplyDiff(payload: JsonObject): JsonObject {
        val toolUseId = payload["toolUseId"]?.jsonPrimitive?.content
        val filePath = payload["filePath"]?.jsonPrimitive?.content
        val content = payload["content"]?.jsonPrimitive?.content
        val oldString = payload["oldString"]?.jsonPrimitive?.content
        val newString = payload["newString"]?.jsonPrimitive?.content
        val operation = payload["operation"]?.jsonPrimitive?.content

        if (toolUseId == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Missing toolUseId")
            }
        }

        // Apply file changes if file path is provided
        if (filePath != null && operation != null) {
            val result = when (operation) {
                "MODIFY" -> {
                    if (content != null) {
                        diffService.applyDiff(filePath, content)
                    } else if (oldString != null && newString != null) {
                        diffService.applyEdit(filePath, oldString, newString)
                    } else {
                        Result.failure(IllegalArgumentException("Missing content or old/new strings"))
                    }
                }
                "DELETE" -> {
                    diffService.deleteFile(filePath)
                }
                else -> Result.failure(IllegalArgumentException("Unknown operation: $operation"))
            }

            if (result.isFailure) {
                return buildJsonObject {
                    put("status", "error")
                    put("error", result.exceptionOrNull()?.message ?: "Failed to apply diff")
                }
            }

            logger.info("Applied diff: $filePath ($operation)")
        }

        // Send approval to CLI
        return handleToolResponse(buildJsonObject {
            put("toolUseId", toolUseId)
            put("approved", true)
        })
    }

    /**
     * Handle REJECT_DIFF - Reject file changes
     */
    private suspend fun handleRejectDiff(payload: JsonObject): JsonObject {
        val toolUseId = payload["toolUseId"]?.jsonPrimitive?.content
        if (toolUseId == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Missing toolUseId")
            }
        }

        // Send rejection
        return handleToolResponse(buildJsonObject {
            put("toolUseId", toolUseId)
            put("approved", false)
        })
    }

    /**
     * Handle START_SESSION - Start CLI service
     */
    private suspend fun handleStartSession(payload: JsonObject): JsonObject {
        if (cliService.isServiceRunning()) {
            return buildJsonObject {
                put("status", "ok")
                put("message", "Service already running")
            }
        }

        val result = cliService.start()
        return if (result.isSuccess) {
            buildJsonObject {
                put("status", "ok")
            }
        } else {
            buildJsonObject {
                put("status", "error")
                put("error", result.exceptionOrNull()?.message ?: "Failed to start service")
            }
        }
    }

    /**
     * Handle STOP_SESSION - Stop CLI service
     */
    private suspend fun handleStopSession(): JsonObject {
        cliService.stop()
        currentSessionId = null
        pendingToolUses.clear()
        isWaitingPermission = false

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle GET_SESSIONS - Get all saved sessions and return in ACK payload
     */
    private suspend fun handleGetSessions(payload: JsonObject): JsonObject {
        val sessions = sessionService.getAllSessions()

        logger.info("Returning ${sessions.size} sessions in ACK payload")

        return buildJsonObject {
            put("status", "ok")
            putJsonArray("sessions") {
                sessions.forEach { session ->
                    addJsonObject {
                        put("sessionId", session.id)
                        put("firstPrompt", session.title)
                        put("created", session.createdAt)
                        put("modified", session.updatedAt)
                        put("messageCount", if (session.messageCount >= 0) session.messageCount else session.messages.size)
                    }
                }
            }
        }
    }

    /**
     * Handle LOAD_SESSION - Load a specific session and send messages to WebView
     */
    private suspend fun handleLoadSession(payload: JsonObject): JsonObject {
        val sessionId = payload["sessionId"]?.jsonPrimitive?.content
        if (sessionId == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Missing sessionId")
            }
        }

        val session = sessionService.getSession(sessionId)
        if (session == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Session not found: $sessionId")
            }
        }

        // Send SESSION_LOADED event with messages
        panel.sendToWebView("SESSION_LOADED", mapOf(
            "sessionId" to session.id,
            "messages" to session.messages
        ))

        currentSessionId = sessionId
        logger.info("Loaded session: $sessionId with ${session.messages.size} messages")

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle LOAD_SESSIONS - Legacy handler, redirects to GET_SESSIONS
     */
    private suspend fun handleLoadSessions(): JsonObject {
        return handleGetSessions(buildJsonObject {})
    }

    /**
     * Handle SAVE_SESSION - Save session to disk
     */
    private suspend fun handleSaveSession(payload: JsonObject): JsonObject {
        val sessionId = payload["sessionId"]?.jsonPrimitive?.content
        val title = payload["title"]?.jsonPrimitive?.content
        val createdAt = payload["createdAt"]?.jsonPrimitive?.content
        val updatedAt = payload["updatedAt"]?.jsonPrimitive?.content
        val messages = payload["messages"]?.jsonArray

        if (sessionId == null || title == null || createdAt == null || updatedAt == null || messages == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Missing required fields")
            }
        }

        val sessionData = SessionData(
            id = sessionId,
            title = title,
            createdAt = createdAt,
            updatedAt = updatedAt,
            messages = messages.toList()
        )

        val result = sessionService.saveSession(sessionData)

        return if (result.isSuccess) {
            buildJsonObject {
                put("status", "ok")
            }
        } else {
            buildJsonObject {
                put("status", "error")
                put("error", result.exceptionOrNull()?.message ?: "Failed to save session")
            }
        }
    }

    /**
     * Handle DELETE_SESSION - Delete session file
     */
    private suspend fun handleDeleteSession(payload: JsonObject): JsonObject {
        val sessionId = payload["sessionId"]?.jsonPrimitive?.content

        if (sessionId == null) {
            return buildJsonObject {
                put("status", "error")
                put("error", "Missing sessionId")
            }
        }

        val result = sessionService.deleteSession(sessionId)

        return if (result.isSuccess) {
            buildJsonObject {
                put("status", "ok")
            }
        } else {
            buildJsonObject {
                put("status", "error")
                put("error", result.exceptionOrNull()?.message ?: "Failed to delete session")
            }
        }
    }

    /**
     * Handle messages from CLI and forward to WebView
     */
    private suspend fun handleCliMessage(message: StreamParser.ParsedMessage) {
        when (message) {
            is StreamParser.ParsedMessage.System -> handleSystemMessage(message.data)
            is StreamParser.ParsedMessage.Assistant -> handleAssistantMessage(message.data)
            is StreamParser.ParsedMessage.StreamEvent -> handleStreamEvent(message.data)
            is StreamParser.ParsedMessage.Result -> handleResultMessage(message.data)
            is StreamParser.ParsedMessage.Unknown -> handleUnknownMessage(message.type, message.raw)
        }
    }

    /**
     * Handle system message (session initialization)
     */
    private fun handleSystemMessage(data: SystemMessage) {
        currentSessionId = data.session_id
        logger.info("Session initialized: ${data.session_id}")

        panel.sendToWebView("STREAM_EVENT", mapOf(
            "eventType" to "system",
            "sessionId" to data.session_id,
            "timestamp" to data.timestamp,
            "content" to data.content
        ))
    }

    /**
     * Handle assistant message
     */
    private fun handleAssistantMessage(data: AssistantMessage) {
        logger.debug("Assistant message: ${data.message_id}")

        // Parse content blocks
        val contentBlocks = mutableListOf<Map<String, Any?>>()

        for (element in data.content) {
            try {
                val obj = element.jsonObject
                val type = obj["type"]?.jsonPrimitive?.content

                when (type) {
                    "text" -> {
                        val text = json.decodeFromJsonElement(TextBlock.serializer(), element)
                        contentBlocks.add(mapOf(
                            "type" to "text",
                            "text" to text.text
                        ))
                    }
                    "tool_use" -> {
                        val toolUse = json.decodeFromJsonElement(ToolUseBlock.serializer(), element)

                        // Check if permission is required
                        val permissionType = requiresPermission(toolUse.name)
                        if (permissionType != null) {
                            pendingToolUses[toolUse.id] = toolUse
                            isWaitingPermission = true
                        }

                        // Extract file change if applicable
                        val fileChange = extractFileChange(toolUse.id, toolUse.name, toolUse.input)

                        contentBlocks.add(buildMap {
                            put("type", "tool_use")
                            put("id", toolUse.id)
                            put("name", toolUse.name)
                            put("input", toolUse.input)
                            if (permissionType != null) {
                                put("requiresPermission", permissionType.name)
                                put("riskLevel", getRiskLevel(toolUse.name).name)
                            }
                            if (fileChange != null) {
                                put("fileChange", mapOf(
                                    "filePath" to fileChange.filePath,
                                    "operation" to fileChange.operation.name,
                                    "content" to fileChange.content,
                                    "oldString" to fileChange.oldString,
                                    "newString" to fileChange.newString
                                ))
                            }
                        })
                    }
                }
            } catch (e: Exception) {
                logger.error("Failed to parse content block", e)
            }
        }

        panel.sendToWebView("ASSISTANT_MESSAGE", mapOf(
            "messageId" to data.message_id,
            "content" to contentBlocks
        ))
    }

    /**
     * Handle stream event (text/tool use deltas)
     */
    private fun handleStreamEvent(data: StreamEvent) {
        logger.debug("Stream event: ${data.event}")

        val deltaData = mutableMapOf<String, Any?>(
            "event" to data.event
        )

        if (data.index != null) {
            deltaData["index"] = data.index
        }

        if (data.delta != null) {
            try {
                val deltaObj = data.delta.jsonObject
                val deltaType = deltaObj["type"]?.jsonPrimitive?.content

                when (deltaType) {
                    "text_delta" -> {
                        val textDelta = json.decodeFromJsonElement(TextDelta.serializer(), data.delta)
                        deltaData["delta"] = mapOf(
                            "type" to "text_delta",
                            "text" to textDelta.text
                        )
                    }
                    "tool_use_delta" -> {
                        val toolDelta = json.decodeFromJsonElement(ToolUseDelta.serializer(), data.delta)
                        deltaData["delta"] = mapOf(
                            "type" to "tool_use_delta",
                            "id" to toolDelta.id,
                            "name" to toolDelta.name,
                            "input" to toolDelta.input
                        )
                    }
                }
            } catch (e: Exception) {
                logger.error("Failed to parse delta", e)
            }
        }

        panel.sendToWebView("STREAM_EVENT", deltaData)
    }

    /**
     * Handle result message (completion)
     */
    private fun handleResultMessage(data: ResultMessage) {
        logger.info("Result message: status=${data.status}")

        panel.sendToWebView("RESULT_MESSAGE", mapOf(
            "status" to data.status,
            "messageId" to data.message_id,
            "usage" to data.usage?.let { mapOf(
                "inputTokens" to it.input_tokens,
                "outputTokens" to it.output_tokens
            ) },
            "error" to data.error?.let { mapOf(
                "code" to it.code,
                "message" to it.message,
                "details" to it.details
            ) }
        ))

        // Clear permission state after completion
        isWaitingPermission = false
    }

    /**
     * Handle unknown message type
     */
    private fun handleUnknownMessage(type: String, raw: JsonElement) {
        logger.warn("Unknown message type: $type")

        panel.sendToWebView("UNKNOWN_MESSAGE", mapOf(
            "type" to type,
            "raw" to raw.toString()
        ))
    }

    /**
     * Handle CLI service errors
     */
    private fun handleCliError(error: ClaudeCliService.ServiceError) {
        logger.error("CLI service error: $error")

        val errorData = when (error) {
            is ClaudeCliService.ServiceError.CliNotFound -> mapOf(
                "type" to "CLI_NOT_FOUND",
                "searchPaths" to error.searchPaths
            )
            is ClaudeCliService.ServiceError.InvalidVersion -> mapOf(
                "type" to "INVALID_VERSION",
                "version" to error.version,
                "minVersion" to error.minVersion
            )
            is ClaudeCliService.ServiceError.ProcessFailed -> mapOf(
                "type" to "PROCESS_FAILED",
                "reason" to error.reason,
                "exitCode" to error.exitCode
            )
            is ClaudeCliService.ServiceError.ParseError -> mapOf(
                "type" to "PARSE_ERROR",
                "line" to error.line,
                "error" to error.error
            )
        }

        panel.sendToWebView("SERVICE_ERROR", errorData)
    }

    /**
     * Check if currently waiting for permission
     */
    fun isWaitingForPermission(): Boolean = isWaitingPermission

    /**
     * Get current session ID
     */
    fun getCurrentSessionId(): String? = currentSessionId

    /**
     * Cleanup on disposal
     */
    fun dispose() {
        messageSubscription?.cancel()
        errorSubscription?.cancel()
        pendingToolUses.clear()
        logger.info("WebViewBridge disposed")
    }
}
