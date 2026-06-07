package com.github.yhk1038.claudecodegui.services

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Unit tests for the pooled-browser release rule used by
 * [ClaudeCodeBrowserService.releaseRef].
 *
 * Regression guard for issue #29: dragging a Claude chat tab to a different
 * split/position disposes the panel and recreates it in the new slot. The
 * earlier fix keyed the release decision on `FileEditorManager.isFileOpen`
 * checked one EDT tick later, but the tab-move close→open gap raced that tick
 * (37–48ms in practice), so the pooled JCEF browser was released
 * non-deterministically — sometimes reattached (no flicker), sometimes
 * recreated (visible blank + reload).
 *
 * The deterministic rule: release the pooled browser only when NO panel still
 * references it (refCount == 0). A tab move briefly drops the count to 0 and
 * then re-acquires it; a grace delay + re-acquire cancellation (verified via
 * run-ide) keeps the browser alive across that gap. These tests pin the pure
 * count rule.
 */
class ClaudeCodeBrowserServiceReleaseRuleTest {

    @Test
    fun `retains pooled browser while at least one panel still references it`() {
        assertFalse(
            shouldReleasePooledBrowser(remainingPanelRefs = 1),
            "Must NOT release while a panel still references the pooled browser",
        )
    }

    @Test
    fun `releases pooled browser only when no panel references it`() {
        assertTrue(
            shouldReleasePooledBrowser(remainingPanelRefs = 0),
            "Must release once no panel references the pooled browser",
        )
    }

    @Test
    fun `treats a negative ref count as released (defensive against double-release)`() {
        assertTrue(
            shouldReleasePooledBrowser(remainingPanelRefs = -1),
            "A negative count must still be treated as fully released",
        )
    }
}
