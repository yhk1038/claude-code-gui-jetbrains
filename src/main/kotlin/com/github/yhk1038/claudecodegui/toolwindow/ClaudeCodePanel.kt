package com.github.yhk1038.claudecodegui.toolwindow

import com.github.yhk1038.claudecodegui.actions.OpenClaudeCodeAction
import com.github.yhk1038.claudecodegui.bridge.NodeProcessManager
import com.github.yhk1038.claudecodegui.services.DiffService
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
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
    private val initialHash: String? = null
) : JPanel(BorderLayout()), Disposable {

    private val logger = Logger.getInstance(ClaudeCodePanel::class.java)

    private val browser: JBCefBrowser = JBCefBrowser()
    private val cursorQuery: JBCefJSQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)

    // Title change callback (set by FileEditor)
    var onTitleChanged: ((String) -> Unit)? = null

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val nodeProcessManager = NodeProcessManager(project, scope)
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
        nodeProcessManager.start(createRpcHandler())
        scope.launch {
            try {
                val port = nodeProcessManager.port.await()
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
                    injectInitialHash(frame)
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
     * Set the initial hash if specified (e.g., for settings page navigation).
     */
    private fun injectInitialHash(frame: CefFrame) {
        if (initialHash != null) {
            val escapedHash = initialHash.replace("\\", "\\\\").replace("'", "\\'")
            frame.executeJavaScript("window.location.hash = '$escapedHash';", frame.url, 0)
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
        val workingDirParam = project.basePath?.let {
            "?workingDir=${java.net.URLEncoder.encode(it, "UTF-8")}"
        } ?: ""

        val envParam = if (workingDirParam.isNotEmpty()) "&env=jcef" else "?env=jcef"
        val url = "http://localhost:$port$workingDirParam$envParam"
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

        // Dispose old manager and create a new one
        nodeProcessManager.dispose()

        // We need a new NodeProcessManager since the old deferred is already completed
        val newManager = NodeProcessManager(project, scope)
        newManager.start(createRpcHandler())
        scope.launch {
            try {
                val port = newManager.port.await()
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
                    OpenClaudeCodeAction.openSession(project, UUID.randomUUID().toString(), "#/settings/general")
                    logger.info("Opened Claude Code settings in editor tab")
                }
            }
        }
    }

    // ─── Lifecycle ──────────────────────────────────────────────────

    override fun dispose() {
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        nodeProcessManager.dispose()
        Disposer.dispose(cursorQuery)
        Disposer.dispose(browser)
        logger.info("ClaudeCodePanel disposed")
    }
}
