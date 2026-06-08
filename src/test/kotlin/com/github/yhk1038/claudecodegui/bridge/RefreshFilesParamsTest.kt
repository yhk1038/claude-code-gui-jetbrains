package com.github.yhk1038.claudecodegui.bridge

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * Unit tests for [parseRefreshFilePaths] — the pure JSON-RPC param parsing used
 * by the REFRESH_FILES handler. Verifies it tolerates the shapes the Node.js
 * backend may send (issue #72 file-reload feature).
 */
class RefreshFilesParamsTest {

    private fun params(jsonText: String) =
        Json.parseToJsonElement(jsonText).jsonObject

    @Test
    fun `extracts the string paths in order`() {
        val result = parseRefreshFilePaths(params("""{"paths":["/repo/a.ts","/repo/b.ts"]}"""))
        assertEquals(listOf("/repo/a.ts", "/repo/b.ts"), result)
    }

    @Test
    fun `returns empty list when paths param is missing`() {
        assertEquals(emptyList<String>(), parseRefreshFilePaths(params("{}")))
    }

    @Test
    fun `returns empty list for an empty array`() {
        assertEquals(emptyList<String>(), parseRefreshFilePaths(params("""{"paths":[]}""")))
    }

    @Test
    fun `skips non-string entries`() {
        val result = parseRefreshFilePaths(params("""{"paths":["/repo/a.ts",123,null,"/repo/b.ts"]}"""))
        assertEquals(listOf("/repo/a.ts", "/repo/b.ts"), result)
    }

    @Test
    fun `returns empty list when paths is not an array`() {
        assertEquals(emptyList<String>(), parseRefreshFilePaths(params("""{"paths":"/repo/a.ts"}""")))
    }
}
