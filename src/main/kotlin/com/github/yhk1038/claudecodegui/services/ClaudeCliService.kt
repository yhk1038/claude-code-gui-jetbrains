package com.github.yhk1038.claudecodegui.services

import com.github.yhk1038.claudecodegui.bridge.*
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.io.File

@Service(Service.Level.PROJECT)
class ClaudeCliService(private val project: Project) {
    private val logger = Logger.getInstance(ClaudeCliService::class.java)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var processManager: ProcessManager? = null
    private var streamParser: StreamParser? = null
    private var parserJob: Job? = null

    // Service state
    private val _isRunning = MutableStateFlow(false)
    val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()

    // Message flow for subscribers
    private val _messageFlow = MutableSharedFlow<StreamParser.ParsedMessage>(
        replay = 0,
        extraBufferCapacity = 100
    )
    val messageFlow: SharedFlow<StreamParser.ParsedMessage> = _messageFlow.asSharedFlow()

    // Error flow
    private val _errorFlow = MutableSharedFlow<ServiceError>(replay = 1, extraBufferCapacity = 10)
    val errorFlow: SharedFlow<ServiceError> = _errorFlow.asSharedFlow()

    sealed class ServiceError {
        data class CliNotFound(val searchPaths: List<String>) : ServiceError()
        data class InvalidVersion(val version: String, val minVersion: String) : ServiceError()
        data class ProcessFailed(val reason: String, val exitCode: Int?) : ServiceError()
        data class ParseError(val line: String, val error: String) : ServiceError()
    }

    /**
     * Detect Claude CLI path from standard locations
     */
    fun detectCliPath(): String? {
        val paths = listOf(
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude",
            System.getenv("HOME")?.let { "$it/.claude/bin/claude" },
            System.getenv("CLAUDE_CODE_PATH")
        ).filterNotNull()

        return paths.firstOrNull { File(it).exists() && File(it).canExecute() }
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

            // TODO: Parse version and compare with minimum required
            // For now, just check that output is not blank
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

    /**
     * Start the Claude CLI service
     */
    suspend fun start(cliPath: String? = null): Result<Unit> = withContext(Dispatchers.IO) {
        if (_isRunning.value) {
            logger.warn("Service already running")
            return@withContext Result.success(Unit)
        }

        try {
            // Detect CLI path if not provided
            val detectedPath = cliPath ?: detectCliPath()

            if (detectedPath == null) {
                val error = ServiceError.CliNotFound(
                    listOf(
                        "/usr/local/bin/claude",
                        "/opt/homebrew/bin/claude",
                        "~/.claude/bin/claude"
                    )
                )
                _errorFlow.emit(error)
                return@withContext Result.failure(Exception("Claude CLI not found"))
            }

            logger.info("Starting Claude CLI service with path: $detectedPath")

            // Validate version
            if (!validateVersion(detectedPath)) {
                val error = ServiceError.InvalidVersion("unknown", "1.0.0")
                _errorFlow.emit(error)
                return@withContext Result.failure(Exception("Invalid CLI version"))
            }

            // Create process manager
            val manager = ProcessManager(project, detectedPath, scope)
            processManager = manager

            // Create stream parser
            val parser = StreamParser(scope)
            streamParser = parser

            // Connect parser to process stdout
            parserJob = manager.connectToParser(parser, scope)

            // Subscribe to parsed messages and forward them
            parser.subscribe { message ->
                _messageFlow.emit(message)
            }

            // Subscribe to parse errors
            parser.subscribeToErrors { error ->
                _errorFlow.emit(ServiceError.ParseError(error.line, error.error))
            }

            // Subscribe to process state changes
            scope.launch {
                manager.stateFlow.collect { state ->
                    when (state) {
                        is ProcessManager.ProcessState.Running -> {
                            _isRunning.value = true
                            logger.info("Claude CLI process is running")
                        }
                        is ProcessManager.ProcessState.Stopped -> {
                            _isRunning.value = false
                            logger.info("Claude CLI process stopped")
                        }
                        is ProcessManager.ProcessState.Failed -> {
                            _isRunning.value = false
                            _errorFlow.emit(ServiceError.ProcessFailed(state.reason, state.exitCode))
                            logger.error("Claude CLI process failed: ${state.reason}")
                        }
                        else -> {}
                    }
                }
            }

            // Start the process
            manager.start()

            logger.info("Claude CLI service started successfully")
            Result.success(Unit)

        } catch (e: Exception) {
            logger.error("Failed to start Claude CLI service", e)
            _isRunning.value = false
            Result.failure(e)
        }
    }

    /**
     * Stop the service
     */
    suspend fun stop() = withContext(Dispatchers.IO) {
        if (!_isRunning.value) {
            logger.info("Service not running")
            return@withContext
        }

        try {
            logger.info("Stopping Claude CLI service...")

            parserJob?.cancel()
            parserJob = null

            processManager?.stop()
            processManager = null

            streamParser?.reset()
            streamParser = null

            _isRunning.value = false

            logger.info("Claude CLI service stopped")

        } catch (e: Exception) {
            logger.error("Error stopping service", e)
        }
    }

    /**
     * Restart the service
     */
    suspend fun restart() {
        logger.info("Restarting Claude CLI service...")
        val currentPath = processManager?.let {
            // Store current CLI path before stopping
            detectCliPath()
        }
        stop()
        delay(1000)
        start(currentPath)
    }

    /**
     * Send a message to Claude CLI
     */
    suspend fun sendMessage(message: String) {
        if (!_isRunning.value) {
            logger.warn("Cannot send message: service not running")
            throw IllegalStateException("Service not running")
        }

        try {
            processManager?.sendInput(message)
            logger.debug("Sent message: ${message.take(100)}...")
        } catch (e: Exception) {
            logger.error("Failed to send message", e)
            throw e
        }
    }

    /**
     * Check if service is running
     */
    fun isServiceRunning(): Boolean = _isRunning.value

    /**
     * Subscribe to messages
     */
    fun subscribeToMessages(handler: suspend (StreamParser.ParsedMessage) -> Unit): Job {
        return scope.launch {
            messageFlow.collect { message ->
                try {
                    handler(message)
                } catch (e: Exception) {
                    logger.error("Error in message handler", e)
                }
            }
        }
    }

    /**
     * Subscribe to errors
     */
    fun subscribeToErrors(handler: suspend (ServiceError) -> Unit): Job {
        return scope.launch {
            errorFlow.collect { error ->
                try {
                    handler(error)
                } catch (e: Exception) {
                    logger.error("Error in error handler", e)
                }
            }
        }
    }

    /**
     * Cleanup on service disposal
     */
    fun dispose() {
        scope.launch {
            stop()
        }
        scope.cancel()
    }
}
