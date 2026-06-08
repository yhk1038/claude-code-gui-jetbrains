package com.github.yhk1038.claudecodegui.toolwindow.realization

/**
 * Resettable reentrancy guard that allows exactly one [enter] per cycle.
 *
 * Unlike [RealizationGate] (a one-shot guard), this gate can be re-armed with
 * [reset] so a new cycle may [enter] again. It is used by
 * `ClaudeCodeToolWindowFactory` so that a single stripe-icon click — during
 * which `stateChanged` fires repeatedly while the ToolWindow is visible — opens
 * exactly one editor tab, and the *next* click (after the ToolWindow returns to
 * invisible and the gate is reset) opens one more.
 *
 * **Not thread-safe** — intended to be called exclusively from the EDT
 * (Event Dispatch Thread). Concurrent access from other threads is undefined behavior.
 */
class ReentrancyGate {
    private var entered: Boolean = false

    /**
     * Returns `true` on the first call of the current cycle and `false` on every
     * subsequent call until [reset] is invoked.
     */
    fun enter(): Boolean {
        if (entered) return false
        entered = true
        return true
    }

    /**
     * Re-arms the gate so the next [enter] succeeds again. Safe to call even when
     * the gate has not yet been entered.
     */
    fun reset() {
        entered = false
    }
}
