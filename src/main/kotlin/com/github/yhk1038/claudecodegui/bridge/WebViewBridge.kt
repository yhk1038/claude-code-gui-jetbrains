package com.github.yhk1038.claudecodegui.bridge

import com.github.yhk1038.claudecodegui.actions.OpenClaudeCodeAction
import com.github.yhk1038.claudecodegui.services.ClaudeCliService
import com.github.yhk1038.claudecodegui.services.ClaudeSessionService
import com.github.yhk1038.claudecodegui.services.DiffService
import com.github.yhk1038.claudecodegui.services.SessionData
import com.github.yhk1038.claudecodegui.settings.SettingsManager
import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodePanel
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.vfs.LocalFileSystem
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect
import kotlinx.serialization.json.*
import java.util.UUID

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

    // Local CLI process management (per-tab isolation)
    private var processManager: ProcessManager? = null
    private var streamParser: StreamParser? = null
    private var parserJob: Job? = null
    private var isServiceRunning = false

    init {
        setupCliListeners()
    }

    /**
     * Set up listeners for CLI service messages
     */
    private fun setupCliListeners() {
        // No longer subscribing to shared cliService.messageFlow
        // Message subscriptions are set up in startCliProcess() when parser is created
        logger.info("WebViewBridge initialized (per-tab process isolation)")
    }

    /**
     * Start a per-tab CLI process
     */
    private suspend fun startCliProcess(sessionId: String? = null, workingDir: String? = null): Result<Unit> {
        if (isServiceRunning) {
            logger.info("CLI process already running for this tab")
            return Result.success(Unit)
        }

        val detectedPath = cliService.detectCliPath()
        if (detectedPath == null) {
            val error = ClaudeCliService.ServiceError.CliNotFound(
                listOf("/usr/local/bin/claude", "/opt/homebrew/bin/claude", "~/.claude/bin/claude", "which claude (PATH)")
            )
            handleCliError(error)
            return Result.failure(Exception("Claude CLI not found"))
        }

        if (!cliService.validateVersion(detectedPath)) {
            val error = ClaudeCliService.ServiceError.InvalidVersion("unknown", "1.0.0")
            handleCliError(error)
            return Result.failure(Exception("Invalid CLI version"))
        }

        logger.info("Starting per-tab CLI process: $detectedPath")

        val manager = ProcessManager(project, detectedPath, scope)
        processManager = manager

        val parser = StreamParser(scope)
        streamParser = parser

        parserJob = manager.connectToParser(parser, scope)

        // Subscribe to parsed messages locally
        messageSubscription = parser.subscribe { message ->
            handleCliMessage(message)
        }

        // Subscribe to parse errors locally
        errorSubscription = scope.launch {
            parser.errorFlow.collect { parseError ->
                handleCliError(ClaudeCliService.ServiceError.ParseError(parseError.line, parseError.error))
            }
        }

        // Monitor process state
        scope.launch {
            manager.stateFlow.collect { state ->
                when (state) {
                    is ProcessManager.ProcessState.Running -> {
                        isServiceRunning = true
                        logger.info("Per-tab CLI process is running")
                    }
                    is ProcessManager.ProcessState.Stopped -> {
                        isServiceRunning = false
                        logger.info("Per-tab CLI process stopped")
                    }
                    is ProcessManager.ProcessState.Failed -> {
                        isServiceRunning = false
                        handleCliError(ClaudeCliService.ServiceError.ProcessFailed(state.reason, state.exitCode))
                    }
                    else -> {}
                }
            }
        }

        manager.start(sessionId, workingDir)
        isServiceRunning = true

        logger.info("Per-tab CLI process started successfully (sessionId=$sessionId, workingDir=$workingDir)")
        return Result.success(Unit)
    }

    /**
     * Stop the per-tab CLI process
     */
    private suspend fun stopCliProcess() {
        parserJob?.cancel()
        parserJob = null

        processManager?.stop()
        processManager = null

        streamParser?.reset()
        streamParser = null

        isServiceRunning = false
        logger.info("Per-tab CLI process stopped")
    }

    /**
     * Send message to the per-tab CLI process
     */
    private suspend fun sendCliMessage(message: String) {
        if (!isServiceRunning) {
            throw IllegalStateException("Per-tab CLI process not running")
        }

        val escapedContent = buildString {
            for (ch in message) {
                when (ch) {
                    '"' -> append("\\\"")
                    '\\' -> append("\\\\")
                    '\n' -> append("\\n")
                    '\r' -> append("\\r")
                    '\t' -> append("\\t")
                    else -> append(ch)
                }
            }
        }
        val jsonMessage = """{"type":"user","message":{"role":"user","content":"$escapedContent"}}"""
        processManager?.sendInput(jsonMessage)
        logger.info("Sent message to per-tab CLI: ${jsonMessage.take(200)}...")
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
                // "SAVE_SESSION" removed - CLI sessions are read-only
                "DELETE_SESSION" -> handleDeleteSession(payload)
                "NEW_SESSION" -> handleNewSession()
                "OPEN_SETTINGS" -> handleOpenSettings()
                "OPEN_FILE" -> handleOpenFile(payload)
                "GET_SETTINGS" -> handleGetSettings()
                "SAVE_SETTINGS" -> handleSaveSettings(payload)
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

        val sessionId = payload["sessionId"]?.jsonPrimitive?.content
        val isNewSession = payload["isNewSession"]?.jsonPrimitive?.boolean ?: false
        val workingDir = payload["workingDir"]?.jsonPrimitive?.contentOrNull

        // Update current session ID from WebView
        if (sessionId != null) {
            currentSessionId = sessionId
        }

        // Lazy-start: start per-tab CLI process if not running
        if (!isServiceRunning) {
            logger.info("Per-tab CLI process not running, starting automatically...")
            val startResult = startCliProcess(sessionId, workingDir)
            if (startResult.isFailure) {
                return buildJsonObject {
                    put("status", "error")
                    put("error", "Failed to start CLI process: ${startResult.exceptionOrNull()?.message}")
                }
            }
        }

        sendCliMessage(message)

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
        sendCliMessage(resultJson)

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
        if (isServiceRunning) {
            return buildJsonObject {
                put("status", "ok")
                put("message", "Service already running")
            }
        }

        val result = startCliProcess()
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
        stopCliProcess()
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

    // handleSaveSession removed - CLI sessions are read-only

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
     * Handle NEW_SESSION - Open new Claude Code editor tab
     * Note: This does NOT reset the current tab's state - that's handled by openNewTab() in SessionContext
     */
    private fun handleNewSession(): JsonObject {
        ApplicationManager.getApplication().invokeLater {
            val newSessionId = UUID.randomUUID().toString()
            OpenClaudeCodeAction.openSession(project, newSessionId)
            logger.info("Opened new Claude Code tab: $newSessionId")
        }

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle OPEN_SETTINGS - Open settings in a new editor tab
     */
    private fun handleOpenSettings(): JsonObject {
        ApplicationManager.getApplication().invokeLater {
            val settingsSessionId = "settings-${UUID.randomUUID()}"
            OpenClaudeCodeAction.openSession(project, settingsSessionId, "#/settings/general")
            logger.info("Opened settings in new tab: $settingsSessionId")
        }

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle OPEN_FILE - Open a file in the IDE editor
     */
    private fun handleOpenFile(payload: JsonObject): JsonObject {
        val filePath = payload["filePath"]?.jsonPrimitive?.content
        if (filePath == null) {
            return errorResponse("Missing filePath")
        }

        ApplicationManager.getApplication().invokeLater {
            val virtualFile = LocalFileSystem.getInstance().findFileByPath(filePath)
            if (virtualFile != null) {
                FileEditorManager.getInstance(project).openFile(virtualFile, true)
                logger.info("Opened file in editor: $filePath")
            } else {
                logger.warn("File not found: $filePath")
            }
        }

        return buildJsonObject {
            put("status", "ok")
        }
    }

    /**
     * Handle GET_SETTINGS - Return all settings to WebView
     */
    private fun handleGetSettings(): JsonObject {
        val settings = SettingsManager.getInstance()
        return buildJsonObject {
            put("status", "ok")
            put("settings", settings.getAll())
        }
    }

    /**
     * Handle SAVE_SETTINGS - Update a single setting
     */
    private fun handleSaveSettings(payload: JsonObject): JsonObject {
        val key = payload["key"]?.jsonPrimitive?.content
            ?: return errorResponse("Missing key")

        val settings = SettingsManager.getInstance()

        try {
            val value: JsonElement = when (key) {
                "cliPath" -> {
                    payload["value"]?.jsonPrimitive?.let {
                        if (it.contentOrNull == null) JsonNull else it
                    } ?: JsonNull
                }
                "permissionMode" -> {
                    val v = payload["value"]?.jsonPrimitive?.contentOrNull
                        ?: return errorResponse("Missing value for permissionMode")
                    if (v !in listOf("ALWAYS_ASK", "AUTO_APPROVE_SAFE", "AUTO_APPROVE_ALL")) {
                        return errorResponse("Invalid permissionMode: $v")
                    }
                    JsonPrimitive(v)
                }
                "autoApplyLowRisk" -> {
                    val v = payload["value"]?.jsonPrimitive?.booleanOrNull
                        ?: return errorResponse("Missing or invalid value for autoApplyLowRisk")
                    JsonPrimitive(v)
                }
                "theme" -> {
                    val v = payload["value"]?.jsonPrimitive?.contentOrNull
                        ?: return errorResponse("Missing value for theme")
                    if (v !in listOf("system", "light", "dark")) {
                        return errorResponse("Invalid theme: $v")
                    }
                    JsonPrimitive(v)
                }
                "fontSize" -> {
                    val v = payload["value"]?.jsonPrimitive?.intOrNull
                        ?: return errorResponse("Missing or invalid value for fontSize")
                    if (v !in 8..32) {
                        return errorResponse("fontSize out of range (8-32): $v")
                    }
                    JsonPrimitive(v)
                }
                "debugMode" -> {
                    val v = payload["value"]?.jsonPrimitive?.booleanOrNull
                        ?: return errorResponse("Missing or invalid value for debugMode")
                    JsonPrimitive(v)
                }
                "logLevel" -> {
                    val v = payload["value"]?.jsonPrimitive?.contentOrNull
                        ?: return errorResponse("Missing value for logLevel")
                    if (v !in listOf("debug", "info", "warn", "error")) {
                        return errorResponse("Invalid logLevel: $v")
                    }
                    JsonPrimitive(v)
                }
                "initialInputMode" -> {
                    val v = payload["value"]?.jsonPrimitive?.contentOrNull
                        ?: return errorResponse("Missing value for initialInputMode")
                    if (v !in listOf("plan", "bypass", "ask_before_edit", "auto_edit")) {
                        return errorResponse("Invalid initialInputMode: $v")
                    }
                    JsonPrimitive(v)
                }
                else -> return errorResponse("Unknown setting key: $key")
            }

            val success = settings.set(key, value)
            if (!success) {
                return errorResponse("Failed to save setting: $key")
            }

            logger.info("Setting updated: $key")
            return buildJsonObject { put("status", "ok") }

        } catch (e: Exception) {
            return errorResponse("Invalid value for key $key: ${e.message}")
        }
    }

    private fun errorResponse(message: String): JsonObject = buildJsonObject {
        put("status", "error")
        put("error", message)
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
        logger.info("System message: subtype=${data.subtype}, session=${data.session_id}")

        panel.sendToWebView("STREAM_EVENT", mapOf(
            "eventType" to "system",
            "subtype" to data.subtype,
            "sessionId" to data.session_id,
            "cwd" to data.cwd,
            "model" to data.model
        ))
    }

    /**
     * Handle assistant message
     */
    private fun handleAssistantMessage(data: AssistantMessage) {
        val messageId = data.message?.id ?: data.message_id
        val contentElements = data.message?.content ?: data.content ?: emptyList()

        logger.debug("Assistant message: $messageId")

        // Parse content blocks
        val contentBlocks = mutableListOf<Map<String, Any?>>()

        for (element in contentElements) {
            try {
                val obj = element.jsonObject
                val type = obj["type"]?.jsonPrimitive?.content

                when (type) {
                    "thinking" -> {
                        val thinkingBlock = json.decodeFromJsonElement(ThinkingBlock.serializer(), element)
                        contentBlocks.add(mapOf(
                            "type" to "thinking",
                            "thinking" to thinkingBlock.thinking,
                            "signature" to thinkingBlock.signature
                        ))
                    }
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
            "messageId" to messageId,
            "content" to contentBlocks
        ))
    }

    /**
     * Handle stream event (text/tool use deltas)
     */
    private fun handleStreamEvent(data: StreamEvent) {
        val eventObj = data.event
        if (eventObj == null) {
            logger.warn("Stream event with null event field")
            return
        }

        try {
            val eventJsonObj = eventObj.jsonObject
            val eventType = eventJsonObj["type"]?.jsonPrimitive?.content

            logger.debug("Stream event: $eventType")

            // Extract index and delta from inside the event object
            val index = eventJsonObj["index"]?.jsonPrimitive?.intOrNull
            val delta = eventJsonObj["delta"]

            val deltaData = mutableMapOf<String, Any?>(
                "event" to eventType
            )

            if (index != null) {
                deltaData["index"] = index
            }

            if (delta != null) {
                try {
                    val deltaObj = delta.jsonObject
                    val deltaType = deltaObj["type"]?.jsonPrimitive?.content

                    when (deltaType) {
                        "text_delta" -> {
                            val textDelta = json.decodeFromJsonElement(TextDelta.serializer(), delta)
                            deltaData["delta"] = mapOf(
                                "type" to "text_delta",
                                "text" to textDelta.text
                            )
                        }
                        "tool_use_delta" -> {
                            deltaData["delta"] = mapOf(
                                "type" to "tool_use_delta",
                                "id" to deltaObj["id"]?.jsonPrimitive?.contentOrNull,
                                "name" to deltaObj["name"]?.jsonPrimitive?.contentOrNull,
                                "input" to deltaObj["input"]
                            )
                        }
                        "thinking_delta" -> {
                            val thinkingDelta = json.decodeFromJsonElement(ThinkingDelta.serializer(), delta)
                            deltaData["delta"] = mapOf(
                                "type" to "thinking_delta",
                                "thinking" to thinkingDelta.thinking
                            )
                        }
                    }
                } catch (e: Exception) {
                    logger.error("Failed to parse stream event delta", e)
                }
            }

            panel.sendToWebView("STREAM_EVENT", deltaData)

        } catch (e: Exception) {
            logger.error("Failed to parse stream event", e)
        }
    }

    /**
     * Handle result message (completion)
     */
    private fun handleResultMessage(data: ResultMessage) {
        val status = data.subtype ?: data.status ?: "unknown"
        logger.info("Result message: status=$status, isError=${data.is_error}")

        panel.sendToWebView("RESULT_MESSAGE", mapOf(
            "status" to status,
            "isError" to data.is_error,
            "result" to data.result,
            "sessionId" to data.session_id,
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

        // Cleanup per-tab CLI process
        scope.launch {
            stopCliProcess()
        }

        logger.info("WebViewBridge disposed")
    }
}
