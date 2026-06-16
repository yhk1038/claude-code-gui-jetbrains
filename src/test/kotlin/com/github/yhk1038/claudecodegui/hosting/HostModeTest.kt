package com.github.yhk1038.claudecodegui.hosting

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * Pure parsing/serialization of the `hostMode` setting value.
 *
 * The settings file stores the kebab-case strings `editor-tab` / `tool-window`
 * (the same whitelist the backend `validateSetting` and the WebView enforce).
 * This is the only place that maps those strings to/from [HostMode].
 */
class HostModeTest {

    @Test
    fun `fromSetting maps editor-tab`() {
        assertEquals(HostMode.EDITOR_TAB, HostMode.fromSetting("editor-tab"))
    }

    @Test
    fun `fromSetting maps tool-window`() {
        assertEquals(HostMode.TOOL_WINDOW, HostMode.fromSetting("tool-window"))
    }

    @Test
    fun `fromSetting falls back to EDITOR_TAB for null`() {
        assertEquals(HostMode.EDITOR_TAB, HostMode.fromSetting(null))
    }

    @Test
    fun `fromSetting falls back to EDITOR_TAB for an unknown value`() {
        assertEquals(HostMode.EDITOR_TAB, HostMode.fromSetting("sidebar"))
    }

    @Test
    fun `toSetting emits the kebab-case whitelist strings`() {
        assertEquals("editor-tab", HostMode.EDITOR_TAB.toSetting())
        assertEquals("tool-window", HostMode.TOOL_WINDOW.toSetting())
    }

    @Test
    fun `fromSetting and toSetting round-trip every mode`() {
        for (mode in HostMode.entries) {
            assertEquals(mode, HostMode.fromSetting(mode.toSetting()))
        }
    }
}
