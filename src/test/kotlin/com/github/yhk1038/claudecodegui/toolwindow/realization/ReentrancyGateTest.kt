package com.github.yhk1038.claudecodegui.toolwindow.realization

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Verifies the reentrancy guard used by `ClaudeCodeToolWindowFactory` to ensure
 * a single stripe-icon click opens exactly one editor tab.
 *
 * The bug (GitHub issue context): when the ToolWindow becomes visible, the
 * `stateChanged` listener fires multiple times for one click, and an immediate
 * "open now" block races with it. Both paths must share a single gate so that
 * one visible-cycle opens exactly one tab — yet the gate must reset when the
 * ToolWindow returns to invisible so the *next* click opens again.
 *
 * [ReentrancyGate] models this as: `enter()` returns true exactly once per
 * cycle, `reset()` re-arms it for the next cycle.
 */
class ReentrancyGateTest {

    @Nested
    inner class Enter {
        @Test
        fun `first enter returns true`() {
            val gate = ReentrancyGate()
            assertTrue(gate.enter(), "First enter in a cycle must succeed")
        }

        @Test
        fun `second enter within the same cycle returns false`() {
            val gate = ReentrancyGate()
            gate.enter()
            assertFalse(gate.enter(), "A second enter without reset must be skipped")
        }

        @Test
        fun `many consecutive enters yield exactly one success`() {
            val gate = ReentrancyGate()
            var successes = 0
            repeat(10) {
                if (gate.enter()) successes++
            }
            assertEquals(1, successes, "Only one enter per cycle may succeed")
        }
    }

    @Nested
    inner class Reset {
        @Test
        fun `enter succeeds again after reset`() {
            val gate = ReentrancyGate()
            assertTrue(gate.enter())
            assertFalse(gate.enter())
            gate.reset()
            assertTrue(gate.enter(), "After reset the gate must allow one more enter")
        }

        @Test
        fun `reset on a fresh gate keeps enter usable`() {
            val gate = ReentrancyGate()
            gate.reset()
            assertTrue(gate.enter())
        }

        @Test
        fun `each visible cycle opens exactly once across resets`() {
            val gate = ReentrancyGate()
            var opens = 0

            // Simulate three click cycles. Each cycle: many stateChanged fires
            // (enter), then the ToolWindow goes invisible (reset).
            repeat(3) {
                repeat(5) {
                    if (gate.enter()) opens++
                }
                gate.reset()
            }

            assertEquals(3, opens, "Three clicks must open exactly three tabs")
        }
    }
}
