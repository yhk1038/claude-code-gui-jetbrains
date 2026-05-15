package com.github.yhk1038.claudecodegui.services

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.browser.CefFrame
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Project-level service that pools JCEF browser instances by sessionId.
 *
 * When a tab is moved or split, JetBrains disposes the FileEditor and creates
 * a new one. Without pooling, the JCEF browser is destroyed and recreated,
 * losing all in-memory state (input text, scroll position, dialogs, etc.).
 *
 * This service keeps browsers alive across dispose-recreate cycles.
 * The browser is only truly disposed when [release] is called (on real tab close).
 */
@Service(Service.Level.PROJECT)
class ClaudeCodeBrowserService(private val project: Project) : Disposable {

    private val logger = Logger.getInstance(ClaudeCodeBrowserService::class.java)

    class BrowserHolder(
        val browser: JBCefBrowser,
        val cursorQuery: JBCefJSQuery,
        val streamingQuery: JBCefJSQuery,
    ) {
        /** Callback for WebView title changes (set by ClaudeCodePanel, consumed by handlers). */
        var onTitleChanged: ((String) -> Unit)? = null

        /** Callback for WebView URL path changes (set by ClaudeCodePanel, consumed by handlers). */
        var onPathChanged: ((String) -> Unit)? = null

        /** Callback for WebView streaming state changes (set by ClaudeCodePanel, consumed by tool window host). */
        var onStreamingStateChanged: ((isStreaming: Boolean) -> Unit)? = null

        /** Whether the WebView URL has been loaded at least once. */
        var isLoaded: Boolean = false

        /**
         * True after the main frame finishes loading the current document ([onLoadEnd]).
         * IDE-injected scripts must not run on about:blank before [loadURL]; they are queued and flushed here.
         */
        private val mainDocumentReady = AtomicBoolean(false)
        private val pendingIdeInjectionJs = ConcurrentLinkedQueue<String>()

        fun markMainDocumentNavigating() {
            mainDocumentReady.set(false)
        }

        /**
         * Must run on EDT. Executes immediately if the chat page is ready; otherwise queues for [flushPendingIdeInjectionScripts].
         */
        fun injectIdeJavaScriptWhenReady(js: String) {
            if (mainDocumentReady.get()) {
                browser.cefBrowser.executeJavaScript(js, browser.cefBrowser.url, 0)
            } else {
                pendingIdeInjectionJs.offer(js)
            }
        }

        /** Called from [CefLoadHandlerAdapter.onLoadEnd] for the main frame, after base IDE bridges are injected. */
        fun flushPendingIdeInjectionScripts(frame: CefFrame) {
            mainDocumentReady.set(true)
            while (true) {
                val pending = pendingIdeInjectionJs.poll() ?: break
                try {
                    frame.executeJavaScript(pending, frame.url, 0)
                } catch (e: Exception) {
                    Logger.getInstance(ClaudeCodeBrowserService::class.java)
                        .warn("Failed to run pending IDE WebView injection", e)
                }
            }
        }

        /** Whether JCEF handlers (display, load, keyboard, lifespan) have been installed. */
        var handlersInstalled: Boolean = false

        /** Whether native IDE/Swing drag-and-drop has been bridged into the WebView. */
        var nativeDropBridgeInstalled: Boolean = false

        /** Whether the IME NPE workaround has been applied. */
        var imeWorkaroundInstalled: Boolean = false
    }

    private val holders = ConcurrentHashMap<String, BrowserHolder>()

    /**
     * Get an existing browser for the session, or create a new one.
     * The browser is NOT registered with Disposer — it is managed by this service.
     */
    fun getOrCreate(sessionId: String): BrowserHolder {
        return holders.getOrPut(sessionId) {
            logger.info("Creating new JCEF browser for session: $sessionId")
            val browser = JBCefBrowser()
            val cursorQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)
            val streamingQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)
            BrowserHolder(browser, cursorQuery, streamingQuery)
        }
    }

    /**
     * Release and dispose the browser for the given session.
     * Called when a Claude Code tool window session tab is closed.
     */
    fun release(sessionId: String) {
        holders.remove(sessionId)?.let { holder ->
            logger.info("Releasing JCEF browser for session: $sessionId")
            try { Disposer.dispose(holder.streamingQuery) } catch (_: Exception) {}
            try { Disposer.dispose(holder.cursorQuery) } catch (_: Exception) {}
            try { Disposer.dispose(holder.browser) } catch (_: Exception) {}
        }
    }

    override fun dispose() {
        holders.values.forEach { holder ->
            try { Disposer.dispose(holder.streamingQuery) } catch (_: Exception) {}
            try { Disposer.dispose(holder.cursorQuery) } catch (_: Exception) {}
            try { Disposer.dispose(holder.browser) } catch (_: Exception) {}
        }
        holders.clear()
    }

    companion object {
        fun getInstance(project: Project): ClaudeCodeBrowserService =
            project.getService(ClaudeCodeBrowserService::class.java)
    }
}
