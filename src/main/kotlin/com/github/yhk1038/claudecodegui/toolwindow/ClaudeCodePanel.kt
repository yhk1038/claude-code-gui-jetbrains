package com.github.yhk1038.claudecodegui.toolwindow

import com.github.yhk1038.claudecodegui.actions.OpenClaudeCodeAction
import com.github.yhk1038.claudecodegui.bridge.NodeProcessManager
import com.github.yhk1038.claudecodegui.notifications.JcefRuntimeNotifier
import com.github.yhk1038.claudecodegui.services.ClaudeCodeBrowserService
import com.github.yhk1038.claudecodegui.services.DiffService
import com.github.yhk1038.claudecodegui.services.NodeBackendService
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.ui.jcef.JBCefBrowser
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
 * - Manages the JCEF browser component (via [ClaudeCodeBrowserService] pooling)
 * - Starts [NodeProcessManager] to spawn the Node.js backend
 * - Loads `http://localhost:{port}` once the backend is ready
 * - Implements [NodeProcessManager.RpcHandler] for IDE-native operations
 *   (open file, diff viewer, new tab, settings) requested by the Node.js backend
 * - Handles cursor CSS -> Java cursor mapping
 * - Handles title changes, console logging, keyboard shortcuts, DevTools
 *
 * Browser instances are pooled by [ClaudeCodeBrowserService] so that tab
 * move/split operations preserve all WebView state (input, scroll, dialogs).
 */
class ClaudeCodePanel(
    private val project: Project,
    private val sessionId: String = "default",
    private val initialPath: String? = null
) : JPanel(BorderLayout()), Disposable {

    private val logger = Logger.getInstance(ClaudeCodePanel::class.java)

    // Browser is owned by ClaudeCodeBrowserService, NOT by this panel.
    // This allows the browser to survive dispose-recreate cycles during tab move/split.
    // Returns null when JCEF is not supported (e.g. Android Studio without JCEF JBR).
    private val browserService = ClaudeCodeBrowserService.getInstance(project)
    private val holder = browserService.getOrCreate(sessionId)
    private val browser: JBCefBrowser? = holder?.browser
    private val cursorQuery: JBCefJSQuery? = holder?.cursorQuery
    private val streamingQuery: JBCefJSQuery? = holder?.streamingQuery

    // Title/path change callbacks delegated to BrowserHolder
    // so handlers installed on first panel creation can reach the latest panel's callbacks.
    // All callbacks are no-ops when holder is null (JCEF unavailable).
    var onTitleChanged: ((String) -> Unit)?
        get() = holder?.onTitleChanged
        set(value) { holder?.onTitleChanged = value }

    var onPathChanged: ((String) -> Unit)?
        get() = holder?.onPathChanged
        set(value) { holder?.onPathChanged = value }

    var onStreamingStateChanged: ((Boolean) -> Unit)?
        get() = holder?.onStreamingStateChanged
        set(value) { holder?.onStreamingStateChanged = value }

    private val panelId = UUID.randomUUID().toString()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val backendService = NodeBackendService.getInstance()
    private val diffService: DiffService = DiffService.getInstance(project)

    // Loading label
    private val loadingLabel = javax.swing.JLabel("Starting backend...").apply {
        horizontalAlignment = javax.swing.SwingConstants.CENTER
        font = font.deriveFont(14f)
    }

    // Error panel
    private var errorPanel: JPanel? = null

    init {
        if (holder == null) {
            // JCEF is not available in this runtime (e.g. Android Studio without JCEF JBR).
            // Show a fallback guidance panel and skip all browser/backend initialization.
            add(JcefUnavailablePanel(), BorderLayout.CENTER)
            logger.warn("JCEF is not supported in this runtime — showing fallback panel")
            JcefRuntimeNotifier.notify(project)
        } else {
            initWithJcef()
        }
    }

    private fun initWithJcef() {
        if (holder!!.isLoaded) {
            // Browser already loaded — reattach component (tab move/split restoration)
            val parent = browser!!.component.parent
            if (parent != null && parent !== this) {
                parent.remove(browser.component)
            }
            add(browser.component, BorderLayout.CENTER)
            logger.info("Reattached existing JCEF browser for session: $sessionId")
        } else {
            // First load — show loading screen
            add(loadingLabel, BorderLayout.CENTER)
        }

        // Install JCEF handlers only once per browser instance
        if (!holder.handlersInstalled) {
            setupBrowserHandlers()
            holder.handlersInstalled = true
        }

        // Register RPC handler for this panel
        backendService.ensureStarted(project.basePath ?: "", panelId, createRpcHandler())

        // Load URL only if not already loaded
        if (!holder.isLoaded) {
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
    }

    // ─── Browser handlers (JCEF) ────────────────────────────────────

    // Called only from initWithJcef() — holder, browser, cursorQuery, streamingQuery are guaranteed non-null here.
    private fun setupBrowserHandlers() {
        val b = browser!!
        val cq = cursorQuery!!
        val sq = streamingQuery!!

        // Handle CSS cursor changes from WebView
        cq.addHandler { cursorName: String ->
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
                b.component.cursor = java.awt.Cursor.getPredefinedCursor(javaCursorType)
            }
            JBCefJSQuery.Response(null)
        }

        // Handle streaming state changes from WebView
        sq.addHandler { state: String ->
            holder!!.onStreamingStateChanged?.invoke(state == "streaming")
            JBCefJSQuery.Response(null)
        }

        // Inject scripts on page load
        b.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(browser: CefBrowser, frame: CefFrame, httpStatusCode: Int) {
                if (frame.isMain) {
                    // Mark JCEF environment so detectRuntime() in environment.ts can detect
                    // the JetBrains environment and select JetBrainsAdapter over BrowserAdapter.
                    frame.executeJavaScript("window.__JCEF__ = true;", frame.url, 0)
                    // Inject the current IDE LAF theme so SettingsContext can resolve
                    // SYSTEM mode against the IDE rather than the OS prefers-color-scheme.
                    val ideTheme = if (com.intellij.ui.JBColor.isBright()) "light" else "dark"
                    frame.executeJavaScript("window.__IDE_THEME__ = '$ideTheme';", frame.url, 0)
                    injectCursorTracking(frame)
                    injectStreamingStateBridge(frame)
                    installImeWorkaround()
                    logger.info("WebView loaded successfully")
                    javax.swing.SwingUtilities.invokeLater {
                        b.component.requestFocusInWindow()
                    }
                }
            }
        }, b.cefBrowser)

        // Install LAF (IDE theme) change listener — once per browser holder.
        // The listener lifetime is tied to the holder (not the panel) so it
        // survives tab move/split. Removed in ClaudeCodeBrowserService.release().
        installLafListener()

        // Title change detection, address change tracking, and console log capture
        b.jbCefClient.addDisplayHandler(object : CefDisplayHandlerAdapter() {
            override fun onAddressChange(browser: CefBrowser?, frame: CefFrame?, url: String?) {
                if (url != null && frame?.isMain == true) {
                    try {
                        val uri = java.net.URI(url)
                        holder!!.onPathChanged?.invoke(uri.path)
                    } catch (_: Exception) { /* ignore malformed URLs */ }
                }
            }

            override fun onTitleChange(browser: CefBrowser?, title: String?) {
                if (title != null && title.isNotBlank()) {
                    holder!!.onTitleChanged?.invoke(title)
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
        }, b.cefBrowser)

        // Keyboard handler: prevent IDE from intercepting WebView shortcuts
        b.jbCefClient.addKeyboardHandler(
            WebViewKeyboardHandler(onOpenDevTools = { openDevTools() }),
            b.cefBrowser
        )

        // Life span handler: intercept window.open() popups and route them correctly
        b.jbCefClient.addLifeSpanHandler(object : CefLifeSpanHandlerAdapter() {
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
        }, b.cefBrowser)
    }

    /**
     * Inject streaming state bridge so WebView can notify Kotlin of streaming changes
     * via JBCefJSQuery instead of encoding state into document.title.
     */
    // Called only from setupBrowserHandlers() which is only called from initWithJcef() — streamingQuery is non-null.
    private fun injectStreamingStateBridge(frame: CefFrame) {
        val js = """
            (function() {
                window.__notifyStreamingState = function(state) {
                    ${streamingQuery!!.inject("state")}
                };
            })();
        """.trimIndent()
        frame.executeJavaScript(js, frame.url, 0)
    }

    /**
     * Inject cursor CSS tracking script into the loaded page.
     */
    // Called only from setupBrowserHandlers() which is only called from initWithJcef() — cursorQuery is non-null.
    private fun injectCursorTracking(frame: CefFrame) {
        val js = """
            (function() {
                var lastCursor = '';
                document.addEventListener('mouseover', function(e) {
                    var cursor = window.getComputedStyle(e.target).cursor;
                    if (cursor !== lastCursor) {
                        lastCursor = cursor;
                        ${cursorQuery!!.inject("cursor")}
                    }
                }, true);
            })();
        """.trimIndent()
        frame.executeJavaScript(js, frame.url, 0)
    }

    /**
     * JCEF IME NPE workaround.
     * Wraps InputMethodListeners with try-catch to suppress NPE from
     * JBCefInputMethodAdapter when replacementRange is null (macOS + JCEF + CJK IME).
     */
    // Called only from setupBrowserHandlers() which is only called from initWithJcef() — holder and browser are non-null.
    private fun installImeWorkaround() {
        if (holder!!.imeWorkaroundInstalled) return

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
            traverseAndWrap(browser!!.component)
            holder.imeWorkaroundInstalled = true
            logger.info("JCEF IME NPE workaround installed")
        }
    }

    /**
     * Subscribe to IDE Look-and-Feel changes and propagate them to the WebView
     * by updating window.__IDE_THEME__ and dispatching the 'ide-theme-changed'
     * event. Idempotent per browser holder.
     *
     * Lifetime: the LafManager listener is owned by a child Disposable stored on
     * the [ClaudeCodeBrowserService.BrowserHolder]. The holder (and thus the
     * listener) survives tab move/split. Disposal happens in
     * [ClaudeCodeBrowserService.release].
     */
    // Called only from setupBrowserHandlers() which is only called from initWithJcef() — holder and browser are non-null.
    private fun installLafListener() {
        val h = holder!!
        if (h.lafListenerInstalled) return

        try {
            // Use the application message bus with a child Disposable so the
            // subscription lifetime matches the browser holder (tab move/split
            // safe). This avoids the deprecated LafManager.addLafManagerListener
            // overloads while still providing automatic unregistration via Disposer.
            val parent = Disposer.newDisposable("ClaudeCodePanel.lafListener.$sessionId")
            val connection = ApplicationManager.getApplication().messageBus.connect(parent)
            connection.subscribe(
                com.intellij.ide.ui.LafManagerListener.TOPIC,
                com.intellij.ide.ui.LafManagerListener {
                    val b = browser ?: return@LafManagerListener
                    ApplicationManager.getApplication().invokeLater {
                        val newTheme = if (com.intellij.ui.JBColor.isBright()) "light" else "dark"
                        val js = "window.__IDE_THEME__ = '$newTheme'; " +
                            "window.dispatchEvent(new Event('ide-theme-changed'));"
                        try {
                            val cef = b.cefBrowser
                            cef.executeJavaScript(js, cef.url, 0)
                        } catch (e: Exception) {
                            logger.warn("Failed to propagate LAF change to WebView", e)
                        }
                    }
                },
            )
            h.lafListenerDisposable = parent
            h.lafListenerInstalled = true
            logger.info("LafManager listener installed for session: $sessionId")
        } catch (e: Exception) {
            logger.warn("Failed to install LafManager listener", e)
        }
    }

    /**
     * Opens the JCEF DevTools for debugging.
     */
    // Called only from WebViewKeyboardHandler installed via initWithJcef() — browser is non-null.
    private fun openDevTools() {
        try {
            (browser!! as? com.intellij.ui.jcef.JBCefBrowserBase)?.openDevtools()
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
    // Called only from initWithJcef() — holder and browser are non-null.
    private fun loadWebView(port: Int) {
        System.err.println("[ClaudeCodePanel] loadWebView called for project: ${project.name}")
        System.err.println("[ClaudeCodePanel] project.basePath: ${project.basePath}")

        val workingDirParam = project.basePath?.let {
            "?workingDir=${java.net.URLEncoder.encode(it, "UTF-8")}"
        } ?: ""

        val pathSegment = initialPath ?: "/sessions/new"
        val url = "http://localhost:$port$pathSegment$workingDirParam"
        System.err.println("[ClaudeCodePanel] Loading URL: $url")
        logger.info("Loading WebView from Node.js backend: $url")

        javax.swing.SwingUtilities.invokeLater {
            remove(loadingLabel)
            browser!!.loadURL(url)
            add(browser.component, BorderLayout.CENTER)
            holder!!.isLoaded = true
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
            }

            override suspend fun createSession(workingDir: String) {
                logger.info("Session cleared (workingDir=$workingDir)")
            }

            override suspend fun openNewTab(workingDir: String) {
                ApplicationManager.getApplication().invokeLater {
                    val targetProject = findProjectByBasePath(workingDir) ?: project
                    OpenClaudeCodeAction.openSession(targetProject, UUID.randomUUID().toString())
                    logger.info("Opened new Claude Code session tab (workingDir=$workingDir)")
                }
            }

            override suspend fun openSettings(workingDir: String) {
                ApplicationManager.getApplication().invokeLater {
                    val targetProject = findProjectByBasePath(workingDir) ?: project
                    OpenClaudeCodeAction.openSession(targetProject, UUID.randomUUID().toString(), "/settings/general")
                    logger.info("Opened Claude Code settings in editor tab (workingDir=$workingDir)")
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
                            } catch (_: Exception) {}
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

    // ─── Project Helpers ─────────────────────────────────────────────

    private fun findProjectByBasePath(basePath: String): Project? {
        if (basePath.isBlank()) return null
        return ProjectManager.getInstance().openProjects
            .firstOrNull { it.basePath == basePath }
    }

    // ─── Terminal Helpers ────────────────────────────────────────────

    private fun createTerminalTab(project: Project, workingDir: String): Any? {
        // Try new API first (253+): TerminalToolWindowTabsManager
        try {
            val tabsManagerClass = Class.forName("org.jetbrains.plugins.terminal.TerminalToolWindowTabsManager")
            val getInstance = tabsManagerClass.getMethod("getInstance", Project::class.java)
            val tabsManager = getInstance.invoke(null, project)
            val createTabBuilder = tabsManagerClass.getMethod("createTabBuilder")
            val builder = createTabBuilder.invoke(tabsManager)

            try {
                val setDir = builder.javaClass.getMethod("workingDirectory", String::class.java)
                setDir.invoke(builder, workingDir)
            } catch (_: Exception) {}

            val build = builder.javaClass.getMethod("build")
            val tab = build.invoke(builder)
            val getTerminalView = tab.javaClass.getMethod("getTerminalView")
            val terminalView = getTerminalView.invoke(tab)
            logger.info("Created terminal tab via TerminalToolWindowTabsManager (253+ API)")
            return terminalView
        } catch (_: Exception) {}

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

    private fun sendCommandToTerminal(widget: Any, command: String) {
        try {
            val method = widget.javaClass.getMethod("sendCommandToExecute", String::class.java)
            method.invoke(widget, command)
            return
        } catch (_: Exception) {}

        try {
            val builderMethod = widget.javaClass.getMethod("createSendTextBuilder", String::class.java)
            val builder = builderMethod.invoke(widget, command)
            val shouldExecute = builder.javaClass.getMethod("shouldExecute")
            shouldExecute.invoke(builder)
            val send = builder.javaClass.getMethod("send")
            send.invoke(builder)
            return
        } catch (_: Exception) {}

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
        // Detach browser component from this panel WITHOUT disposing the browser.
        // The browser is owned by ClaudeCodeBrowserService and survives tab move/split.
        // It will be reattached when a new ClaudeCodePanel is created for the same session.
        // When holder is null (JCEF unavailable), browser was never added, so nothing to detach.
        browser?.let { remove(it.component) }

        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        if (holder != null) {
            backendService.releasePanel(project.basePath ?: "", panelId)
        }
        // NOTE: Do NOT call Disposer.dispose(cursorQuery) or Disposer.dispose(browser).
        // They are managed by ClaudeCodeBrowserService and released in fileClosed().
        logger.info("ClaudeCodePanel disposed (browser retained in pool)")
    }
}
