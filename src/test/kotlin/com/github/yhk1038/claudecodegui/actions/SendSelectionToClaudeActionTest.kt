package com.github.yhk1038.claudecodegui.actions

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class SendSelectionToClaudeActionTest {

    @Nested
    inner class ComputeRelativePath {
        @Test
        fun `should return relative path for file under workingDir`() {
            val result = EditorContextPayload.computeRelativePath(
                absolutePath = "/abs/path/src/file.ts",
                workingDir = "/abs/path"
            )
            assertEquals("src/file.ts", result)
        }

        @Test
        fun `should handle workingDir with trailing slash`() {
            val result = EditorContextPayload.computeRelativePath(
                absolutePath = "/abs/path/src/file.ts",
                workingDir = "/abs/path/"
            )
            assertEquals("src/file.ts", result)
        }

        @Test
        fun `should handle workingDir without trailing slash`() {
            val result = EditorContextPayload.computeRelativePath(
                absolutePath = "/abs/path/nested/dir/file.kt",
                workingDir = "/abs/path"
            )
            assertEquals("nested/dir/file.kt", result)
        }

        @Test
        fun `should return absolutePath when file is outside workingDir`() {
            val result = EditorContextPayload.computeRelativePath(
                absolutePath = "/other/place/file.ts",
                workingDir = "/abs/path"
            )
            assertEquals("/other/place/file.ts", result)
        }

        @Test
        fun `should return absolutePath when workingDir is null`() {
            val result = EditorContextPayload.computeRelativePath(
                absolutePath = "/abs/path/src/file.ts",
                workingDir = null
            )
            assertEquals("/abs/path/src/file.ts", result)
        }

        @Test
        fun `should return absolutePath when workingDir is blank`() {
            val result = EditorContextPayload.computeRelativePath(
                absolutePath = "/abs/path/src/file.ts",
                workingDir = "   "
            )
            assertEquals("/abs/path/src/file.ts", result)
        }

        @Test
        fun `should not treat sibling prefix as parent dir`() {
            // workingDir "/abs/path" must not match "/abs/pathology/file.ts"
            val result = EditorContextPayload.computeRelativePath(
                absolutePath = "/abs/pathology/file.ts",
                workingDir = "/abs/path"
            )
            assertEquals("/abs/pathology/file.ts", result)
        }
    }

    @Nested
    inner class BuildPayload {
        @Test
        fun `should build payload with selection line range`() {
            val payload = EditorContextPayload.buildPayload(
                absolutePath = "/abs/path/src/file.ts",
                relativePath = "src/file.ts",
                startLine = 10,
                endLine = 25,
                workingDir = "/abs/path"
            )
            assertEquals(JsonPrimitive("/abs/path/src/file.ts"), payload["absolutePath"])
            assertEquals(JsonPrimitive("src/file.ts"), payload["relativePath"])
            assertEquals(JsonPrimitive(10), payload["startLine"])
            assertEquals(JsonPrimitive(25), payload["endLine"])
            assertEquals(JsonPrimitive("/abs/path"), payload["workingDir"])
        }

        @Test
        fun `should build payload with null lines when no selection`() {
            val payload = EditorContextPayload.buildPayload(
                absolutePath = "/abs/path/src/file.ts",
                relativePath = "src/file.ts",
                startLine = null,
                endLine = null,
                workingDir = "/abs/path"
            )
            assertEquals(JsonNull, payload["startLine"])
            assertEquals(JsonNull, payload["endLine"])
        }

        @Test
        fun `should build payload with null workingDir`() {
            val payload = EditorContextPayload.buildPayload(
                absolutePath = "/abs/path/src/file.ts",
                relativePath = "/abs/path/src/file.ts",
                startLine = null,
                endLine = null,
                workingDir = null
            )
            assertEquals(JsonNull, payload["workingDir"])
            assertEquals(JsonPrimitive("/abs/path/src/file.ts"), payload["absolutePath"])
            assertEquals(JsonPrimitive("/abs/path/src/file.ts"), payload["relativePath"])
        }

        @Test
        fun `should not include selectedText or language fields`() {
            val payload = EditorContextPayload.buildPayload(
                absolutePath = "/abs/path/src/file.ts",
                relativePath = "src/file.ts",
                startLine = 1,
                endLine = 2,
                workingDir = "/abs/path"
            )
            assertFalse(payload.containsKey("selectedText"))
            assertFalse(payload.containsKey("language"))
        }
    }
}
