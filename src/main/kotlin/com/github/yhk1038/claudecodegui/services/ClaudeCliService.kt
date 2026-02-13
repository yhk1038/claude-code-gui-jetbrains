package com.github.yhk1038.claudecodegui.services

import com.github.yhk1038.claudecodegui.bridge.*
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*
import java.io.File

/**
 * Project-scoped utility for Claude CLI detection and validation.
 * Process management is handled per-tab by WebViewBridge.
 */
@Service(Service.Level.PROJECT)
class ClaudeCliService(private val project: Project) {
    private val logger = Logger.getInstance(ClaudeCliService::class.java)

    sealed class ServiceError {
        data class CliNotFound(val searchPaths: List<String>) : ServiceError()
        data class InvalidVersion(val version: String, val minVersion: String) : ServiceError()
        data class ProcessFailed(val reason: String, val exitCode: Int?) : ServiceError()
        data class ParseError(val line: String, val error: String) : ServiceError()
    }

    /**
     * Detect Claude CLI path.
     * Tries PATH-based resolution first ("claude"), falls back to well-known locations.
     */
    fun detectCliPath(): String? {
        val home = System.getenv("HOME") ?: return null

        // 1. Environment variable override
        System.getenv("CLAUDE_CODE_PATH")?.let { envPath ->
            if (File(envPath).exists() && File(envPath).canExecute()) {
                logger.info("Found Claude CLI via CLAUDE_CODE_PATH: $envPath")
                return envPath
            }
        }

        // 2. PATH에서 바로 찾기
        try {
            val process = ProcessBuilder("which", "claude")
                .redirectErrorStream(true)
                .start()
            val output = process.inputStream.bufferedReader().readText().trim()
            val exitCode = process.waitFor()
            if (exitCode == 0 && output.isNotBlank() && File(output).exists()) {
                logger.info("Found Claude CLI in PATH: $output")
                return output
            }
        } catch (e: Exception) {
            logger.debug("PATH lookup failed: ${e.message}")
        }

        // 3. Well-known locations
        val standardPaths = listOf(
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude",
            "$home/.claude/bin/claude",
            "$home/.volta/bin/claude",
            "$home/.nvm/current/bin/claude",
            "$home/.fnm/aliases/default/bin/claude",
            "$home/.local/bin/claude",
            "$home/.npm/bin/claude",
        )

        standardPaths.firstOrNull { File(it).exists() && File(it).canExecute() }?.let { found ->
            logger.info("Found Claude CLI at: $found")
            return found
        }

        logger.warn("Claude CLI not found in PATH or standard locations")
        return null
    }

    /**
     * Validate CLI version
     */
    suspend fun validateVersion(cliPath: String): Boolean = withContext(Dispatchers.IO) {
        return@withContext try {
            val process = ProcessBuilder(cliPath, "--version")
                .redirectErrorStream(true)
                .start()

            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()

            val isValid = output.isNotBlank()

            if (!isValid) {
                logger.warn("Invalid version output: $output")
            }

            isValid
        } catch (e: Exception) {
            logger.error("Failed to validate CLI version", e)
            false
        }
    }
}
