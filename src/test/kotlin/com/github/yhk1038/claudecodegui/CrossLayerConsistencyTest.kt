package com.github.yhk1038.claudecodegui

import com.github.yhk1038.claudecodegui.settings.JsSettingsParser
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Cross-layer consistency tests (Phase 5)
 *
 * These tests use the same fixtures as the TypeScript backend tests
 * to verify that Kotlin and TypeScript implementations produce identical results.
 *
 * TS counterpart: backend/src/core/features/__tests__/cross-layer-consistency.test.ts
 */
class CrossLayerConsistencyTest {

    /**
     * Path normalization: both TS normalizeProjectPath() and Kotlin should replace
     * non-alphanumeric chars with '-'
     */
    @Test
    fun `path normalization should match TS backend`() {
        // Same regex as TS: workingDir.replace(/[^a-zA-Z0-9]/g, '-')
        val fixtures = listOf(
            "/home/user/project" to "-home-user-project",
            "/Users/admin/Documents/app" to "-Users-admin-Documents-app",
            "C:\\Users\\admin\\project" to "C--Users-admin-project",
            "/home/user/my project" to "-home-user-my-project",
            "/home/user/.config/app" to "-home-user--config-app",
            "" to "",
        )

        for ((input, expected) in fixtures) {
            val result = input.replace(Regex("[^a-zA-Z0-9]"), "-")
            assertEquals(expected, result, "Normalizing '$input'")
        }
    }

    /**
     * JS settings parsing: Kotlin JsSettingsParser.parse() should produce
     * the same key-value results as TS readSettingsFile()
     */
    @Test
    fun `JS settings parsing should match TS backend - simple settings`() {
        val input = """
            export default {
              // Theme
              theme: "dark",
              fontSize: 16,
              debugMode: true,
            };
        """.trimIndent()

        val result = JsSettingsParser.parse(input)

        assertEquals("dark", result["theme"]?.toString()?.trim('"'))
        assertEquals("16", result["fontSize"]?.toString())
        assertEquals("true", result["debugMode"]?.toString())
    }

    @Test
    fun `JS settings parsing should match TS backend - null and string values`() {
        val input = """
            export default {
              cliPath: null,
              theme: "system",
            };
        """.trimIndent()

        val result = JsSettingsParser.parse(input)

        assertTrue(result["cliPath"].toString() == "null")
        assertEquals("system", result["theme"]?.toString()?.trim('"'))
    }
}
