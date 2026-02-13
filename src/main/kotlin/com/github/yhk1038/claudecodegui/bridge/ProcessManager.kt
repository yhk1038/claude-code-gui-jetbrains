package com.github.yhk1038.claudecodegui.bridge

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.OSProcessHandler
import com.intellij.execution.process.ProcessEvent
import com.intellij.execution.process.ProcessListener
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Manages the lifecycle of Claude Code CLI process
 */
class ProcessManager(
    private val project: Project,
    private val cliPath: String,
    private val scope: CoroutineScope
) {
    private val logger = Logger.getInstance(ProcessManager::class.java)

    private var processHandler: OSProcessHandler? = null
    private var isRunning = false

    // Output streams
    private val _stdoutFlow = MutableSharedFlow<String>(replay = 0, extraBufferCapacity = 100)
    val stdoutFlow: SharedFlow<String> = _stdoutFlow.asSharedFlow()

    private val _stderrFlow = MutableSharedFlow<String>(replay = 0, extraBufferCapacity = 100)
    val stderrFlow: SharedFlow<String> = _stderrFlow.asSharedFlow()

    // Process state
    private val _stateFlow = MutableSharedFlow<ProcessState>(replay = 1, extraBufferCapacity = 10)
    val stateFlow: SharedFlow<ProcessState> = _stateFlow.asSharedFlow()

    sealed class ProcessState {
        object Stopped : ProcessState()
        object Starting : ProcessState()
        object Running : ProcessState()
        data class Failed(val reason: String, val exitCode: Int? = null) : ProcessState()
    }

    /**
     * Start the Claude CLI process
     */
    suspend fun start() = withContext(Dispatchers.IO) {
        if (isRunning) {
            logger.warn("Process already running")
            return@withContext
        }

        try {
            _stateFlow.emit(ProcessState.Starting)
            logger.info("Starting Claude CLI process: $cliPath")

            val commandLine = GeneralCommandLine().apply {
                exePath = cliPath
                addParameter("-p")
                addParameter("--output-format")
                addParameter("stream-json")
                addParameter("--input-format")
                addParameter("stream-json")
                addParameter("--verbose")
                addParameter("--include-partial-messages")

                // Set working directory to project base path
                setWorkDirectory(project.basePath)

                // Set environment variables
                withEnvironment(System.getenv())

                // Ensure UTF-8 encoding
                withCharset(Charsets.UTF_8)
            }

            processHandler = OSProcessHandler(commandLine).apply {
                addProcessListener(object : ProcessListener {
                    override fun startNotified(event: ProcessEvent) {
                        logger.info("Claude CLI process started")
                        isRunning = true
                        scope.launch {
                            _stateFlow.emit(ProcessState.Running)
                        }
                    }

                    override fun processTerminated(event: ProcessEvent) {
                        val exitCode = event.exitCode
                        logger.info("Claude CLI process terminated with exit code: $exitCode")
                        isRunning = false

                        scope.launch {
                            if (exitCode == 0) {
                                _stateFlow.emit(ProcessState.Stopped)
                            } else {
                                _stateFlow.emit(ProcessState.Failed("Process exited with code $exitCode", exitCode))
                            }
                        }
                    }

                    override fun onTextAvailable(event: ProcessEvent, outputType: Key<*>) {
                        val text = event.text
                        if (text.isNotBlank()) {
                            scope.launch {
                                when (outputType) {
                                    com.intellij.execution.process.ProcessOutputTypes.STDOUT -> {
                                        _stdoutFlow.emit(text)
                                    }
                                    com.intellij.execution.process.ProcessOutputTypes.STDERR -> {
                                        _stderrFlow.emit(text)
                                        logger.warn("Claude CLI stderr: $text")
                                    }
                                }
                            }
                        }
                    }
                })

                startNotify()
            }

        } catch (e: Exception) {
            logger.error("Failed to start Claude CLI process", e)
            isRunning = false
            _stateFlow.emit(ProcessState.Failed(e.message ?: "Unknown error"))
            throw e
        }
    }

    /**
     * Send input to the process via stdin
     */
    fun sendInput(input: String) {
        if (!isRunning) {
            logger.warn("Cannot send input: process not running")
            return
        }

        try {
            processHandler?.process?.outputStream?.apply {
                write(input.toByteArray(Charsets.UTF_8))
                write('\n'.code)
                flush()
            }
            logger.debug("Sent input to Claude CLI: ${input.take(100)}...")
        } catch (e: IOException) {
            logger.error("Failed to send input to process", e)
        }
    }

    /**
     * Stop the process gracefully with timeout
     */
    suspend fun stop(timeoutSeconds: Long = 5) = withContext(Dispatchers.IO) {
        if (!isRunning) {
            logger.info("Process already stopped")
            return@withContext
        }

        logger.info("Stopping Claude CLI process...")

        try {
            processHandler?.let { handler ->
                // Try graceful termination first
                handler.destroyProcess()

                // Wait for termination with timeout
                val terminated = withTimeoutOrNull(TimeUnit.SECONDS.toMillis(timeoutSeconds)) {
                    while (handler.process.isAlive) {
                        delay(100)
                    }
                }

                if (terminated == null) {
                    logger.warn("Process did not terminate gracefully, forcing...")
                    handler.process.destroyForcibly()
                }
            }

            isRunning = false
            _stateFlow.emit(ProcessState.Stopped)
            logger.info("Claude CLI process stopped")

        } catch (e: Exception) {
            logger.error("Error stopping process", e)
            throw e
        }
    }

    /**
     * Restart the process
     */
    suspend fun restart() {
        logger.info("Restarting Claude CLI process...")
        stop()
        delay(1000) // Wait a bit before restart
        start()
    }

    /**
     * Check if process is running
     */
    fun isAlive(): Boolean = isRunning && processHandler?.process?.isAlive == true

    /**
     * Get current exit code (if terminated)
     */
    fun getExitCode(): Int? = processHandler?.exitCode

    /**
     * Cleanup resources
     */
    fun dispose() {
        scope.launch {
            if (isRunning) {
                stop()
            }
        }
    }
}
