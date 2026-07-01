package com.github.yhk1038.claudecodegui.hosting

import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * Tests for [HostModeCache.Signal], the awaitable that closes the first-open
 * timing race flagged in PR #146.
 *
 * At IDE startup the restore path ([com.github.yhk1038.claudecodegui.startup.ChatHostRestoreActivity])
 * decides which host restores sessions by reading the cached `hostMode`. On a
 * fresh install the cache is still empty because the backend's connect-time
 * HOST_MODE_CHANGED push has not arrived yet, so a naive read would fall back to
 * EDITOR_TAB and ignore the user's Sidebar choice. The [HostModeCache.Signal]
 * lets that one startup path *await* the first pushed value (bounded by a
 * timeout) instead of guessing.
 *
 * The logic is kept free of any IDE API by talking to a [HostModeCache.Store]
 * fake, so it runs as a plain unit test.
 */
class HostModeSignalTest {

    /** In-memory [HostModeCache.Store] standing in for the PropertiesComponent. */
    private class FakeStore(var value: String? = null) : HostModeCache.Store {
        override fun read(): String? = value
        override fun write(raw: String) { value = raw }
    }

    @Test
    fun `await returns the cached value immediately when one is already present`() = runBlocking {
        // Common case: a prior run persisted the value, so there is zero delay and
        // no need to wait for any push.
        val store = FakeStore(value = "tool-window")
        val signal = HostModeCache.Signal()

        val result = signal.await(store, timeoutMs = 5_000)

        assertEquals(HostMode.TOOL_WINDOW, result)
    }

    @Test
    fun `await completes with the pushed value when the cache starts empty`() = runBlocking {
        // Fresh install: the cache is empty until the backend pushes. await must
        // suspend and then resolve to the value delivered via complete().
        val store = FakeStore(value = null)
        val signal = HostModeCache.Signal()

        val awaited = async { signal.await(store, timeoutMs = 5_000) }

        // Simulate the backend push arriving shortly after startup restore began.
        delay(20)
        HostModeCache.update(store, "tool-window")
        signal.complete()

        assertEquals(HostMode.TOOL_WINDOW, awaited.await())
    }

    @Test
    fun `await falls back to EDITOR_TAB when no push arrives before the timeout`() = runBlocking {
        // No backend push (e.g. backend failed to start). The wait must be bounded
        // so IDE startup is never blocked indefinitely (issue #97), falling back to
        // the safe default.
        val store = FakeStore(value = null)
        val signal = HostModeCache.Signal()

        val result = signal.await(store, timeoutMs = 30)

        assertEquals(HostMode.EDITOR_TAB, result)
    }

    @Test
    fun `await returns EDITOR_TAB immediately when an editor-tab value is already cached`() = runBlocking {
        // A cached editor-tab value must short-circuit exactly like a tool-window one.
        val store = FakeStore(value = "editor-tab")
        val signal = HostModeCache.Signal()

        assertEquals(HostMode.EDITOR_TAB, signal.await(store, timeoutMs = 5_000))
    }

    @Test
    fun `complete before await still delivers the value without blocking`() = runBlocking {
        // If the push races ahead of the wait (backend already connected), await must
        // observe the completed signal and the freshly written value immediately.
        val store = FakeStore(value = null)
        val signal = HostModeCache.Signal()

        HostModeCache.update(store, "tool-window")
        signal.complete()

        assertEquals(HostMode.TOOL_WINDOW, signal.await(store, timeoutMs = 5_000))
    }
}
