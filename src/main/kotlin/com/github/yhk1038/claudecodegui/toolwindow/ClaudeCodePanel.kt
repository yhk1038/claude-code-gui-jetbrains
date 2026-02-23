package com.github.yhk1038.claudecodegui.toolwindow

import com.github.yhk1038.claudecodegui.bridge.WebViewBridge
import com.github.yhk1038.claudecodegui.services.ClaudeCliService
import com.github.yhk1038.claudecodegui.settings.SettingsManager
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.JBColor
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
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
import org.cef.callback.CefContextMenuParams
import org.cef.callback.CefMenuModel
import org.cef.handler.CefContextMenuHandler
import org.cef.handler.CefDisplayHandler
import org.cef.handler.CefDisplayHandlerAdapter
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JPanel

class ClaudeCodePanel(
    private val project: Project,
    private val sessionId: String = "default",
    private val initialHash: String? = null
) : JPanel(BorderLayout()), Disposable {

    private val logger = Logger.getInstance(ClaudeCodePanel::class.java)

    private val browser: JBCefBrowser = JBCefBrowser()
    private val jsQuery: JBCefJSQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)
    private val cursorQuery: JBCefJSQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)

    // 제목 변경 콜백 (FileEditor에서 설정)
    var onTitleChanged: ((String) -> Unit)? = null

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val cliService: ClaudeCliService = project.service()

    private lateinit var webViewBridge: WebViewBridge

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    // 로딩 화면용 레이블
    private val loadingLabel = javax.swing.JLabel("Loading settings...").apply {
        horizontalAlignment = javax.swing.SwingConstants.CENTER
        font = font.deriveFont(14f)
    }

    // 에러 화면용 패널
    private var errorPanel: JPanel? = null

    init {
        // Phase 1: 로딩 화면 표시
        add(loadingLabel, BorderLayout.CENTER)

        // Phase 2: 설정 로딩 (동기)
        // EDT 동기 실행 허용 - SettingsManager.ensureAndLoad() KDoc 참조
        val settingsManager = SettingsManager.getInstance()
        val loadSuccess = settingsManager.ensureAndLoad()

        // Phase 3: 결과에 따라 분기
        if (loadSuccess) {
            remove(loadingLabel)
            setupBridge()
            loadWebView()
            add(browser.component, BorderLayout.CENTER)
        } else {
            remove(loadingLabel)
            showSettingsError()
        }
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

        // Handle CSS cursor changes from WebView
        cursorQuery.addHandler { cursorName: String ->
            val javaCursorType = when (cursorName) {
                "text" -> java.awt.Cursor.TEXT_CURSOR
                "pointer" -> java.awt.Cursor.HAND_CURSOR
                "move" -> java.awt.Cursor.MOVE_CURSOR
                "crosshair" -> java.awt.Cursor.CROSSHAIR_CURSOR
                "wait" -> java.awt.Cursor.WAIT_CURSOR
                "grab", "grabbing" -> java.awt.Cursor.MOVE_CURSOR
                "col-resize", "e-resize", "w-resize", "ew-resize" -> java.awt.Cursor.E_RESIZE_CURSOR
                "row-resize", "n-resize", "s-resize", "ns-resize" -> java.awt.Cursor.N_RESIZE_CURSOR
                "nw-resize", "se-resize", "nwse-resize" -> java.awt.Cursor.NW_RESIZE_CURSOR
                "ne-resize", "sw-resize", "nesw-resize" -> java.awt.Cursor.NE_RESIZE_CURSOR
                "not-allowed", "no-drop" -> java.awt.Cursor.DEFAULT_CURSOR
                else -> java.awt.Cursor.DEFAULT_CURSOR
            }
            javax.swing.SwingUtilities.invokeLater {
                browser.component.cursor = java.awt.Cursor.getPredefinedCursor(javaCursorType)
            }
            JBCefJSQuery.Response(null)
        }

        // Set up load handler to inject bridge on page load
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(browser: CefBrowser, frame: CefFrame, httpStatusCode: Int) {
                if (frame.isMain) {
                    injectBridge(frame)
                    sendTheme()
                    logger.info("WebView loaded successfully")
                    javax.swing.SwingUtilities.invokeLater {
                        this@ClaudeCodePanel.browser.component.requestFocusInWindow()
                    }
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

        // Register keyboard handler to prevent IDE from intercepting WebView shortcuts
        // - macOS: Cmd+Arrow/Option+Arrow (텍스트 내비게이션), Cmd+, (설정)
        // - All platforms: Cmd/Ctrl+, (설정 - IntelliJ Settings 다이얼로그 방지)
        // - F12: DevTools 열기
        browser.jbCefClient.addKeyboardHandler(
            WebViewKeyboardHandler(onOpenDevTools = { openDevTools() }),
            browser.cefBrowser
        )

        // Register context menu handler to add "Open DevTools" option
        browser.jbCefClient.addContextMenuHandler(object : CefContextMenuHandler {
            private val DEVTOOLS_CMD_ID = 28500

            override fun onBeforeContextMenu(
                browser: CefBrowser?,
                frame: CefFrame?,
                params: CefContextMenuParams?,
                model: CefMenuModel?
            ) {
                model?.addSeparator()
                model?.addItem(DEVTOOLS_CMD_ID, "Open DevTools")
            }

            override fun onContextMenuCommand(
                browser: CefBrowser?,
                frame: CefFrame?,
                params: CefContextMenuParams?,
                commandId: Int,
                eventFlags: Int
            ): Boolean {
                if (commandId == DEVTOOLS_CMD_ID) {
                    openDevTools()
                    return true
                }
                return false
            }

            override fun onContextMenuDismissed(browser: CefBrowser?, frame: CefFrame?) {}

            override fun runContextMenu(
                browser: CefBrowser?,
                frame: CefFrame?,
                params: CefContextMenuParams?,
                model: CefMenuModel?,
                callback: org.cef.callback.CefRunContextMenuCallback?
            ): Boolean {
                // Return false to allow default context menu behavior
                return false
            }
        }, browser.cefBrowser)
    }

    /**
     * Opens the JCEF DevTools for debugging
     */
    private fun openDevTools() {
        try {
            (browser as? JBCefBrowserBase)?.openDevtools()
                ?: logger.warn("Failed to open DevTools: browser is not JBCefBrowserBase")
        } catch (e: Exception) {
            logger.error("Failed to open DevTools", e)
        }
    }

    private fun injectBridge(frame: CefFrame) {
        val hashJs = if (initialHash != null) {
            val escapedHash = initialHash.replace("\\", "\\\\").replace("'", "\\'")
            "window.location.hash = '$escapedHash';"
        } else ""
        val js = """
            $hashJs
            window.kotlinBridge = {
                send: function(message) {
                    ${jsQuery.inject("JSON.stringify(message)")}
                }
            };
            window.dispatchKotlinMessage = function(message) {
                window.dispatchEvent(new CustomEvent('kotlinMessage', { detail: message }));
            };
            window.dispatchEvent(new Event('kotlinBridgeReady'));
            (function() {
                var lastCursor = '';
                document.addEventListener('mouseover', function(e) {
                    var cursor = window.getComputedStyle(e.target).cursor;
                    if (cursor !== lastCursor) {
                        lastCursor = cursor;
                        ${cursorQuery.inject("cursor")}
                    }
                }, true);
            })();
        """.trimIndent()
        frame.executeJavaScript(js, frame.url, 0)
    }

    private fun loadWebView() {
        val devMode = System.getProperty("claude.dev.mode", "false").toBoolean() ||
                      System.getenv("CLAUDE_DEV_MODE") == "true"

        val workingDirParam = project.basePath?.let {
            "?workingDir=${java.net.URLEncoder.encode(it, "UTF-8")}"
        } ?: ""

        if (devMode && isViteDevServerRunning()) {
            logger.info("Loading WebView from Vite dev server")
            browser.loadURL("http://localhost:5173$workingDirParam")
            return
        }

        if (devMode) {
            logger.info("Dev mode enabled but Vite dev server not running, using bundled resources")
        }

        // Use IntelliJ's built-in server with custom request handler to serve resources
        val builtInServerPort = org.jetbrains.ide.BuiltInServerManager.getInstance().port
        val url = "http://localhost:$builtInServerPort${WebViewRequestHandler.PREFIX}/index.html$workingDirParam"
        logger.info("Loading WebView via custom HTTP handler: $url")
        browser.loadURL(url)
    }

    private fun showSettingsError() {
        val settingsPath = "${System.getProperty("user.home")}/.claude-code-gui/settings.js"
        logger.error("Failed to load settings from: $settingsPath")

        errorPanel = JPanel(BorderLayout(0, 12)).apply {
            border = javax.swing.BorderFactory.createEmptyBorder(40, 40, 40, 40)

            // 에러 메시지
            val messageLabel = javax.swing.JLabel(
                "<html><div style='text-align:center;'>" +
                "<b>설정 파일을 불러올 수 없습니다</b><br><br>" +
                "경로: $settingsPath<br><br>" +
                "파일이 올바른 JavaScript 형식인지 확인하세요.<br>" +
                "파일을 삭제하면 다음 실행 시 기본값으로 재생성됩니다." +
                "</div></html>"
            ).apply {
                horizontalAlignment = javax.swing.SwingConstants.CENTER
            }
            add(messageLabel, BorderLayout.CENTER)

            // 새로고침 버튼
            val refreshButton = javax.swing.JButton("새로고침").apply {
                addActionListener {
                    retryLoadSettings()
                }
            }
            val buttonPanel = JPanel(java.awt.FlowLayout(java.awt.FlowLayout.CENTER))
            buttonPanel.add(refreshButton)
            add(buttonPanel, BorderLayout.SOUTH)
        }
        add(errorPanel!!, BorderLayout.CENTER)
        revalidate()
        repaint()
    }

    private fun retryLoadSettings() {
        val settingsManager = SettingsManager.getInstance()
        val loadSuccess = settingsManager.ensureAndLoad()

        if (loadSuccess) {
            errorPanel?.let { remove(it) }
            errorPanel = null
            setupBridge()
            loadWebView()
            add(browser.component, BorderLayout.CENTER)
            revalidate()
            repaint()
            logger.info("Settings loaded successfully on retry")
        } else {
            logger.error("Settings load retry failed")
        }
    }

    private fun isViteDevServerRunning(): Boolean {
        return try {
            val socket = java.net.Socket()
            socket.connect(java.net.InetSocketAddress("localhost", 5173), 500)
            socket.close()
            true
        } catch (e: Exception) {
            false
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

            // Extract all resources from /webview/ directory
            // This approach works for both IDE runtime and packaged JAR
            val webviewUrl = javaClass.getResource("/webview/")
            if (webviewUrl != null && webviewUrl.protocol == "jar") {
                // Running from JAR - extract all entries starting with /webview/
                extractFromJar(tempDir)
            } else {
                // IDE runtime or file system - try to extract known resources
                val resources = listOf(
                    "index.html",
                    "favicon.svg",
                    "assets/codicon.ttf",
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
            }

            logger.info("Extracted WebView resources to: ${tempDir.absolutePath}")
            tempDir
        } catch (e: Exception) {
            logger.error("Failed to extract WebView resources", e)
            null
        }
    }

    private fun extractFromJar(targetDir: java.io.File) {
        val jarPath = javaClass.protectionDomain.codeSource.location.toURI().path
        val jarFile = java.util.jar.JarFile(jarPath)

        jarFile.use { jar ->
            val entries = jar.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                if (entry.name.startsWith("webview/") && !entry.isDirectory) {
                    val relativePath = entry.name.removePrefix("webview/")
                    val targetFile = java.io.File(targetDir, relativePath)
                    targetFile.parentFile?.mkdirs()

                    jar.getInputStream(entry).use { input ->
                        targetFile.outputStream().use { output ->
                            input.copyTo(output)
                        }
                    }
                    logger.debug("Extracted from JAR: ${entry.name}")
                }
            }
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
        val isDark = !JBColor.isBright()
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
        if (::webViewBridge.isInitialized) {
            webViewBridge.dispose()
        }
        Disposer.dispose(cursorQuery)
        Disposer.dispose(jsQuery)
        Disposer.dispose(browser)
        logger.info("ClaudeCodePanel disposed")
    }
}
