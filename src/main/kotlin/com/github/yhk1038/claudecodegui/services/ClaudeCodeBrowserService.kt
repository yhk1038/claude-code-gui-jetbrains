package com.github.yhk1038.claudecodegui.services

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import java.util.concurrent.ConcurrentHashMap

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

        /** Callback for WebView streaming state changes (set by ClaudeCodePanel, consumed by ClaudeCodeFileEditor). */
        var onStreamingStateChanged: ((isStreaming: Boolean) -> Unit)? = null

        /** Whether the WebView URL has been loaded at least once. */
        var isLoaded: Boolean = false

        /** Whether JCEF handlers (display, load, keyboard, lifespan) have been installed. */
        var handlersInstalled: Boolean = false

        /** Whether native IDE/Swing drag-and-drop has been bridged into the WebView. */
        var nativeDropBridgeInstalled: Boolean = false

        /** Whether the IME NPE workaround has been applied. */
        var imeWorkaroundInstalled: Boolean = false

        /** Whether the LAF (IDE theme) change listener has been installed. */
        var lafListenerInstalled: Boolean = false

        /**
         * Parent Disposable for the LAF listener. Disposing this removes the listener
         * from LafManager. Tied to the browser holder lifecycle (NOT the panel) so
         * the listener survives tab move/split. Set when the listener is installed,
         * disposed in [release] and the service's [dispose].
         */
        var lafListenerDisposable: Disposable? = null
    }

    private val holders = ConcurrentHashMap<String, BrowserHolder>()

    /**
     * Get an existing browser for the session, or create a new one.
     * The browser is NOT registered with Disposer — it is managed by this service.
     */
    fun getOrCreate(sessionId: String): BrowserHolder? {
        // The system property is a developer-only escape hatch for verifying the
        // JCEF-unavailable fallback path (e.g. Android Studio reproduction) without
        // having to swap the boot JBR. End users are not expected to set it.
        if (!JBCefApp.isSupported() || java.lang.Boolean.getBoolean("claude.simulate.no.jcef")) {
            logger.warn("JCEF is not supported in this runtime — cannot create browser for session: $sessionId")
            return null
        }
        return holders.getOrPut(sessionId) {
            logger.info("Creating new JCEF browser for session: $sessionId")
            // Disable JCEF off-screen rendering so the browser renders natively.
            // OSR (default since 2023.2) fails to forward HiDPI scale to Chromium on
            // macOS Retina, producing pixelated output (issue #23, JBR-3526). Our
            // panel has no other Swing widgets that need to overlay the browser, so
            // the z-order trade-off does not apply.
            //
            // IntelliJ 2026.1+ runs JCEF out-of-process (remote-mode) where windowed
            // (non-OSR) browsers are unsupported; setOffScreenRendering(false) is
            // silently ignored and the browser paints as a black rectangle (issue #51,
            // IJPL-184288). JBCefApp.isRemoteEnabled() is package-private and cannot
            // be called from a plugin, so detect remote-mode via the JVM system
            // property that JBCefApp sets at class-load time.
            val isRemoteJcef = "true" == System.getProperty("jcef.remote.enabled")
            val builder = JBCefBrowser.createBuilder()
            if (!isRemoteJcef) {
                builder.setOffScreenRendering(false)
            }
            val browser = builder.build()
            val cursorQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)
            val streamingQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)
            BrowserHolder(browser, cursorQuery, streamingQuery)
        }
    }

    /**
     * Release and dispose the browser for the given session.
     * Called only on real tab close (via [ClaudeCodeEditorManagerListener.fileClosed]).
     */
    fun release(sessionId: String) {
        holders.remove(sessionId)?.let { holder ->
            logger.info("Releasing JCEF browser for session: $sessionId")
            try { holder.lafListenerDisposable?.let { Disposer.dispose(it) } } catch (_: Exception) {}
            try { Disposer.dispose(holder.streamingQuery) } catch (_: Exception) {}
            try { Disposer.dispose(holder.cursorQuery) } catch (_: Exception) {}
            try { Disposer.dispose(holder.browser) } catch (_: Exception) {}
        }
    }

    override fun dispose() {
        holders.values.forEach { holder ->
            try { holder.lafListenerDisposable?.let { Disposer.dispose(it) } } catch (_: Exception) {}
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
