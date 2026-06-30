package com.github.yhk1038.claudecodegui.bridge

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

/**
 * Unit tests for [parseHostModeParam] — the pure JSON-RPC param parsing used by
 * the HOST_MODE_CHANGED notification handler. The Node backend pushes
 * `{ "hostMode": "editor-tab" | "tool-window" }`; this extracts that raw string
 * so [com.github.yhk1038.claudecodegui.hosting.HostModeCache] can persist it (issue #7).
 */
class HostModeParamTest {

    private fun params(jsonText: String) =
        Json.parseToJsonElement(jsonText).jsonObject

    @Test
    fun `extracts the hostMode string`() {
        assertEquals("tool-window", parseHostModeParam(params("""{"hostMode":"tool-window"}""")))
        assertEquals("editor-tab", parseHostModeParam(params("""{"hostMode":"editor-tab"}""")))
    }

    @Test
    fun `returns null when hostMode param is missing`() {
        assertNull(parseHostModeParam(params("{}")))
    }

    @Test
    fun `returns null when hostMode is not a string`() {
        assertNull(parseHostModeParam(params("""{"hostMode":123}""")))
        assertNull(parseHostModeParam(params("""{"hostMode":null}""")))
    }
}
