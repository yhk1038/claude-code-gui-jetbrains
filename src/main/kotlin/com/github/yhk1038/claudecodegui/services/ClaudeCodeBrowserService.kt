package com.github.yhk1038.claudecodegui.services

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.intellij.util.Alarm
import java.util.concurrent.ConcurrentHashMap

/**
 * Pure release rule for the pooled JCEF browser: a holder may be disposed only
 * when no panel still references it. Extracted as a top-level function so the
 * rule can be unit-tested without an IDE fixture. (issue #29)
 */
internal fun shouldReleasePooledBrowser(remainingPanelRefs: Int): Boolean =
    remainingPanelRefs <= 0

/**
 * Project-level service that pools JCEF browser instances by tabId.
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

        /**
         * Number of live panels referencing this browser. Incremented on
         * [getOrCreate] (panel acquires the browser) and decremented on
         * [releaseRef] (panel disposed). EDT-only access. (issue #29)
         */
        var panelRefCount: Int = 0

        /**
         * Monotonic token bumped on every acquire. A scheduled release captures
         * the token at schedule time and aborts if the token changed meanwhile —
         * i.e. the browser was re-acquired by a new panel during a tab move. This
         * makes release cancellation independent of EDT-tick timing. (issue #29)
         */
        var releaseToken: Int = 0
    }

    private val holders = ConcurrentHashMap<String, BrowserHolder>()

    /**
     * Grace timer for deferred release. A tab move disposes the old panel
     * (refCount → 0) and re-acquires from the new slot a few dozen ms later;
     * the delay lets that re-acquire cancel the release. A real tab close has
     * no re-acquire, so the release fires after the grace period. The delay
     * being generous is harmless — the browser simply lingers in the pool.
     */
    private val releaseAlarm = Alarm(Alarm.ThreadToUse.SWING_THREAD, this)

    /**
     * Whether JCEF is available in this runtime.
     *
     * Single source of truth for the "can we host a browser?" check. The
     * `claude.simulate.no.jcef` system property is a developer-only escape hatch
     * for verifying the fallback path without swapping the boot JBR.
     *
     * Cheap to call — does NOT initialize CefApp (only [JBCefApp.isSupported]
     * is consulted, which is a capability probe, not a builder).
     */
    fun isJcefAvailable(): Boolean {
        if (java.lang.Boolean.getBoolean("claude.simulate.no.jcef")) return false
        return JBCefApp.isSupported()
    }

    /**
     * Get an existing browser for the session, or create a new one. Marks the
     * browser as referenced by one more panel (refCount++) and bumps the
     * release token so any pending deferred release for this session aborts —
     * this is what keeps the browser alive across a tab move/split. The browser
     * is NOT registered with Disposer — it is managed by this service.
     */
    fun getOrCreate(tabId: String): BrowserHolder? {
        if (!isJcefAvailable()) {
            logger.warn("JCEF is not supported in this runtime — cannot create browser for tab: $tabId")
            return null
        }
        val holder = holders.getOrPut(tabId) {
            logger.info("Creating new JCEF browser for tab: $tabId")
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
        holder.panelRefCount += 1
        // Bump the token so any release scheduled before this acquire aborts.
        holder.releaseToken += 1
        return holder
    }

    /**
     * Drop one panel's reference to the session's browser. When the last
     * reference is gone, the browser is NOT disposed immediately: a tab
     * move/split disposes the old panel and re-acquires from the new slot a
     * short time later, and that re-acquire must keep the browser alive. So the
     * release is deferred by a grace period and aborts if the browser was
     * re-acquired meanwhile (token changed) or re-referenced (refCount > 0).
     * Only a genuine tab close — with no re-acquire — actually disposes it.
     *
     * [onReleased] runs only when the browser is truly disposed, letting the
     * caller perform the matching session/tab cleanup. (issue #29)
     */
    fun releaseRef(tabId: String, onReleased: () -> Unit) {
        val holder = holders[tabId] ?: return
        holder.panelRefCount -= 1
        if (!shouldReleasePooledBrowser(holder.panelRefCount)) return

        val tokenAtSchedule = holder.releaseToken
        releaseAlarm.addRequest({
            val current = holders[tabId] ?: return@addRequest
            // Re-acquired during the grace period → keep the pooled browser.
            if (current.releaseToken != tokenAtSchedule) return@addRequest
            if (!shouldReleasePooledBrowser(current.panelRefCount)) return@addRequest
            release(tabId)
            onReleased()
        }, RELEASE_GRACE_MS)
    }

    /**
     * Dispose the pooled browser for the session and drop it from the pool.
     * Private: callers go through [releaseRef] so the refcount + grace-period
     * guard is always applied. (issue #29)
     */
    private fun release(tabId: String) {
        holders.remove(tabId)?.let { holder ->
            logger.info("Releasing JCEF browser for tab: $tabId")
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
        /**
         * Grace period before a zero-reference browser is disposed. Must comfortably
         * exceed the tab-move dispose→re-acquire gap (observed 37–48ms) so a move
         * never disposes the browser, while still being imperceptible on a real
         * close. Generous on purpose — a lingering pooled browser is harmless.
         */
        private const val RELEASE_GRACE_MS = 750

        fun getInstance(project: Project): ClaudeCodeBrowserService =
            project.getService(ClaudeCodeBrowserService::class.java)
    }
}
