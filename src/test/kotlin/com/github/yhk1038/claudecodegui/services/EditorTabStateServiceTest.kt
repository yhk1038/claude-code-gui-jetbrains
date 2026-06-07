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
    fun `addTab should register session and mark it active`() {
        service.addTab("session-1")
        assertEquals(listOf("session-1"), service.getOpenSessionIds())
        assertEquals("session-1", service.getActiveSessionId())
    }

    @Test
    fun `addTab should not duplicate existing session but still activate it`() {
        service.addTab("session-1")
        service.addTab("session-2")
        service.addTab("session-1")
        assertEquals(listOf("session-1", "session-2"), service.getOpenSessionIds())
        assertEquals("session-1", service.getActiveSessionId())
    }

    @Test
    fun `removeTab should drop session and reselect last remaining as active`() {
        service.addTab("session-1")
        service.addTab("session-2")
        service.removeTab("session-2")
        assertEquals(listOf("session-1"), service.getOpenSessionIds())
        assertEquals("session-1", service.getActiveSessionId())
    }

    @Test
    fun `updatePath should store current path for a session`() {
        service.addTab("session-1")
        service.updatePath("session-1", "/sessions/abc/conversations/xyz")
        assertEquals("/sessions/abc/conversations/xyz", service.getPath("session-1"))
    }

    @Test
    fun `getPath should return null for a session without a stored path`() {
        service.addTab("session-1")
        assertNull(service.getPath("session-1"))
    }

    @Test
    fun `updatePath should overwrite a previously stored path`() {
        service.updatePath("session-1", "/sessions/new")
        service.updatePath("session-1", "/sessions/session-1")
        assertEquals("/sessions/session-1", service.getPath("session-1"))
    }

    @Test
    fun `removeTab should also discard the stored path`() {
        service.addTab("session-1")
        service.updatePath("session-1", "/sessions/session-1")
        service.removeTab("session-1")
        assertNull(service.getPath("session-1"))
    }

    @Test
    fun `getRestorePath should prefer the stored path`() {
        service.addTab("session-1")
        service.updatePath("session-1", "/sessions/session-1/conversations/c1")
        assertEquals("/sessions/session-1/conversations/c1", service.getRestorePath("session-1"))
    }

    @Test
    fun `getRestorePath should fall back to the session page when no path stored`() {
        service.addTab("session-1")
        assertEquals("/sessions/session-1", service.getRestorePath("session-1"))
    }

    @Test
    fun `state should survive a persist-reload round trip including paths`() {
        service.addTab("session-1")
        service.addTab("session-2")
        service.updatePath("session-1", "/sessions/session-1")
        service.updatePath("session-2", "/sessions/session-2/conversations/c2")

        // Simulate IDE shutdown -> restart: serialize then reload into a fresh service.
        val persisted = service.state
        val reloaded = EditorTabStateService()
        reloaded.loadState(persisted)

        assertEquals(listOf("session-1", "session-2"), reloaded.getOpenSessionIds())
        assertEquals("session-2", reloaded.getActiveSessionId())
        assertEquals("/sessions/session-1", reloaded.getPath("session-1"))
        assertEquals("/sessions/session-2/conversations/c2", reloaded.getPath("session-2"))
    }
}
