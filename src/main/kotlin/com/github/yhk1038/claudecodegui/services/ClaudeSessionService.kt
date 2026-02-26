package com.github.yhk1038.claudecodegui.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import java.util.UUID

/**
 * Session data model for persistence
 */
@Serializable
data class SessionData(
    val id: String,
    val title: String,
    val createdAt: String,
    val lastTimestamp: String? = null,
    val messages: List<JsonElement>,
    val messageCount: Int = -1,  // -1 means use messages.size
    val isSidechain: Boolean = false
)

/**
 * Claude CLI session index entry
 */
@Serializable
data class CliSessionEntry(
    val sessionId: String,
    val fullPath: String? = null,
    val fileMtime: Long? = null,
    val firstPrompt: String? = null,
    val messageCount: Int = 0,
    val created: String,
    val modified: String,
    val gitBranch: String? = null,
    val projectPath: String? = null,
    val isSidechain: Boolean = false
)

@Serializable
data class CliSessionIndex(
    val version: Int = 1,
    val entries: List<CliSessionEntry> = emptyList()
)

/**
 * Service for managing Claude Code sessions (read-only from CLI)
 * Sessions are read from ~/.claude/projects/{normalizedPath}/sessions-index.json
 */
@Service(Service.Level.PROJECT)
class ClaudeSessionService(private val project: Project) {
    private val logger = Logger.getInstance(ClaudeSessionService::class.java)

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        prettyPrint = true
    }

    // Local sessions directory removed - using CLI sessions only

    /**
     * Claude CLI sessions directory: ~/.claude/projects/{normalized-path}
     */
    private val cliSessionsDir: File
        get() {
            val projectPath = project.basePath ?: return File(System.getProperty("user.home"), ".claude/projects")
            val normalizedPath = projectPath.replace("/", "-")
            return File(System.getProperty("user.home"), ".claude/projects/$normalizedPath")
        }

    /**
     * Create a new session with unique ID
     */
    fun createSession(): String {
        return UUID.randomUUID().toString()
    }

    /**
     * Get session by ID - CLI sessions only
     */
    fun getSession(id: String): SessionData? {
        return getCliSession(id)
    }

    private fun getCliSession(id: String): SessionData? {
        return try {
            val jsonlFile = File(cliSessionsDir, "$id.jsonl")
            if (!jsonlFile.exists()) {
                logger.warn("CLI session file not found: ${jsonlFile.absolutePath}")
                return null
            }

            val messages = mutableListOf<JsonElement>()
            var firstUserMessage: String? = null
            var firstTimestamp: String? = null
            var lastTimestamp: String? = null

            jsonlFile.forEachLine { line ->
                if (line.isBlank()) return@forEachLine

                try {
                    val entry = json.parseToJsonElement(line).jsonObject
                    val type = entry["type"]?.jsonPrimitive?.content
                    val timestamp = entry["timestamp"]?.jsonPrimitive?.content

                    // timestamp 추적
                    if (timestamp != null) {
                        if (firstTimestamp == null) firstTimestamp = timestamp
                        lastTimestamp = timestamp
                    }

                    // firstUserMessage 추출 (타이틀용)
                    if (type == "user" && firstUserMessage == null) {
                        val contentElement = entry["message"]?.jsonObject?.get("content")
                        val textForTitle = when (contentElement) {
                            is JsonArray -> contentElement.mapNotNull { block ->
                                val blockObj = block.jsonObject
                                if (blockObj["type"]?.jsonPrimitive?.contentOrNull == "text") {
                                    blockObj["text"]?.jsonPrimitive?.contentOrNull
                                } else null
                            }.joinToString("\n").takeIf { it.isNotEmpty() }
                            is JsonPrimitive -> contentElement.contentOrNull
                            else -> null
                        }
                        if (!textForTitle.isNullOrEmpty()) {
                            firstUserMessage = textForTitle
                        }
                    }

                    // Raw JSONL entry 그대로 전달
                    messages.add(entry)
                } catch (e: Exception) {
                    // Skip malformed lines
                }
            }

            if (messages.isEmpty()) {
                logger.warn("No messages found in CLI session: $id")
                return null
            }

            val session = SessionData(
                id = id,
                title = firstUserMessage?.take(50) ?: "No title",
                createdAt = firstTimestamp ?: "",
                lastTimestamp = lastTimestamp,
                messages = messages.map { it as JsonElement }
            )

            logger.info("Loaded CLI session: $id with ${messages.size} messages")
            session
        } catch (e: Exception) {
            logger.error("Failed to load CLI session: $id", e)
            null
        }
    }

    /**
     * Get all sessions - CLI sessions only
     */
    fun getAllSessions(): List<SessionData> {
        logger.info("getAllSessions() called, project: ${project.basePath}")
        val cliSessions = getCliSessions()
        logger.info("Loaded ${cliSessions.size} CLI sessions")
        return cliSessions.sortedByDescending { it.lastTimestamp ?: it.createdAt }
    }

    /**
     * Extract session title from JSONL file (Cursor-compatible logic)
     * Priority: summaries[lastUuid] > firstNonMetaUserPrompt > "No title"
     */
    private fun extractFirstUserPrompt(entry: CliSessionEntry): String {
        return try {
            val jsonlFile = if (entry.fullPath != null) {
                File(entry.fullPath)
            } else {
                File(cliSessionsDir, "${entry.sessionId}.jsonl")
            }

            if (!jsonlFile.exists()) {
                return entry.firstPrompt ?: "No title"
            }

            // Cursor logic: collect summaries by leafUuid, track lastUuid, find first non-meta user
            val summaries = mutableMapOf<String, String>()  // leafUuid -> summary
            var lastUuid: String? = null
            var firstUserPrompt: String? = null

            jsonlFile.useLines { lines ->
                for (line in lines) {
                    if (line.isBlank()) continue

                    try {
                        val jsonEntry = json.parseToJsonElement(line).jsonObject

                        // Track last message uuid
                        jsonEntry["uuid"]?.jsonPrimitive?.contentOrNull?.let { uuid ->
                            lastUuid = uuid
                        }

                        val type = jsonEntry["type"]?.jsonPrimitive?.contentOrNull

                        // Collect summaries by leafUuid
                        if (type == "summary") {
                            val leafUuid = jsonEntry["leafUuid"]?.jsonPrimitive?.contentOrNull
                            val summary = jsonEntry["summary"]?.jsonPrimitive?.contentOrNull
                            if (leafUuid != null && !summary.isNullOrBlank()) {
                                summaries[leafUuid] = summary
                            }
                        }

                        // Find first non-meta user message
                        if (type == "user" && firstUserPrompt == null) {
                            val isMeta = jsonEntry["isMeta"]?.jsonPrimitive?.contentOrNull?.toBoolean() ?: false
                            if (!isMeta) {
                                val messageObj = jsonEntry["message"]?.jsonObject
                                val contentElement = messageObj?.get("content")

                                if (contentElement is JsonArray) {
                                    // Find the LAST text block (Cursor uses findLast)
                                    val lastTextBlock = contentElement.lastOrNull { block ->
                                        block.jsonObject["type"]?.jsonPrimitive?.contentOrNull == "text"
                                    }
                                    val text = lastTextBlock?.jsonObject?.get("text")?.jsonPrimitive?.contentOrNull
                                    if (!text.isNullOrBlank()) {
                                        firstUserPrompt = text.replace("\n", " ").trim()
                                    }
                                } else if (contentElement is JsonPrimitive) {
                                    val text = contentElement.contentOrNull
                                    if (!text.isNullOrBlank()) {
                                        firstUserPrompt = text.replace("\n", " ").trim()
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        // Skip malformed lines
                    }
                }
            }

            // Title priority: summaries[lastUuid] > firstUserPrompt > fallback
            val summaryForLast = lastUuid?.let { summaries[it] }
            summaryForLast ?: firstUserPrompt ?: entry.firstPrompt ?: "No title"
        } catch (e: Exception) {
            logger.warn("Failed to extract first prompt from session: ${entry.sessionId}", e)
            entry.firstPrompt ?: "No title"
        }
    }

    /**
     * Extract last message timestamp from session jsonl file
     * Cursor uses this for sorting instead of sessions-index.json modified field
     */
    private fun extractLastMessageTimestamp(entry: CliSessionEntry): String? {
        return try {
            val jsonlFile = if (entry.fullPath != null) {
                File(entry.fullPath)
            } else {
                File(cliSessionsDir, "${entry.sessionId}.jsonl")
            }

            if (!jsonlFile.exists()) {
                return null
            }

            var lastTimestamp: String? = null
            jsonlFile.useLines { lines ->
                for (line in lines) {
                    if (line.isBlank()) continue
                    try {
                        val jsonEntry = json.parseToJsonElement(line).jsonObject
                        val timestamp = jsonEntry["timestamp"]?.jsonPrimitive?.contentOrNull
                        if (timestamp != null) {
                            lastTimestamp = timestamp
                        }
                    } catch (e: Exception) {
                        // Skip malformed lines
                    }
                }
            }
            lastTimestamp
        } catch (e: Exception) {
            logger.warn("Failed to extract last timestamp from session: ${entry.sessionId}", e)
            null
        }
    }

    /**
     * Get sessions from Claude CLI storage
     * Scans directory for .jsonl files (Cursor-compatible approach)
     */
    private fun getCliSessions(): List<SessionData> {
        return try {
            logger.info("CLI sessions dir: ${cliSessionsDir.absolutePath}")

            if (!cliSessionsDir.exists() || !cliSessionsDir.isDirectory) {
                logger.warn("CLI sessions dir not found: ${cliSessionsDir.absolutePath}")
                return emptyList()
            }

            // Scan all .jsonl files in directory (Cursor approach)
            val jsonlFiles = cliSessionsDir.listFiles { file ->
                file.isFile && file.extension == "jsonl"
            } ?: emptyArray()

            logger.info("Found ${jsonlFiles.size} JSONL files")

            val sessions = jsonlFiles.mapNotNull { file ->
                try {
                    val sessionId = file.nameWithoutExtension
                    val sessionInfo = extractSessionInfo(file)

                    SessionData(
                        id = sessionId,
                        title = sessionInfo.title,
                        createdAt = sessionInfo.createdAt,
                        lastTimestamp = sessionInfo.lastTimestamp,
                        messages = emptyList(),
                        messageCount = sessionInfo.messageCount,
                        isSidechain = sessionInfo.isSidechain
                    )
                } catch (e: Exception) {
                    logger.warn("Failed to parse session file: ${file.name}", e)
                    null
                }
            }

            logger.info("Returning ${sessions.size} CLI sessions")
            sessions
        } catch (e: Exception) {
            logger.error("Failed to load CLI sessions", e)
            emptyList()
        }
    }

    /**
     * Extract session info from JSONL file (Cursor-compatible)
     */
    private data class SessionInfo(
        val title: String,
        val lastTimestamp: String?,
        val createdAt: String,
        val messageCount: Int,
        val isSidechain: Boolean
    )

    /**
     * Message info for building transcripts
     */
    private data class MessageInfo(
        val uuid: String,
        val parentUuid: String?,
        val type: String,
        val isSidechain: Boolean,
        val timestamp: String?,
        val isMeta: Boolean,
        val content: JsonElement?
    )

    private fun extractSessionInfo(file: File): SessionInfo {
        val messages = mutableMapOf<String, MessageInfo>()  // uuid -> MessageInfo
        val summaries = mutableMapOf<String, String>()  // leafUuid -> summary
        var lastUuid: String? = null
        var firstTimestamp: String? = null
        var messageCount = 0
        var firstUserPrompt: String? = null
        var hasSlug = false  // Track if session has slug field
        var hasFileHistorySnapshot = false  // Track if session has file-history-snapshot
        var skipSession = false  // Early skip if first relevant message is sidechain

        // Step 1: Collect all messages into Map
        file.useLines { lines ->
            for (line in lines) {
                if (line.isBlank()) continue
                try {
                    val entry = json.parseToJsonElement(line).jsonObject
                    messageCount++

                    val uuid = entry["uuid"]?.jsonPrimitive?.contentOrNull
                    val parentUuid = entry["parentUuid"]?.jsonPrimitive?.contentOrNull
                    val type = entry["type"]?.jsonPrimitive?.contentOrNull
                    val timestamp = entry["timestamp"]?.jsonPrimitive?.contentOrNull
                    val isSidechain = entry["isSidechain"]?.jsonPrimitive?.contentOrNull?.toBoolean() ?: false
                    val isMeta = entry["isMeta"]?.jsonPrimitive?.contentOrNull?.toBoolean() ?: false

                    if (timestamp != null && firstTimestamp == null) {
                        firstTimestamp = timestamp
                    }

                    // Cursor performRefresh: check first relevant message for isSidechain
                    if (messages.isEmpty() && type in listOf("user", "assistant", "attachment", "system")) {
                        if (isSidechain) {
                            skipSession = true
                            return@useLines  // Break early
                        }
                    }

                    // Collect summaries
                    if (type == "summary") {
                        val leafUuid = entry["leafUuid"]?.jsonPrimitive?.contentOrNull
                        val summary = entry["summary"]?.jsonPrimitive?.contentOrNull
                        if (leafUuid != null && !summary.isNullOrBlank()) {
                            summaries[leafUuid] = summary
                        }
                    }

                    // Check for slug field
                    if (!hasSlug && entry["slug"]?.jsonPrimitive?.contentOrNull != null) {
                        hasSlug = true
                    }

                    // Check for file-history-snapshot type
                    if (!hasFileHistorySnapshot && type == "file-history-snapshot") {
                        hasFileHistorySnapshot = true
                    }

                    // Add to messages Map (only relevant types)
                    if (uuid != null && type != null && type in listOf("user", "assistant", "attachment", "system", "progress")) {
                        val messageObj = entry["message"]?.jsonObject
                        val content = messageObj?.get("content")

                        messages[uuid] = MessageInfo(
                            uuid = uuid,
                            parentUuid = parentUuid,
                            type = type,
                            isSidechain = isSidechain,
                            timestamp = timestamp,
                            isMeta = isMeta,
                            content = content
                        )

                        lastUuid = uuid
                    }
                } catch (e: Exception) {
                    // Skip malformed lines
                }
            }
        }

        if (skipSession) {
            return SessionInfo(
                title = "Sidechain Session",
                lastTimestamp = null,
                createdAt = firstTimestamp ?: "",
                messageCount = messageCount,
                isSidechain = true
            )
        }

        // Filter out sessions without BOTH slug AND file-history-snapshot (Cursor compatibility)
        // Sessions with either slug OR file-history-snapshot should be shown
        if (!hasSlug && !hasFileHistorySnapshot) {
            return SessionInfo(
                title = "Incomplete Session",
                lastTimestamp = null,
                createdAt = firstTimestamp ?: "",
                messageCount = messageCount,
                isSidechain = true  // Treat as sidechain to filter it out
            )
        }

        // Filter out sessions without any user or assistant messages (empty sessions)
        val hasUserOrAssistant = messages.values.any { it.type == "user" || it.type == "assistant" }
        if (!hasUserOrAssistant) {
            return SessionInfo(
                title = "Empty Session",
                lastTimestamp = null,
                createdAt = firstTimestamp ?: "",
                messageCount = messageCount,
                isSidechain = true  // Treat as sidechain to filter it out
            )
        }

        // Step 2: Find leaf messages (messages that are not parents of other messages)
        val allParentUuids = messages.values.mapNotNull { it.parentUuid }.toSet()
        val leafMessages = messages.values.filter { it.uuid !in allParentUuids }

        // Step 3: Build transcripts from each leaf
        val transcripts = leafMessages.map { buildTranscript(it, messages) }

        // Step 4: Extract isSidechain from first message of first transcript (Cursor fetchSessions logic)
        val isSidechainFromTranscript = transcripts.firstOrNull()?.firstOrNull()?.isSidechain ?: false

        // Step 5: Extract first user prompt from first transcript
        for (transcript in transcripts) {
            for (msg in transcript) {
                if (msg.type == "user" && !msg.isMeta && firstUserPrompt == null) {
                    val text = extractTextFromContent(msg.content)
                    if (!text.isNullOrBlank()) {
                        // Remove system tags from the prompt for cleaner title
                        firstUserPrompt = removeSystemTags(text.replace("\n", " ").trim())
                        break
                    }
                }
            }
            if (firstUserPrompt != null) break
        }

        // Step 6: Determine title (first summary > firstUserPrompt > fallback)
        // Use first summary if available (summaries are added in order, first one is the session title)
        val firstSummary = summaries.values.firstOrNull()
        val title = firstSummary ?: firstUserPrompt ?: "No title"

        // Step 7: Find last timestamp from all messages
        val lastTimestamp = messages.values.mapNotNull { it.timestamp }.maxOrNull()

        return SessionInfo(
            title = title,
            lastTimestamp = lastTimestamp,
            createdAt = firstTimestamp ?: "",
            messageCount = messageCount,
            isSidechain = isSidechainFromTranscript
        )
    }

    /**
     * Build transcript chain from leaf to root (Cursor getTranscript logic)
     */
    private fun buildTranscript(leaf: MessageInfo, messages: Map<String, MessageInfo>): List<MessageInfo> {
        val transcript = mutableListOf<MessageInfo>()
        var current: MessageInfo? = leaf

        while (current != null) {
            transcript.add(0, current)  // Add to front (unshift)
            current = current.parentUuid?.let { messages[it] }
        }

        return transcript
    }

    /**
     * Extract text from message content (handles both array and primitive)
     */
    private fun extractTextFromContent(content: JsonElement?): String? {
        return when (content) {
            is JsonArray -> {
                val lastTextBlock = content.lastOrNull { block ->
                    block.jsonObject["type"]?.jsonPrimitive?.contentOrNull == "text"
                }
                lastTextBlock?.jsonObject?.get("text")?.jsonPrimitive?.contentOrNull
            }
            is JsonPrimitive -> content.contentOrNull
            else -> null
        }
    }

    /**
     * Remove system tags from text for cleaner session titles
     * Removes: <command-name>, <command-message>, <command-args>, <local-command-caveat>,
     *          <local-command-stdout>, <ide_selection>, <system-reminder>, etc.
     */
    private fun removeSystemTags(text: String): String {
        // Remove XML-style tags and their content
        val tagPattern = Regex("<[^>]+>[^<]*</[^>]+>")
        var cleaned = tagPattern.replace(text, "")

        // Remove self-closing or unclosed tags
        val singleTagPattern = Regex("<[^>]+>")
        cleaned = singleTagPattern.replace(cleaned, "")

        // Clean up extra whitespace
        cleaned = cleaned.replace(Regex("\\s+"), " ").trim()

        // If everything was removed, return original text
        return if (cleaned.isBlank()) text else cleaned
    }

    // saveSession removed - CLI sessions are read-only

    /**
     * Delete session file - CLI sessions
     */
    fun deleteSession(id: String): Result<Unit> {
        return try {
            val file = File(cliSessionsDir, "$id.jsonl")
            if (file.exists()) {
                file.delete()
                logger.info("Deleted CLI session: $id")
                Result.success(Unit)
            } else {
                logger.warn("CLI session file not found for deletion: $id")
                Result.failure(IllegalArgumentException("Session not found: $id"))
            }
        } catch (e: Exception) {
            logger.error("Failed to delete CLI session: $id", e)
            Result.failure(e)
        }
    }

    /**
     * Check if CLI session exists
     */
    fun sessionExists(id: String): Boolean {
        val file = File(cliSessionsDir, "$id.jsonl")
        return file.exists()
    }
}
