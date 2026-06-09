package com.github.yhk1038.claudecodegui.services

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Unit tests for [resolveRemoteJcef], which decides whether JCEF is running in
 * out-of-process ("remote") mode so the browser holder can avoid forcing
 * windowed (non-OSR) rendering.
 *
 * Regression guard for issue #79: PyCharm 2026.1.3 RC2 (and every 2025.1+
 * build) runs JCEF out-of-process by default, but does NOT signal it via the
 * `jcef.remote.enabled` system property — JBCefApp itself detects remote mode
 * by reflectively calling `CefApp.isRemoteEnabled()`. The old code keyed off the
 * system property alone, mis-detected remote builds as in-process, forced
 * `setOffScreenRendering(false)`, and remote mode rejected windowed rendering
 * (IJPL-184288) → blank panel.
 *
 * The rule: trust the CefApp signal when available; only fall back to the legacy
 * system property when CefApp can't be queried (older JCEF without the method).
 */
class ResolveRemoteJcefTest {

    @Test
    fun `trusts CefApp when it reports remote enabled`() {
        assertTrue(resolveRemoteJcef(cefRemoteEnabled = true, legacySystemProperty = null))
    }

    @Test
    fun `trusts CefApp when it reports remote disabled`() {
        assertFalse(resolveRemoteJcef(cefRemoteEnabled = false, legacySystemProperty = null))
    }

    @Test
    fun `CefApp signal overrides a stale system property`() {
        // Property says "true" but CefApp authoritatively says not remote.
        assertFalse(resolveRemoteJcef(cefRemoteEnabled = false, legacySystemProperty = "true"))
    }

    @Test
    fun `falls back to the system property when CefApp cannot be queried`() {
        assertTrue(resolveRemoteJcef(cefRemoteEnabled = null, legacySystemProperty = "true"))
    }

    @Test
    fun `fallback treats a missing property as not remote`() {
        assertFalse(resolveRemoteJcef(cefRemoteEnabled = null, legacySystemProperty = null))
    }

    @Test
    fun `fallback treats a non-true property as not remote`() {
        assertFalse(resolveRemoteJcef(cefRemoteEnabled = null, legacySystemProperty = "false"))
    }
}
