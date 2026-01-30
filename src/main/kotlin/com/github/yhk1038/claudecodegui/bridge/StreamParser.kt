package com.github.yhk1038.claudecodegui.bridge

import com.intellij.openapi.diagnostic.Logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject

/**
 * Parses NDJSON (Newline Delimited JSON) stream from Claude CLI
 */
class StreamParser(
    private val scope: CoroutineScope
) {
    private val logger = Logger.getInstance(StreamParser::class.java)

    // JSON parser with lenient settings
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        prettyPrint = false
    }

    // Buffer for incomplete lines
    private val lineBuffer = StringBuilder()

    // Parsed message flow
    private val _messageFlow = MutableSharedFlow<ParsedMessage>(replay = 0, extraBufferCapacity = 100)
    val messageFlow: SharedFlow<ParsedMessage> = _messageFlow.asSharedFlow()

    // Parse error flow
    private val _errorFlow = MutableSharedFlow<ParseError>(replay = 0, extraBufferCapacity = 10)
    val errorFlow: SharedFlow<ParseError> = _errorFlow.asSharedFlow()

    sealed class ParsedMessage {
        data class System(val data: SystemMessage) : ParsedMessage()
        data class Assistant(val data: AssistantMessage) : ParsedMessage()
        data class StreamEvent(val data: com.github.yhk1038.claudecodegui.bridge.StreamEvent) : ParsedMessage()
        data class Result(val data: ResultMessage) : ParsedMessage()
        data class Unknown(val type: String, val raw: JsonElement) : ParsedMessage()
    }

    data class ParseError(
        val line: String,
        val error: String,
        val exception: Exception? = null
    )

    /**
     * Process raw text from stdout
     */
    suspend fun processText(text: String) {
        // Add text to buffer
        lineBuffer.append(text)

        // Process complete lines
        var newlineIndex = lineBuffer.indexOf('\n')
        while (newlineIndex >= 0) {
            val line = lineBuffer.substring(0, newlineIndex).trim()
            lineBuffer.delete(0, newlineIndex + 1)

            if (line.isNotEmpty()) {
                parseLine(line)
            }

            newlineIndex = lineBuffer.indexOf('\n')
        }
    }

    /**
     * Parse a single JSON line
     */
    private suspend fun parseLine(line: String) {
        try {
            logger.debug("Parsing line: ${line.take(200)}...")

            val jsonElement = json.parseToJsonElement(line)
            val jsonObject = jsonElement.jsonObject

            // Extract message type
            val type = jsonObject["type"]?.toString()?.removeSurrounding("\"")
            if (type == null) {
                logger.warn("Message without type field: $line")
                _messageFlow.emit(ParsedMessage.Unknown("unknown", jsonElement))
                return
            }

            // Parse based on type
            val parsedMessage = when (type) {
                "system" -> {
                    val data = json.decodeFromJsonElement(SystemMessage.serializer(), jsonElement)
                    ParsedMessage.System(data)
                }
                "assistant" -> {
                    val data = json.decodeFromJsonElement(AssistantMessage.serializer(), jsonElement)
                    ParsedMessage.Assistant(data)
                }
                "stream_event" -> {
                    val data = json.decodeFromJsonElement(
                        com.github.yhk1038.claudecodegui.bridge.StreamEvent.serializer(),
                        jsonElement
                    )
                    ParsedMessage.StreamEvent(data)
                }
                "result" -> {
                    val data = json.decodeFromJsonElement(ResultMessage.serializer(), jsonElement)
                    ParsedMessage.Result(data)
                }
                else -> {
                    logger.warn("Unknown message type: $type")
                    ParsedMessage.Unknown(type, jsonElement)
                }
            }

            _messageFlow.emit(parsedMessage)
            logger.debug("Successfully parsed message of type: $type")

        } catch (e: Exception) {
            logger.error("Failed to parse JSON line", e)
            _errorFlow.emit(ParseError(line, e.message ?: "Unknown parse error", e))
        }
    }

    /**
     * Flush any remaining buffer content
     */
    suspend fun flush() {
        val remaining = lineBuffer.toString().trim()
        if (remaining.isNotEmpty()) {
            parseLine(remaining)
            lineBuffer.clear()
        }
    }

    /**
     * Clear buffer
     */
    fun reset() {
        lineBuffer.clear()
    }

    /**
     * Subscribe to parsed messages with a handler
     */
    fun subscribe(handler: suspend (ParsedMessage) -> Unit): Job {
        return scope.launch(Dispatchers.Default) {
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
     * Subscribe to parse errors
     */
    fun subscribeToErrors(handler: suspend (ParseError) -> Unit): Job {
        return scope.launch(Dispatchers.Default) {
            errorFlow.collect { error ->
                try {
                    handler(error)
                } catch (e: Exception) {
                    logger.error("Error in error handler", e)
                }
            }
        }
    }
}

/**
 * Extension function to connect ProcessManager stdout to StreamParser
 */
fun ProcessManager.connectToParser(parser: StreamParser, scope: CoroutineScope): Job {
    return scope.launch(Dispatchers.IO) {
        stdoutFlow.collect { text ->
            parser.processText(text)
        }
    }
}
