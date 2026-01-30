package com.github.yhk1038.claudecodegui.toolwindow

import com.github.yhk1038.claudecodegui.bridge.WebViewBridge
import com.github.yhk1038.claudecodegui.services.ClaudeCliService
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.intellij.util.ui.UIUtil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefDisplayHandler
import org.cef.handler.CefDisplayHandlerAdapter
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JPanel

class ClaudeCodePanel(
    private val project: Project,
    private val sessionId: String = "default"
) : JPanel(BorderLayout()), Disposable {

    private val logger = Logger.getInstance(ClaudeCodePanel::class.java)

    private val browser: JBCefBrowser = JBCefBrowser()
    private val jsQuery: JBCefJSQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)

    // 제목 변경 콜백 (FileEditor에서 설정)
    var onTitleChanged: ((String) -> Unit)? = null

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val cliService: ClaudeCliService = project.service()

    private lateinit var webViewBridge: WebViewBridge

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    init {
        setupBridge()
        loadWebView()
        add(browser.component, BorderLayout.CENTER)
    }

    private fun setupBridge() {
        // Initialize WebViewBridge
        webViewBridge = WebViewBridge(cliService, this, scope, project)

        // Handle messages from WebView
        jsQuery.addHandler { request: String ->
            handleMessage(request)
            // Return null response - actual responses are sent via executeJavaScript
            JBCefJSQuery.Response(null)
        }

        // Set up load handler to inject bridge on page load
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(browser: CefBrowser, frame: CefFrame, httpStatusCode: Int) {
                if (frame.isMain) {
                    injectBridge(frame)
                    sendTheme()
                    logger.info("WebView loaded successfully")
                }
            }
        }, browser.cefBrowser)

        // Title 변경 감지 및 콘솔 로그 캡처
        browser.jbCefClient.addDisplayHandler(object : CefDisplayHandlerAdapter() {
            override fun onTitleChange(browser: CefBrowser?, title: String?) {
                if (title != null && title.isNotBlank()) {
                    onTitleChanged?.invoke(title)
                }
            }

            override fun onConsoleMessage(
                browser: CefBrowser?,
                level: org.cef.CefSettings.LogSeverity?,
                message: String?,
                source: String?,
                line: Int
            ): Boolean {
                val logPrefix = "[WebView]"
                when (level) {
                    org.cef.CefSettings.LogSeverity.LOGSEVERITY_ERROR -> logger.error("$logPrefix $message (source: $source:$line)")
                    org.cef.CefSettings.LogSeverity.LOGSEVERITY_WARNING -> logger.warn("$logPrefix $message")
                    else -> logger.info("$logPrefix $message")
                }
                return false // Allow default handling
            }
        }, browser.cefBrowser)
    }

    private fun injectBridge(frame: CefFrame) {
        val js = """
            window.kotlinBridge = {
                send: function(message) {
                    ${jsQuery.inject("JSON.stringify(message)")}
                }
            };
            window.dispatchKotlinMessage = function(message) {
                window.dispatchEvent(new CustomEvent('kotlinMessage', { detail: message }));
            };
            window.dispatchEvent(new Event('kotlinBridgeReady'));
        """.trimIndent()
        frame.executeJavaScript(js, frame.url, 0)
    }

    private fun loadWebView() {
        // Check if running in development mode (Vite dev server)
        val devMode = System.getProperty("claude.dev.mode", "false").toBoolean() ||
                      System.getenv("CLAUDE_DEV_MODE") == "true"

        if (devMode) {
            logger.info("Loading WebView from Vite dev server")
            browser.loadURL("http://localhost:5173")
            return
        }

        // Use IntelliJ's built-in server to serve resources (avoids CORS issues)
        val builtInServerPort = org.jetbrains.ide.BuiltInServerManager.getInstance().port
        val webviewDir = extractWebViewResources()
        if (webviewDir != null) {
            // Serve via built-in server using file path
            val url = "http://localhost:$builtInServerPort/file${webviewDir.absolutePath}/index.html"
            logger.info("Loading WebView via built-in server: $url")
            browser.loadURL(url)
        } else {
            // Fallback to Vite dev server
            logger.info("Failed to extract resources, falling back to Vite dev server")
            browser.loadURL("http://localhost:5173")
        }
    }

    private fun extractWebViewResources(): java.io.File? {
        return try {
            val tempDir = java.io.File(System.getProperty("java.io.tmpdir"), "claude-code-webview-${project.locationHash}")

            // Always re-extract to ensure latest version
            if (tempDir.exists()) {
                tempDir.deleteRecursively()
            }
            tempDir.mkdirs()

            // List of resources to extract
            val resources = listOf(
                "index.html",
                "favicon.svg",
                "assets/index.js",
                "assets/index.css",
                "assets/code-block-37QAKDTI.js"
            )

            for (resource in resources) {
                val inputStream = javaClass.getResourceAsStream("/webview/$resource")
                if (inputStream != null) {
                    val targetFile = java.io.File(tempDir, resource)
                    targetFile.parentFile?.mkdirs()
                    inputStream.use { input ->
                        targetFile.outputStream().use { output ->
                            input.copyTo(output)
                        }
                    }
                    logger.debug("Extracted: $resource")
                } else {
                    logger.warn("Resource not found: /webview/$resource")
                }
            }

            logger.info("Extracted WebView resources to: ${tempDir.absolutePath}")
            tempDir
        } catch (e: Exception) {
            logger.error("Failed to extract WebView resources", e)
            null
        }
    }

    private fun handleMessage(request: String) {
        logger.debug("Received message from WebView: ${request.take(200)}")

        scope.launch {
            try {
                // Parse incoming message
                val messageJson = json.parseToJsonElement(request).jsonObject
                val type = messageJson["type"]?.jsonPrimitive?.content ?: "UNKNOWN"
                val requestId = messageJson["requestId"]?.jsonPrimitive?.content ?: "unknown"
                val payload = messageJson["payload"]?.jsonObject ?: kotlinx.serialization.json.buildJsonObject {}

                logger.debug("Processing message: type=$type, requestId=$requestId")

                // Route message to WebViewBridge
                val response = webViewBridge.handleWebViewMessage(type, requestId, payload)

                // Send response back to WebView
                sendResponse(requestId, response)

            } catch (e: Exception) {
                logger.error("Error handling message from WebView", e)

                // Send error response
                try {
                    val messageJson = json.parseToJsonElement(request).jsonObject
                    val requestId = messageJson["requestId"]?.jsonPrimitive?.content ?: "unknown"

                    sendResponse(requestId, kotlinx.serialization.json.buildJsonObject {
                        put("status", "error")
                        put("error", e.message ?: "Unknown error")
                    })
                } catch (parseError: Exception) {
                    logger.error("Failed to send error response", parseError)
                }
            }
        }
    }

    /**
     * Send response back to WebView for a specific request
     */
    private fun sendResponse(requestId: String, response: kotlinx.serialization.json.JsonObject) {
        val responseJson = kotlinx.serialization.json.buildJsonObject {
            put("type", "ACK")
            put("requestId", requestId)
            put("payload", response)
            put("timestamp", System.currentTimeMillis())
        }

        val jsonString = json.encodeToString(
            kotlinx.serialization.json.JsonObject.serializer(),
            responseJson
        )

        browser.cefBrowser.executeJavaScript(
            "window.dispatchKotlinMessage($jsonString);",
            browser.cefBrowser.url,
            0
        )
    }

    fun sendToWebView(type: String, payload: Map<String, Any?>) {
        val json = """{"type":"$type","payload":${payload.toJsonString()},"timestamp":${System.currentTimeMillis()}}"""
        logger.info("sendToWebView: type=$type, json length=${json.length}")
        logger.debug("sendToWebView JSON: ${json.take(500)}")

        val script = """
            (function() {
                console.log('[Kotlin] Dispatching message: $type');
                if (typeof window.dispatchKotlinMessage === 'function') {
                    window.dispatchKotlinMessage($json);
                    console.log('[Kotlin] Message dispatched successfully');
                } else {
                    console.error('[Kotlin] dispatchKotlinMessage is not defined!');
                }
            })();
        """.trimIndent()

        browser.cefBrowser.executeJavaScript(script, browser.cefBrowser.url, 0)
    }

    private fun sendTheme() {
        val isDark = UIUtil.isUnderDarcula()
        sendToWebView("THEME_CHANGE", mapOf("mode" to if (isDark) "dark" else "light"))
    }

    private fun Map<String, Any?>.toJsonString(): String {
        return entries.joinToString(",", "{", "}") { (k, v) ->
            "\"$k\":${v.toJsonValue()}"
        }
    }

    private fun Any?.toJsonValue(): String = when (this) {
        null -> "null"
        is String -> "\"${this.escapeJson()}\""
        is Number, is Boolean -> toString()
        is JsonElement -> this.toString()  // JsonElement is already valid JSON
        is Map<*, *> -> (this as Map<String, Any?>).toJsonString()
        is List<*> -> this.joinToString(",", "[", "]") { it.toJsonValue() }
        else -> "\"${this.toString().escapeJson()}\""
    }

    private fun String.escapeJson(): String {
        return this.replace("\\", "\\\\")
                   .replace("\"", "\\\"")
                   .replace("\n", "\\n")
                   .replace("\r", "\\r")
                   .replace("\t", "\\t")
    }

    override fun dispose() {
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        webViewBridge.dispose()
        Disposer.dispose(jsQuery)
        Disposer.dispose(browser)
        logger.info("ClaudeCodePanel disposed")
    }
}
