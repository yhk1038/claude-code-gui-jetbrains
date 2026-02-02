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
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
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
    val updatedAt: String,
    val messages: List<JsonElement>,
    val messageCount: Int = -1  // -1 means use messages.size
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

                    when (type) {
                        "user" -> {
                            val messageObj = entry["message"]?.jsonObject
                            val contentElement = messageObj?.get("content")

                            // 원본 content 구조를 그대로 보존
                            // WebView에서 DTO로 파싱하여 타입별 처리
                            if (contentElement != null) {
                                // firstUserMessage 추출 (타이틀용)
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

                                if (firstUserMessage == null && !textForTitle.isNullOrEmpty()) {
                                    firstUserMessage = textForTitle
                                    firstTimestamp = timestamp
                                }
                                lastTimestamp = timestamp

                                // 원본 구조 그대로 전달
                                messages.add(buildJsonObject {
                                    put("type", "user")
                                    put("content", contentElement)
                                    put("timestamp", timestamp ?: "")
                                })
                            }
                        }
                        "assistant" -> {
                            val messageObj = entry["message"]?.jsonObject
                            val contentElement = messageObj?.get("content")
                            val messageId = entry["message_id"]?.jsonPrimitive?.contentOrNull

                            // 원본 content 배열을 그대로 보존 (tool_use 포함)
                            if (contentElement != null) {
                                lastTimestamp = timestamp

                                messages.add(buildJsonObject {
                                    put("type", "assistant")
                                    if (messageId != null) {
                                        put("message_id", messageId)
                                    }
                                    put("content", contentElement)
                                    put("timestamp", timestamp ?: "")
                                })
                            }
                        }
                        "result" -> {
                            // result 메시지도 보존
                            messages.add(entry)
                        }
                    }
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
                updatedAt = lastTimestamp ?: "",
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
        return cliSessions.sortedByDescending { it.updatedAt }
    }

    /**
     * Get sessions from Claude CLI storage
     * Reads from ~/.claude/projects/{normalized-path}/sessions-index.json
     */
    private fun getCliSessions(): List<SessionData> {
        return try {
            logger.info("CLI sessions dir: ${cliSessionsDir.absolutePath}")
            val indexFile = File(cliSessionsDir, "sessions-index.json")
            logger.info("Looking for CLI sessions index: ${indexFile.absolutePath}, exists: ${indexFile.exists()}")

            if (!indexFile.exists()) {
                logger.warn("CLI sessions index not found: ${indexFile.absolutePath}")
                return emptyList()
            }

            val content = indexFile.readText()
            val index = json.decodeFromString<CliSessionIndex>(content)
            logger.info("Loaded CLI session index with ${index.entries.size} entries")

            val sessions = index.entries
                .filter { !it.isSidechain }
                .map { entry ->
                    SessionData(
                        id = entry.sessionId,
                        title = entry.firstPrompt ?: "No title",
                        createdAt = entry.created,
                        updatedAt = entry.modified,
                        messages = emptyList(),  // CLI messages are in .jsonl, not loaded here
                        messageCount = entry.messageCount
                    )
                }
            logger.info("Returning ${sessions.size} CLI sessions")
            sessions
        } catch (e: Exception) {
            logger.error("Failed to load CLI sessions", e)
            emptyList()
        }
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
