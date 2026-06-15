package com.github.yhk1038.claudecodegui.toolwindow.realization

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class LoadingPhaseTest {

    @Test
    fun `INDEXING_WAIT carries expected message`() {
        assertEquals("Waiting for project indexing...", LoadingPhase.INDEXING_WAIT.message)
    }

    @Test
    fun `BACKEND_START carries expected message`() {
        assertEquals("Starting backend...", LoadingPhase.BACKEND_START.message)
    }

    @Test
    fun `LOCATING_NODE carries expected message`() {
        assertEquals("Locating Node.js...", LoadingPhase.LOCATING_NODE.message)
    }

    @Test
    fun `PREPARING_BACKEND carries expected message`() {
        assertEquals("Preparing backend files...", LoadingPhase.PREPARING_BACKEND.message)
    }

    @Test
    fun `WAITING_FOR_PORT carries expected message`() {
        assertEquals("Waiting for backend to be ready...", LoadingPhase.WAITING_FOR_PORT.message)
    }
}
