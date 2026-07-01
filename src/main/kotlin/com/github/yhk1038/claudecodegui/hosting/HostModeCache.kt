package com.github.yhk1038.claudecodegui.hosting

import com.intellij.ide.util.PropertiesComponent
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull

/**
 * IDE-side cache of the `hostMode` value (issue #7).
 *
 * The Node backend is the single source of truth for settings (see CLAUDE.md). On
 * WSL2 the backend runs inside the Linux distro, so it writes the settings file
 * under the Linux home (`/home/<user>/.claude-code-gui`), while the IDE-side JVM's
 * `user.home` is the Windows home (`C:\Users\<user>`). Those two paths diverge, so
 * Kotlin reading the settings file directly would never find the user's chosen
 * `hostMode` and would always fall back to [HostMode.EDITOR_TAB] — the chat opened
 * in an editor tab even when "Sidebar" (tool-window) was selected.
 *
 * The fix: Kotlin no longer reads the settings file for `hostMode`. The backend
 * pushes the value over the RPC channel (on connect and on every save) as a
 * HOST_MODE_CHANGED notification, and we cache it here in [PropertiesComponent] —
 * the IDE-standard persistent store, which has no home-path divergence. Host
 * routing ([ChatHostRouter.currentHost]) then reads this cache synchronously.
 *
 * The read/update logic is kept free of any IDE API by talking to a [Store]
 * abstraction, so it is unit-testable with an in-memory fake (see HostModeCacheTest).
 */
object HostModeCache {

    /** The PropertiesComponent key the raw `hostMode` string is cached under. */
    private const val KEY = "com.github.yhk1038.claudecodegui.hostMode"

    /** Minimal persistence backend, so the cache logic can be tested without the IDE. */
    interface Store {
        /** The cached raw `hostMode` string, or null when nothing has been cached yet. */
        fun read(): String?
        /** Persist the raw `hostMode` string. */
        fun write(raw: String)
    }

    /** Production [Store] backed by the application-level [PropertiesComponent]. */
    private object PropertiesComponentStore : Store {
        override fun read(): String? = PropertiesComponent.getInstance().getValue(KEY)
        override fun write(raw: String) = PropertiesComponent.getInstance().setValue(KEY, raw)
    }

    /**
     * Resolve the cached [HostMode] from [store]. An empty cache (no push received
     * yet) or an unknown value falls back to [HostMode.EDITOR_TAB] — the safe default
     * that preserves the original behaviour.
     */
    fun read(store: Store): HostMode = HostMode.fromSetting(store.read())

    /** Persist the raw `hostMode` string pushed by the backend into [store]. */
    fun update(store: Store, raw: String) = store.write(raw)

    /** Read the cached host mode from the production PropertiesComponent store. */
    fun read(): HostMode = read(PropertiesComponentStore)

    /**
     * True when the production store already holds a pushed `hostMode` (any value).
     * The startup restore path uses this to skip the first-push wait once a value
     * has ever been cached — persistence makes that the common case.
     */
    fun hasCachedValue(): Boolean = PropertiesComponentStore.read() != null

    /** Cache the raw host-mode string pushed by the backend into the production store. */
    fun update(raw: String) {
        update(PropertiesComponentStore, raw)
        // Wake anyone parked in [Signal.await] on the very first push (issue #7 / PR #146).
        firstPushSignal.complete()
    }

    /**
     * Awaitable that closes the first-open timing race PR #146 flagged.
     *
     * On a fresh install the cache is empty until the backend's connect-time
     * HOST_MODE_CHANGED push arrives. The IDE-startup restore path
     * ([com.github.yhk1038.claudecodegui.startup.ChatHostRestoreActivity]) is the
     * only place that must NOT guess EDITOR_TAB before that push lands, so it awaits
     * this signal once. Every other entry point (the "+" button, Cmd+N, the popup,
     * the tool-window factory) keeps reading the persistent cache synchronously with
     * zero delay — the persisted value is already correct by then.
     *
     * The wait is bounded: if no push arrives before the timeout the caller gets the
     * safe [HostMode.EDITOR_TAB] fallback, so startup is never blocked indefinitely
     * (the lesson of issue #97). Because [PropertiesComponent] persists the value,
     * this wait only ever matters on the first run before any push — subsequent runs
     * short-circuit on the already-cached value.
     *
     * Kept free of any IDE API (talks to a [Store]) so it is unit-testable.
     */
    class Signal {
        private val firstPush = CompletableDeferred<Unit>()

        /** Mark the first backend push as received, releasing any pending [await]. */
        fun complete() {
            firstPush.complete(Unit)
        }

        /**
         * Resolve the [HostMode] for [store]. Returns the cached value immediately
         * when one is already present; otherwise suspends until [complete] fires or
         * [timeoutMs] elapses, then reads the store (falling back to
         * [HostMode.EDITOR_TAB] on timeout / empty cache).
         */
        suspend fun await(store: Store, timeoutMs: Long): HostMode {
            if (store.read() != null) return read(store)
            withTimeoutOrNull(timeoutMs) { firstPush.await() }
            return read(store)
        }

        /** Await against the production [PropertiesComponentStore] (see [await]). */
        suspend fun await(timeoutMs: Long): HostMode = await(PropertiesComponentStore, timeoutMs)
    }

    /**
     * Process-wide signal completed by the production [update] on the first backend
     * push. The startup restore path awaits this instance; all other reads ignore it.
     */
    val firstPushSignal = Signal()
}
