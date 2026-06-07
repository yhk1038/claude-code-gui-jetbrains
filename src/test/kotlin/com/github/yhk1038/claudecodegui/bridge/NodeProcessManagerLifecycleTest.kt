package com.github.yhk1038.claudecodegui.bridge

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

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
}
