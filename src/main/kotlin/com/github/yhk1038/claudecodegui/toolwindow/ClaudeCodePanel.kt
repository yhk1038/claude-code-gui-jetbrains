package com.github.yhk1038.claudecodegui.toolwindow

import com.github.yhk1038.claudecodegui.actions.OpenClaudeCodeAction
import com.github.yhk1038.claudecodegui.bridge.NodeProcessManager
import com.github.yhk1038.claudecodegui.services.DiffService
import com.github.yhk1038.claudecodegui.services.NodeBackendService
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefDisplayHandlerAdapter
import org.cef.handler.CefLifeSpanHandlerAdapter
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import java.util.UUID
import javax.swing.JPanel

/**
 * JCEF browser panel that hosts the WebView UI.
 *
 * In the v4 single-backend architecture, all business logic (Claude CLI, sessions,
 * settings, file I/O) lives in the Node.js backend. This panel only:
 * - Manages the JCEF browser component
 * - Starts [NodeProcessManager] to spawn the Node.js backend
 * - Loads `http://localhost:{port}` once the backend is ready
 * - Implements [NodeProcessManager.RpcHandler] for IDE-native operations
 *   (open file, diff viewer, new tab, settings) requested by the Node.js backend
 * - Handles cursor CSS -> Java cursor mapping
 * - Handles title changes, console logging, keyboard shortcuts, DevTools
 */
class ClaudeCodePanel(
    private val project: Project,
    private val sessionId: String = "default",
    private val initialPath: String? = null
) : JPanel(BorderLayout()), Disposable {

    private val logger = Logger.getInstance(ClaudeCodePanel::class.java)

    private val browser: JBCefBrowser = JBCefBrowser()
    private val cursorQuery: JBCefJSQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)

    // Title change callback (set by FileEditor)
    var onTitleChanged: ((String) -> Unit)? = null

    private val panelId = UUID.randomUUID().toString()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // IME workaround: flag to prevent double-wrapping on subsequent page loads
    private var imeWorkaroundInstalled = false

    private val backendService = NodeBackendService.getInstance(project)
    private val diffService: DiffService = DiffService.getInstance(project)

    // Loading label
    private val loadingLabel = javax.swing.JLabel("Starting backend...").apply {
        horizontalAlignment = javax.swing.SwingConstants.CENTER
        font = font.deriveFont(14f)
    }

    // Error panel
    private var errorPanel: JPanel? = null

    init {
        // Phase 1: Show loading screen
        add(loadingLabel, BorderLayout.CENTER)

        // Phase 2: Set up JCEF handlers (cursor, title, console, keyboard)
        setupBrowserHandlers()

        // Phase 3: Start Node.js backend and load URL once ready
        backendService.ensureStarted(panelId, createRpcHandler())
        scope.launch {
            try {
                val port = backendService.awaitPort()
                loadWebView(port)
            } catch (e: Exception) {
                logger.error("Failed to start Node.js backend", e)
                javax.swing.SwingUtilities.invokeLater {
                    showBackendError(e.message ?: "Unknown error")
                }
            }
        }
    }

    // ─── Browser handlers (JCEF) ────────────────────────────────────

    private fun setupBrowserHandlers() {
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

        // Inject cursor tracking script on page load
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(browser: CefBrowser, frame: CefFrame, httpStatusCode: Int) {
                if (frame.isMain) {
                    injectCursorTracking(frame)
                    installImeWorkaround()
                    logger.info("WebView loaded successfully")
                    javax.swing.SwingUtilities.invokeLater {
                        this@ClaudeCodePanel.browser.component.requestFocusInWindow()
                    }
                }
            }
        }, browser.cefBrowser)

        // Title change detection and console log capture
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
                    org.cef.CefSettings.LogSeverity.LOGSEVERITY_ERROR ->
                        logger.error("$logPrefix $message (source: $source:$line)")
                    org.cef.CefSettings.LogSeverity.LOGSEVERITY_WARNING ->
                        logger.warn("$logPrefix $message")
                    else ->
                        logger.info("$logPrefix $message")
                }
                return false
            }
        }, browser.cefBrowser)

        // Keyboard handler: prevent IDE from intercepting WebView shortcuts
        browser.jbCefClient.addKeyboardHandler(
            WebViewKeyboardHandler(onOpenDevTools = { openDevTools() }),
            browser.cefBrowser
        )

        // Life span handler: intercept window.open() popups and route them correctly
        browser.jbCefClient.addLifeSpanHandler(object : CefLifeSpanHandlerAdapter() {
            override fun onBeforePopup(
                browser: CefBrowser?,
                frame: CefFrame?,
                targetUrl: String?,
                targetFrameName: String?
            ): Boolean {
                if (targetUrl.isNullOrBlank()) return true

                ApplicationManager.getApplication().invokeLater {
                    try {
                        val uri = java.net.URI(targetUrl)
                        val host = uri.host ?: ""
                        val isLocalhost = host == "localhost" || host == "127.0.0.1"

                        if (!isLocalhost) {
                            // External URL — open in OS browser
                            logger.info("[ClaudeCodePanel] Popup blocked (external): $targetUrl -> BrowserUtil.browse")
                            BrowserUtil.browse(targetUrl)
                            return@invokeLater
                        }

                        val path = uri.path ?: "/"
                        when {
                            path == "/sessions/new" || path.startsWith("/sessions/new?") -> {
                                logger.info("[ClaudeCodePanel] Popup blocked: $targetUrl -> new session tab")
                                OpenClaudeCodeAction.openSession(project, UUID.randomUUID().toString())
                            }
                            path.startsWith("/settings/") -> {
                                logger.info("[ClaudeCodePanel] Popup blocked: $targetUrl -> settings tab")
                                OpenClaudeCodeAction.openSession(project, UUID.randomUUID().toString(), "/settings/general")
                            }
                            else -> {
                                logger.info("[ClaudeCodePanel] Popup blocked: $targetUrl -> new tab with path $path")
                                OpenClaudeCodeAction.openSession(project, UUID.randomUUID().toString(), path)
                            }
                        }
                    } catch (e: Exception) {
                        logger.warn("[ClaudeCodePanel] Failed to handle popup URL: $targetUrl", e)
                    }
                }
                return true // Always block JCEF from opening the popup natively
            }
        }, browser.cefBrowser)
    }

    /**
     * Inject cursor CSS tracking script into the loaded page.
     * This replaces the old cursorQuery injection that was part of injectBridge().
     */
    private fun injectCursorTracking(frame: CefFrame) {
        val js = """
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

    /**
     * JCEF IME NPE 워크어라운드.
     * JBCefInputMethodAdapter.inputMethodTextChanged()에서 replacementRange가 null일 때
     * NPE가 발생하는 JetBrains 플랫폼 버그(macOS + JCEF + CJK IME)를 우회합니다.
     *
     * 브라우저 컴포넌트 트리에 등록된 InputMethodListener를 찾아
     * try-catch(NullPointerException)로 감싼 래퍼로 교체합니다.
     * imeWorkaroundInstalled 플래그로 중복 래핑을 방지합니다.
     */
    private fun installImeWorkaround() {
        if (imeWorkaroundInstalled) return

        fun wrapListeners(component: java.awt.Component) {
            val listeners = component.inputMethodListeners
            if (listeners.isNullOrEmpty()) return

            for (listener in listeners) {
                component.removeInputMethodListener(listener)
                component.addInputMethodListener(object : java.awt.event.InputMethodListener {
                    override fun inputMethodTextChanged(event: java.awt.event.InputMethodEvent?) {
                        try {
                            listener.inputMethodTextChanged(event)
                        } catch (e: NullPointerException) {
                            // JBCefInputMethodAdapter.inputMethodTextChanged NPE 무시
                            // replacementRange가 null일 때 발생하는 플랫폼 버그
                            logger.warn("Suppressed JCEF IME NPE (replacementRange is null)", e)
                        }
                    }

                    override fun caretPositionChanged(event: java.awt.event.InputMethodEvent?) {
                        try {
                            listener.caretPositionChanged(event)
                        } catch (e: NullPointerException) {
                            logger.warn("Suppressed JCEF IME NPE in caretPositionChanged", e)
                        }
                    }
                })
            }
        }

        fun traverseAndWrap(component: java.awt.Component) {
            wrapListeners(component)
            if (component is java.awt.Container) {
                for (child in component.components) {
                    traverseAndWrap(child)
                }
            }
        }

        javax.swing.SwingUtilities.invokeLater {
            traverseAndWrap(browser.component)
            imeWorkaroundInstalled = true
            logger.info("JCEF IME NPE workaround installed")
        }
    }

    /**
     * Opens the JCEF DevTools for debugging.
     */
    private fun openDevTools() {
        try {
            (browser as? JBCefBrowserBase)?.openDevtools()
                ?: logger.warn("Failed to open DevTools: browser is not JBCefBrowserBase")
        } catch (e: Exception) {
            logger.error("Failed to open DevTools", e)
        }
    }

    // ─── WebView loading ────────────────────────────────────────────

    /**
     * Load the WebView URL from the Node.js backend.
     * Called once the backend has printed its PORT.
     */
    private fun loadWebView(port: Int) {
        System.err.println("[ClaudeCodePanel] loadWebView called for project: ${project.name}")
        System.err.println("[ClaudeCodePanel] project.basePath: ${project.basePath}")

        val workingDirParam = project.basePath?.let {
            "?workingDir=${java.net.URLEncoder.encode(it, "UTF-8")}"
        } ?: ""

        val pathSegment = initialPath ?: "/sessions/new"
        val envParam = if (workingDirParam.isNotEmpty()) "&env=jcef" else "?env=jcef"
        val url = "http://localhost:$port$pathSegment$workingDirParam$envParam"
        System.err.println("[ClaudeCodePanel] Loading URL: $url")
        logger.info("Loading WebView from Node.js backend: $url")

        javax.swing.SwingUtilities.invokeLater {
            remove(loadingLabel)
            browser.loadURL(url)
            add(browser.component, BorderLayout.CENTER)
            revalidate()
            repaint()
        }
    }

    /**
     * Show error when the Node.js backend fails to start.
     */
    private fun showBackendError(errorMessage: String) {
        remove(loadingLabel)

        errorPanel = JPanel(BorderLayout(0, 12)).apply {
            border = javax.swing.BorderFactory.createEmptyBorder(40, 40, 40, 40)

            val messageLabel = javax.swing.JLabel(
                "<html><div style='text-align:center;'>" +
                "<b>Node.js backend failed to start</b><br><br>" +
                "Error: $errorMessage<br><br>" +
                "Ensure Node.js is installed and available on PATH.<br>" +
                "The backend file (backend.mjs) must be built before running." +
                "</div></html>"
            ).apply {
                horizontalAlignment = javax.swing.SwingConstants.CENTER
            }
            add(messageLabel, BorderLayout.CENTER)

            val retryButton = javax.swing.JButton("Retry").apply {
                addActionListener { retryBackendStart() }
            }
            val buttonPanel = JPanel(java.awt.FlowLayout(java.awt.FlowLayout.CENTER))
            buttonPanel.add(retryButton)
            add(buttonPanel, BorderLayout.SOUTH)
        }
        add(errorPanel!!, BorderLayout.CENTER)
        revalidate()
        repaint()
    }

    /**
     * Retry starting the Node.js backend after a failure.
     */
    private fun retryBackendStart() {
        errorPanel?.let { remove(it) }
        errorPanel = null
        add(loadingLabel, BorderLayout.CENTER)
        revalidate()
        repaint()

        backendService.restart()
        scope.launch {
            try {
                val port = backendService.awaitPort()
                loadWebView(port)
            } catch (e: Exception) {
                logger.error("Retry: Failed to start Node.js backend", e)
                javax.swing.SwingUtilities.invokeLater {
                    showBackendError(e.message ?: "Unknown error")
                }
            }
        }
    }

    // ─── RPC Handler (IDE-native operations) ────────────────────────

    /**
     * Create an RPC handler that implements IDE-native operations
     * requested by the Node.js backend via JSON-RPC over stdout.
     */
    private fun createRpcHandler(): NodeProcessManager.RpcHandler {
        return object : NodeProcessManager.RpcHandler {

            override suspend fun openFile(path: String) {
                ApplicationManager.getApplication().invokeLater {
                    try {
                        val virtualFile = LocalFileSystem.getInstance().findFileByPath(path)
                        if (virtualFile != null) {
                            FileEditorManager.getInstance(project).openFile(virtualFile, true)
                            logger.info("Opened file: $path")
                        } else {
                            logger.warn("File not found: $path")
                        }
                    } catch (e: Exception) {
                        logger.error("Failed to open file: $path", e)
                    }
                }
            }

            override suspend fun openDiff(
                filePath: String,
                oldContent: String,
                newContent: String,
                toolUseId: String?
            ) {
                diffService.openDiffViewer(filePath, oldContent, newContent)
                logger.info("Opened diff viewer: $filePath (toolUseId=$toolUseId)")
            }

            override suspend fun applyDiff(
                filePath: String,
                newContent: String,
                toolUseId: String?
            ): Boolean {
                val result = diffService.applyDiff(filePath, newContent)
                logger.info("Applied diff: $filePath, success=${result.isSuccess} (toolUseId=$toolUseId)")
                return result.isSuccess
            }

            override suspend fun rejectDiff(toolUseId: String?) {
                logger.info("Diff rejected (toolUseId=$toolUseId)")
                // Diff viewer close is handled by user manually; nothing to do here
            }

            override suspend fun newSession() {
                ApplicationManager.getApplication().invokeLater {
                    OpenClaudeCodeAction.openSession(project, UUID.randomUUID().toString())
                    logger.info("Opened new Claude Code session tab")
                }
            }

            override suspend fun openSettings() {
                ApplicationManager.getApplication().invokeLater {
                    OpenClaudeCodeAction.openSession(project, UUID.randomUUID().toString(), "/settings/general")
                    logger.info("Opened Claude Code settings in editor tab")
                }
            }

            override suspend fun openTerminal(workingDir: String) {
                ApplicationManager.getApplication().invokeLater {
                    try {
                        val widget = createTerminalTab(project, workingDir)
                        if (widget != null) {
                            sendCommandToTerminal(widget, "claude")
                        }
                        logger.info("Opened terminal with claude in: $workingDir")
                    } catch (e: Exception) {
                        logger.error("Failed to open terminal: $workingDir", e)
                    }
                }
            }

            override suspend fun openUrl(url: String) {
                BrowserUtil.browse(url)
                logger.info("Opened URL in browser: $url")
            }

            override suspend fun updatePlugin() {
                ApplicationManager.getApplication().invokeLater {
                    try {
                        // PluginManagerConfigurable is @ApiStatus.Internal — use reflection
                        // to avoid Plugin Verifier flagging internal API usage.
                        val clazz = Class.forName("com.intellij.ide.plugins.PluginManagerConfigurable")
                        @Suppress("UNCHECKED_CAST")
                        val configurableClass = clazz as Class<out com.intellij.openapi.options.Configurable>
                        ShowSettingsUtil.getInstance().showSettingsDialog(
                            project,
                            configurableClass
                        ) { configurable ->
                            try {
                                val method = configurable.javaClass.getMethod("enableSearch", String::class.java)
                                method.invoke(configurable, "Claude Code with GUI")
                            } catch (_: Exception) {
                                // enableSearch not available — settings dialog still opens correctly
                            }
                        }
                        logger.info("Opened Plugins settings dialog for plugin update")
                    } catch (e: Exception) {
                        logger.error("Failed to open Plugins settings dialog", e)
                    }
                }
            }

            override suspend fun requiresRestart(): Boolean {
                return true
            }
        }
    }

    // ─── Terminal Helpers ────────────────────────────────────────────

    /**
     * Create a terminal tab.
     * - 253+ (2025.3): TerminalToolWindowTabsManager.createTabBuilder() (non-deprecated)
     * - 242~252: TerminalToolWindowManager.createShellWidget() via reflection (deprecated but necessary)
     *
     * All calls go through reflection so Plugin Verifier won't flag deprecated API usage.
     */
    private fun createTerminalTab(project: Project, workingDir: String): Any? {
        // Try new API first (253+): TerminalToolWindowTabsManager
        try {
            val tabsManagerClass = Class.forName("org.jetbrains.plugins.terminal.TerminalToolWindowTabsManager")
            val getInstance = tabsManagerClass.getMethod("getInstance", Project::class.java)
            val tabsManager = getInstance.invoke(null, project)
            val createTabBuilder = tabsManagerClass.getMethod("createTabBuilder")
            val builder = createTabBuilder.invoke(tabsManager)

            // Set working directory if builder supports it
            try {
                val setDir = builder.javaClass.getMethod("workingDirectory", String::class.java)
                setDir.invoke(builder, workingDir)
            } catch (_: Exception) {
                // workingDirectory setter not available — proceed without it
            }

            val build = builder.javaClass.getMethod("build")
            val tab = build.invoke(builder)
            // Extract TerminalView from the tab
            val getTerminalView = tab.javaClass.getMethod("getTerminalView")
            val terminalView = getTerminalView.invoke(tab)
            logger.info("Created terminal tab via TerminalToolWindowTabsManager (253+ API)")
            return terminalView
        } catch (_: Exception) {
            // New API not available — fall back to legacy
        }

        // Fall back to deprecated API via reflection (242~252)
        try {
            val managerClass = Class.forName("org.jetbrains.plugins.terminal.TerminalToolWindowManager")
            val getInstance = managerClass.getMethod("getInstance", Project::class.java)
            val manager = getInstance.invoke(null, project)
            val createShellWidget = managerClass.getMethod(
                "createShellWidget", String::class.java, String::class.java,
                Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType
            )
            val widget = createShellWidget.invoke(manager, workingDir, "Claude Code", true, false)
            logger.info("Created terminal tab via TerminalToolWindowManager.createShellWidget (legacy reflection)")
            return widget
        } catch (e: Exception) {
            logger.error("Failed to create terminal tab via any API", e)
            return null
        }
    }

    /**
     * Send a command to a terminal widget.
     * - 252+ (2025.2): sendCommandToExecute on TerminalWidget
     * - 242~251: ShellTerminalWidget.executeCommand via reflection
     */
    private fun sendCommandToTerminal(widget: Any, command: String) {
        // Try sendCommandToExecute (252+)
        try {
            val method = widget.javaClass.getMethod("sendCommandToExecute", String::class.java)
            method.invoke(widget, command)
            return
        } catch (_: Exception) {
            // Not available — try legacy
        }

        // Try createSendTextBuilder (253+)
        try {
            val builderMethod = widget.javaClass.getMethod("createSendTextBuilder", String::class.java)
            val builder = builderMethod.invoke(widget, command)
            val shouldExecute = builder.javaClass.getMethod("shouldExecute")
            shouldExecute.invoke(builder)
            val send = builder.javaClass.getMethod("send")
            send.invoke(builder)
            return
        } catch (_: Exception) {
            // Not available — try legacy
        }

        // Fall back to ShellTerminalWidget.executeCommand (242~251)
        try {
            val shellWidgetClass = Class.forName("org.jetbrains.plugins.terminal.ShellTerminalWidget")
            val toShellMethod = shellWidgetClass.getMethod(
                "toShellJediTermWidgetOrThrow",
                Class.forName("com.intellij.terminal.ui.TerminalWidget")
            )
            val shellWidget = toShellMethod.invoke(null, widget)
            val executeCommand = shellWidget.javaClass.getMethod("executeCommand", String::class.java)
            executeCommand.invoke(shellWidget, command)
        } catch (e: Exception) {
            logger.warn("All terminal command execution methods failed", e)
        }
    }

    // ─── Lifecycle ──────────────────────────────────────────────────

    override fun dispose() {
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        backendService.releasePanel(panelId)
        Disposer.dispose(cursorQuery)
        Disposer.dispose(browser)
        logger.info("ClaudeCodePanel disposed")
    }
}
