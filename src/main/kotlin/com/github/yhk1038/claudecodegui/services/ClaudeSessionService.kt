package com.github.yhk1038.claudecodegui.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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
 * Service for managing Claude Code sessions with persistent storage
 * Sessions are stored in {projectRoot}/.claude/sessions/{sessionId}.json
 */
@Service(Service.Level.PROJECT)
class ClaudeSessionService(private val project: Project) {
    private val logger = Logger.getInstance(ClaudeSessionService::class.java)

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        prettyPrint = true
    }

    private val sessionsDir: File
        get() {
            val projectBasePath = project.basePath ?: throw IllegalStateException("Project base path is null")
            val dir = File(projectBasePath, ".claude/sessions")
            if (!dir.exists()) {
                dir.mkdirs()
                logger.info("Created sessions directory: ${dir.absolutePath}")
            }
            return dir
        }

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
     * Get session by ID - checks both local and CLI storage
     */
    fun getSession(id: String): SessionData? {
        // Try local session first
        val localSession = getLocalSession(id)
        if (localSession != null) {
            return localSession
        }

        // Try CLI session
        return getCliSession(id)
    }

    private fun getLocalSession(id: String): SessionData? {
        return try {
            val file = File(sessionsDir, "$id.json")
            if (!file.exists()) {
                return null
            }
            val content = file.readText()
            val session = json.decodeFromString<SessionData>(content)
            logger.debug("Loaded local session: $id")
            session
        } catch (e: Exception) {
            logger.error("Failed to load local session: $id", e)
            null
        }
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
                            val content = messageObj?.get("content")?.jsonPrimitive?.content
                            if (content != null) {
                                if (firstUserMessage == null) {
                                    firstUserMessage = content
                                    firstTimestamp = timestamp
                                }
                                lastTimestamp = timestamp

                                messages.add(buildJsonObject {
                                    put("role", "user")
                                    put("content", content)
                                    put("timestamp", timestamp ?: "")
                                })
                            }
                        }
                        "assistant" -> {
                            val messageObj = entry["message"]?.jsonObject
                            val contentArray = messageObj?.get("content")?.jsonArray
                            val textContent = contentArray?.mapNotNull { block ->
                                val blockObj = block.jsonObject
                                if (blockObj["type"]?.jsonPrimitive?.content == "text") {
                                    blockObj["text"]?.jsonPrimitive?.content
                                } else null
                            }?.joinToString("\n") ?: ""

                            if (textContent.isNotEmpty()) {
                                lastTimestamp = timestamp

                                messages.add(buildJsonObject {
                                    put("role", "assistant")
                                    put("content", textContent)
                                    put("timestamp", timestamp ?: "")
                                })
                            }
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
     * Get all sessions from both local and CLI storage
     */
    fun getAllSessions(): List<SessionData> {
        logger.info("getAllSessions() called, project: ${project.basePath}")
        val localSessions = getLocalSessions()
        logger.info("Loaded ${localSessions.size} local sessions")
        val cliSessions = getCliSessions()
        logger.info("Loaded ${cliSessions.size} CLI sessions")

        // Merge and sort by updatedAt descending
        // CLI sessions take precedence for duplicate IDs
        val sessionMap = mutableMapOf<String, SessionData>()

        localSessions.forEach { sessionMap[it.id] = it }
        cliSessions.forEach { sessionMap[it.id] = it }

        val result = sessionMap.values.sortedByDescending { it.updatedAt }
        logger.info("Returning ${result.size} total sessions")
        return result
    }

    /**
     * Get sessions from local project storage
     */
    private fun getLocalSessions(): List<SessionData> {
        return try {
            val files = sessionsDir.listFiles { file -> file.extension == "json" } ?: emptyArray()

            files.mapNotNull { file ->
                try {
                    val content = file.readText()
                    json.decodeFromString<SessionData>(content)
                } catch (e: Exception) {
                    logger.error("Failed to load session from ${file.name}", e)
                    null
                }
            }
        } catch (e: Exception) {
            logger.error("Failed to load local sessions", e)
            emptyList()
        }
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

    /**
     * Save session to disk
     */
    fun saveSession(session: SessionData): Result<Unit> {
        return try {
            val file = File(sessionsDir, "${session.id}.json")
            val content = json.encodeToString(session)
            file.writeText(content)
            logger.info("Saved session: ${session.id} to ${file.absolutePath}")
            Result.success(Unit)
        } catch (e: Exception) {
            logger.error("Failed to save session: ${session.id}", e)
            Result.failure(e)
        }
    }

    /**
     * Delete session file
     */
    fun deleteSession(id: String): Result<Unit> {
        return try {
            val file = File(sessionsDir, "$id.json")
            if (file.exists()) {
                file.delete()
                logger.info("Deleted session: $id")
                Result.success(Unit)
            } else {
                logger.warn("Session file not found for deletion: $id")
                Result.failure(IllegalArgumentException("Session not found: $id"))
            }
        } catch (e: Exception) {
            logger.error("Failed to delete session: $id", e)
            Result.failure(e)
        }
    }

    /**
     * Check if session exists
     */
    fun sessionExists(id: String): Boolean {
        val file = File(sessionsDir, "$id.json")
        return file.exists()
    }
}
