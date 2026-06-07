package com.github.yhk1038.claudecodegui.services

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class EditorTabStateServiceTest {

    private lateinit var service: EditorTabStateService

    @BeforeEach
    fun setup() {
        service = EditorTabStateService()
    }

    @Test
    fun `addTab should register tab and mark it active`() {
        service.addTab("tab-1")
        assertEquals(listOf("tab-1"), service.getOpenTabIds())
        assertEquals("tab-1", service.getActiveTabId())
    }

    @Test
    fun `addTab should not duplicate existing tab but still activate it`() {
        service.addTab("tab-1")
        service.addTab("tab-2")
        service.addTab("tab-1")
        assertEquals(listOf("tab-1", "tab-2"), service.getOpenTabIds())
        assertEquals("tab-1", service.getActiveTabId())
    }

    @Test
    fun `removeTab should drop tab and reselect last remaining as active`() {
        service.addTab("tab-1")
        service.addTab("tab-2")
        service.removeTab("tab-2")
        assertEquals(listOf("tab-1"), service.getOpenTabIds())
        assertEquals("tab-1", service.getActiveTabId())
    }

    @Test
    fun `updatePath should store current path for a tab`() {
        service.addTab("tab-1")
        service.updatePath("tab-1", "/sessions/abc/conversations/xyz")
        assertEquals("/sessions/abc/conversations/xyz", service.getPath("tab-1"))
    }

    @Test
    fun `getPath should return null for a tab without a stored path`() {
        service.addTab("tab-1")
        assertNull(service.getPath("tab-1"))
    }

    @Test
    fun `updatePath should overwrite a previously stored path`() {
        service.updatePath("tab-1", "/sessions/new")
        service.updatePath("tab-1", "/sessions/session-1")
        assertEquals("/sessions/session-1", service.getPath("tab-1"))
    }

    @Test
    fun `removeTab should also discard the stored path`() {
        service.addTab("tab-1")
        service.updatePath("tab-1", "/sessions/session-1")
        service.removeTab("tab-1")
        assertNull(service.getPath("tab-1"))
    }

    @Test
    fun `getRestorePath should prefer the stored path`() {
        service.addTab("tab-1")
        service.updatePath("tab-1", "/sessions/session-1/conversations/c1")
        assertEquals("/sessions/session-1/conversations/c1", service.getRestorePath("tab-1"))
    }

    @Test
    fun `getRestorePath should fall back to the tab page when no path stored`() {
        service.addTab("tab-1")
        assertEquals("/sessions/tab-1", service.getRestorePath("tab-1"))
    }

    @Test
    fun `state should survive a persist-reload round trip including paths`() {
        service.addTab("tab-1")
        service.addTab("tab-2")
        service.updatePath("tab-1", "/sessions/session-1")
        service.updatePath("tab-2", "/sessions/session-2/conversations/c2")

        // Simulate IDE shutdown -> restart: serialize then reload into a fresh service.
        val persisted = service.state
        val reloaded = EditorTabStateService()
        reloaded.loadState(persisted)

        assertEquals(listOf("tab-1", "tab-2"), reloaded.getOpenTabIds())
        assertEquals("tab-2", reloaded.getActiveTabId())
        assertEquals("/sessions/session-1", reloaded.getPath("tab-1"))
        assertEquals("/sessions/session-2/conversations/c2", reloaded.getPath("tab-2"))
    }
}
