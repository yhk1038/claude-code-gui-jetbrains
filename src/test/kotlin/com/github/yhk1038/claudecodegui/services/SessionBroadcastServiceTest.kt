package com.github.yhk1038.claudecodegui.services

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class SessionBroadcastServiceTest {

    private lateinit var service: SessionBroadcastService
    private lateinit var target1: MockBroadcastTarget
    private lateinit var target2: MockBroadcastTarget

    class MockBroadcastTarget : SessionBroadcastService.BroadcastTarget {
        val receivedMessages = mutableListOf<Pair<String, Map<String, Any?>>>()

        override fun sendBroadcastMessage(type: String, payload: Map<String, Any?>) {
            receivedMessages.add(type to payload)
        }
    }

    @BeforeEach
    fun setup() {
        service = SessionBroadcastService()
        target1 = MockBroadcastTarget()
        target2 = MockBroadcastTarget()
    }

    @Test
    fun `subscribe should register target to session`() {
        service.subscribe("session-1", target1)
        assertEquals(1, service.getSubscriberCount("session-1"))
        assertEquals("session-1", service.getSubscribedSession(target1))
    }

    @Test
    fun `subscribe multiple targets to same session`() {
        service.subscribe("session-1", target1)
        service.subscribe("session-1", target2)
        assertEquals(2, service.getSubscriberCount("session-1"))
    }

    @Test
    fun `subscribe should auto-unsubscribe from previous session`() {
        service.subscribe("session-1", target1)
        service.subscribe("session-2", target1)
        assertEquals(0, service.getSubscriberCount("session-1"))
        assertEquals(1, service.getSubscriberCount("session-2"))
        assertEquals("session-2", service.getSubscribedSession(target1))
    }

    @Test
    fun `unsubscribe should remove target from session`() {
        service.subscribe("session-1", target1)
        service.unsubscribe(target1)
        assertEquals(0, service.getSubscriberCount("session-1"))
        assertNull(service.getSubscribedSession(target1))
    }

    @Test
    fun `unsubscribe without subscription should be no-op`() {
        // Should not throw
        service.unsubscribe(target1)
        assertNull(service.getSubscribedSession(target1))
    }

    @Test
    fun `broadcast should send to all session subscribers`() {
        service.subscribe("session-1", target1)
        service.subscribe("session-1", target2)
        val payload = mapOf<String, Any?>("data" to "test")

        service.broadcast("session-1", "STREAM_EVENT", payload)

        assertEquals(1, target1.receivedMessages.size)
        assertEquals("STREAM_EVENT", target1.receivedMessages[0].first)
        assertEquals(1, target2.receivedMessages.size)
    }

    @Test
    fun `broadcast should respect exclude parameter`() {
        service.subscribe("session-1", target1)
        service.subscribe("session-1", target2)

        service.broadcast("session-1", "EVENT", emptyMap(), exclude = target1)

        assertEquals(0, target1.receivedMessages.size)
        assertEquals(1, target2.receivedMessages.size)
    }

    @Test
    fun `broadcast to non-existent session should be no-op`() {
        service.broadcast("nonexistent", "EVENT", emptyMap())
        // No exception thrown
    }

    @Test
    fun `broadcastToAll should send to all targets across sessions`() {
        service.subscribe("session-1", target1)
        service.subscribe("session-2", target2)

        service.broadcastToAll("SESSIONS_UPDATED", mapOf("action" to "refresh"))

        assertEquals(1, target1.receivedMessages.size)
        assertEquals("SESSIONS_UPDATED", target1.receivedMessages[0].first)
        assertEquals(1, target2.receivedMessages.size)
        assertEquals("SESSIONS_UPDATED", target2.receivedMessages[0].first)
    }

    @Test
    fun `broadcastToAll with no subscribers should be no-op`() {
        service.broadcastToAll("EVENT", emptyMap())
        // No exception thrown
    }

    @Test
    fun `dispose should clear all subscriptions`() {
        service.subscribe("session-1", target1)
        service.subscribe("session-2", target2)

        service.dispose()

        assertEquals(0, service.getSubscriberCount("session-1"))
        assertEquals(0, service.getSubscriberCount("session-2"))
    }

    @Test
    fun `broadcast should handle exception in target gracefully`() {
        val failingTarget = object : SessionBroadcastService.BroadcastTarget {
            override fun sendBroadcastMessage(type: String, payload: Map<String, Any?>) {
                throw RuntimeException("Send failed")
            }
        }
        service.subscribe("session-1", failingTarget)
        service.subscribe("session-1", target1)

        // Should not throw, and target1 should still receive the message
        service.broadcast("session-1", "EVENT", emptyMap())
        assertEquals(1, target1.receivedMessages.size)
    }
}
