package com.github.yhk1038.claudecodegui.hosting

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * Pure-logic tests for [HostModeCache], the IDE-side cache of the `hostMode`
 * value pushed by the Node backend (issue #7).
 *
 * The backend is the single source of truth for settings; on WSL2 the IDE-side
 * JVM home and the Linux home diverge, so Kotlin can no longer read the settings
 * file for hostMode. Instead it caches the value the backend pushes over RPC.
 * The cache logic is kept free of any IDE API by talking to a [HostModeCache.Store]
 * abstraction, so it runs as a plain unit test with an in-memory fake store.
 */
class HostModeCacheTest {

    /** In-memory [HostModeCache.Store] standing in for the PropertiesComponent. */
    private class FakeStore(var value: String? = null) : HostModeCache.Store {
        override fun read(): String? = value
        override fun write(raw: String) { value = raw }
    }

    @Test
    fun `read falls back to EDITOR_TAB when the cache is empty`() {
        // Nothing has been pushed yet — preserve the safe default so behaviour
        // matches a fresh install before the first RPC push arrives.
        assertEquals(HostMode.EDITOR_TAB, HostModeCache.read(FakeStore(value = null)))
    }

    @Test
    fun `read returns TOOL_WINDOW after a tool-window value is cached`() {
        assertEquals(HostMode.TOOL_WINDOW, HostModeCache.read(FakeStore(value = "tool-window")))
    }

    @Test
    fun `read returns EDITOR_TAB after an editor-tab value is cached`() {
        assertEquals(HostMode.EDITOR_TAB, HostModeCache.read(FakeStore(value = "editor-tab")))
    }

    @Test
    fun `read falls back to EDITOR_TAB for an unknown cached value`() {
        assertEquals(HostMode.EDITOR_TAB, HostModeCache.read(FakeStore(value = "sidebar")))
    }

    @Test
    fun `update persists the raw value so a later read reflects it`() {
        val store = FakeStore()
        HostModeCache.update(store, "tool-window")
        assertEquals("tool-window", store.value)
        assertEquals(HostMode.TOOL_WINDOW, HostModeCache.read(store))
    }

    @Test
    fun `update then update again overwrites the cached value`() {
        val store = FakeStore()
        HostModeCache.update(store, "tool-window")
        HostModeCache.update(store, "editor-tab")
        assertEquals(HostMode.EDITOR_TAB, HostModeCache.read(store))
    }
}
