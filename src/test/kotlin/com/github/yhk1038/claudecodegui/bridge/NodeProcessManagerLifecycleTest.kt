package com.github.yhk1038.claudecodegui.bridge

import com.github.yhk1038.claudecodegui.toolwindow.realization.LoadingPhase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class NodeProcessManagerLifecycleTest {

    @Test
    fun `freshly created manager is not dead and not alive (STARTING)`() {
        val mgr = NodeProcessManager(CoroutineScope(Dispatchers.Default))
        // The key invariant behind the duplicate-spawn fix: a manager that exists but
        // hasn't finished starting must NOT look dead. ensureStarted only restarts when
        // isDead == true, so this prevents a concurrent second panel from racing a spawn.
        assertFalse(mgr.isDead, "a freshly created (still STARTING) manager must not report dead")
        assertFalse(mgr.isAlive, "no OS process has been spawned yet")
    }

    @Test
    fun `dispose transitions manager to dead`() {
        val mgr = NodeProcessManager(CoroutineScope(Dispatchers.Default))
        mgr.dispose()
        assertTrue(mgr.isDead, "after dispose the manager is dead")
        assertFalse(mgr.isAlive)
    }

    @Test
    fun `start emits LOCATING_NODE as its first progress phase`() {
        // start() emits LOCATING_NODE before any blocking discovery work, so it fires
        // regardless of whether node is actually installed — this is the signal the panel
        // uses to replace the frozen "Starting backend..." line. See issue #97.
        val latch = CountDownLatch(1)
        var firstPhase: LoadingPhase? = null
        val mgr = NodeProcessManager(
            CoroutineScope(Dispatchers.Default),
            onProgress = { phase ->
                if (firstPhase == null) {
                    firstPhase = phase
                    latch.countDown()
                }
            },
        )
        mgr.start()
        assertTrue(latch.await(5, TimeUnit.SECONDS), "start() must emit a progress phase")
        assertEquals(LoadingPhase.LOCATING_NODE, firstPhase)
        mgr.dispose()
    }
}
