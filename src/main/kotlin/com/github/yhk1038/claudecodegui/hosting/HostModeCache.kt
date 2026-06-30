package com.github.yhk1038.claudecodegui.hosting

import com.intellij.ide.util.PropertiesComponent

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

    /** Cache the raw host-mode string pushed by the backend into the production store. */
    fun update(raw: String) = update(PropertiesComponentStore, raw)
}
