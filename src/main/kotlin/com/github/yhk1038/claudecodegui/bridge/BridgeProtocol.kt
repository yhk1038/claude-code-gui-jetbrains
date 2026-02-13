package com.github.yhk1038.claudecodegui.bridge

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * Message protocol types for Claude Code CLI stream-json format
 */

// Base message wrapper
@Serializable
data class StreamMessage(
    val type: String,
    val data: JsonElement? = null
)

// System message (session initialization)
@Serializable
data class SystemMessage(
    val type: String? = null,
    val subtype: String? = null,
    val session_id: String? = null,
    val cwd: String? = null,
    val tools: List<String>? = null,
    val model: String? = null,
    val timestamp: String? = null,
    val content: String? = null
)

// Assistant message with content blocks
@Serializable
data class AssistantMessage(
    val type: String? = null,
    val message: ApiMessage? = null,
    val session_id: String? = null,
    val message_id: String? = null,
    val content: List<JsonElement>? = null
)

// API message nested inside AssistantMessage
@Serializable
data class ApiMessage(
    val id: String? = null,
    val role: String? = null,
    val content: List<JsonElement>? = null,
    val model: String? = null,
    val stop_reason: String? = null
)

// Content block types (parsed from JsonElement)
@Serializable
data class TextBlock(
    val type: String = "text",
    val text: String
)

@Serializable
data class ToolUseBlock(
    val type: String = "tool_use",
    val id: String,
    val name: String,
    val input: JsonObject
)

// Stream event for content deltas
@Serializable
data class StreamEvent(
    val type: String? = null,
    val event: JsonElement? = null,
    val session_id: String? = null,
    val index: Int? = null,
    val delta: JsonElement? = null
)

// Delta types
@Serializable
data class TextDelta(
    val type: String = "text_delta",
    val text: String
)

@Serializable
data class ToolUseDelta(
    val type: String = "tool_use_delta",
    val id: String? = null,
    val name: String? = null,
    val input: JsonObject? = null
)

// Tool result (user -> assistant)
@Serializable
data class ToolResult(
    val tool_use_id: String,
    val content: String,
    val is_error: Boolean = false
)

// Result message (final)
@Serializable
data class ResultMessage(
    val type: String? = null,
    val subtype: String? = null,
    val is_error: Boolean? = null,
    val result: String? = null,
    val session_id: String? = null,
    val duration_ms: Long? = null,
    val total_cost_usd: Double? = null,
    val status: String? = null,
    val message_id: String? = null,
    val usage: JsonElement? = null,
    val error: ErrorDetail? = null
)

@Serializable
data class Usage(
    val input_tokens: Int,
    val output_tokens: Int
)

@Serializable
data class ErrorDetail(
    val code: String? = null,
    val message: String? = null,
    val details: JsonObject? = null
)

// Permission types
enum class PermissionType {
    FILE_WRITE,
    FILE_DELETE,
    BASH_EXECUTE
}

enum class RiskLevel {
    LOW,
    MEDIUM,
    HIGH
}

/**
 * Detect if a tool use requires permission
 */
fun requiresPermission(toolName: String): PermissionType? {
    return when (toolName) {
        "Write", "Edit" -> PermissionType.FILE_WRITE
        "Delete" -> PermissionType.FILE_DELETE
        "Bash" -> PermissionType.BASH_EXECUTE
        else -> null
    }
}

/**
 * Get risk level for a tool
 */
fun getRiskLevel(toolName: String): RiskLevel {
    return when (toolName) {
        "Bash", "Delete" -> RiskLevel.HIGH
        "Write", "Edit" -> RiskLevel.MEDIUM
        else -> RiskLevel.LOW
    }
}

// File change information extracted from tool use
data class FileChange(
    val filePath: String,
    val operation: FileOperation,
    val content: String? = null,
    val oldString: String? = null,
    val newString: String? = null,
    val toolUseId: String
)

enum class FileOperation {
    CREATE,
    MODIFY,
    DELETE
}

/**
 * Extract file changes from Write/Edit tool use
 */
fun extractFileChange(toolUseId: String, toolName: String, input: JsonObject): FileChange? {
    return when (toolName) {
        "Write" -> {
            val filePath = input["file_path"]?.toString()?.removeSurrounding("\"")
            val content = input["content"]?.toString()?.removeSurrounding("\"")
            if (filePath != null && content != null) {
                FileChange(
                    filePath = filePath,
                    operation = FileOperation.MODIFY,
                    content = content,
                    toolUseId = toolUseId
                )
            } else null
        }
        "Edit" -> {
            val filePath = input["file_path"]?.toString()?.removeSurrounding("\"")
            val oldString = input["old_string"]?.toString()?.removeSurrounding("\"")
            val newString = input["new_string"]?.toString()?.removeSurrounding("\"")
            if (filePath != null && oldString != null && newString != null) {
                FileChange(
                    filePath = filePath,
                    operation = FileOperation.MODIFY,
                    oldString = oldString,
                    newString = newString,
                    toolUseId = toolUseId
                )
            } else null
        }
        "Delete" -> {
            val filePath = input["file_path"]?.toString()?.removeSurrounding("\"")
            if (filePath != null) {
                FileChange(
                    filePath = filePath,
                    operation = FileOperation.DELETE,
                    toolUseId = toolUseId
                )
            } else null
        }
        else -> null
    }
}
