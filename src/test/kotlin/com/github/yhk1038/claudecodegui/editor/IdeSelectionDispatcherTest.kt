package com.github.yhk1038.claudecodegui.editor

import com.github.yhk1038.claudecodegui.actions.EditorContextPayload
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Pure unit tests for the payload-building logic used by [IdeSelectionDispatcher].
 *
 * The dispatcher itself depends on IntelliJ platform APIs (FileEditorManager,
 * EditorFactory, Alarm) that cannot be used without a full platform test harness.
 * These tests focus on the pure logic: payload construction and constant values.
 */
class IdeSelectionDispatcherTest {

    @Test
    fun `DEBOUNCE_MS should be a positive value within reasonable range`() {
        val ms = IdeSelectionDispatcher.DEBOUNCE_MS
        assertTrue(ms in 50..500, "DEBOUNCE_MS=$ms should be between 50 and 500 ms")
    }

    @Nested
    inner class SelectionPayloadGatingLogic {

        /**
         * When the user switches to a tab without making a text selection,
         * the dispatcher sends null for all selection fields. Verify that
         * [EditorContextPayload.buildSelectionPayload] produces the correct
         * JSON null placeholders in this "file-only" scenario.
         */
        @Test
        fun `tab-switch without selection produces null selection fields`() {
            val absolutePath = "/home/dev/project/src/App.kt"
            val workingDir = "/home/dev/project"
            val relativePath = EditorContextPayload.computeRelativePath(absolutePath, workingDir)

            val payload = EditorContextPayload.buildSelectionPayload(
                absolutePath = absolutePath,
                relativePath = relativePath,
                startLine = null,
                endLine = null,
                selectedText = null,
                workingDir = workingDir
            )

            assertEquals(JsonNull, payload["startLine"])
            assertEquals(JsonNull, payload["endLine"])
            assertEquals(JsonNull, payload["selectedText"])
            assertEquals(JsonPrimitive(absolutePath), payload["absolutePath"])
            assertEquals(JsonPrimitive("src/App.kt"), payload["relativePath"])
            assertEquals(JsonPrimitive(workingDir), payload["workingDir"])
        }

        /**
         * When the user drags to select text, all selection fields are populated.
         */
        @Test
        fun `text selection produces populated selection fields`() {
            val absolutePath = "/home/dev/project/src/App.kt"
            val workingDir = "/home/dev/project"
            val relativePath = EditorContextPayload.computeRelativePath(absolutePath, workingDir)

            val payload = EditorContextPayload.buildSelectionPayload(
                absolutePath = absolutePath,
                relativePath = relativePath,
                startLine = 12,
                endLine = 18,
                selectedText = "fun greet() {\n    println(\"Hello\")\n}",
                workingDir = workingDir
            )

            assertEquals(JsonPrimitive(12), payload["startLine"])
            assertEquals(JsonPrimitive(18), payload["endLine"])
            assertEquals(
                JsonPrimitive("fun greet() {\n    println(\"Hello\")\n}"),
                payload["selectedText"]
            )
        }

        /**
         * Single-line selection (startLine == endLine) is valid.
         */
        @Test
        fun `single-line selection has equal startLine and endLine`() {
            val payload = EditorContextPayload.buildSelectionPayload(
                absolutePath = "/proj/Main.kt",
                relativePath = "Main.kt",
                startLine = 7,
                endLine = 7,
                selectedText = "val answer = 42",
                workingDir = "/proj"
            )
            assertEquals(JsonPrimitive(7), payload["startLine"])
            assertEquals(JsonPrimitive(7), payload["endLine"])
        }

        /**
         * When the file is outside workingDir, relativePath falls back to absolutePath.
         * The dispatcher still sends a valid payload.
         */
        @Test
        fun `file outside workingDir uses absolutePath as relativePath`() {
            val absolutePath = "/tmp/scratch/test.kt"
            val workingDir = "/home/dev/project"
            val relativePath = EditorContextPayload.computeRelativePath(absolutePath, workingDir)

            // No prefix match → relativePath == absolutePath
            assertEquals(absolutePath, relativePath)

            val payload = EditorContextPayload.buildSelectionPayload(
                absolutePath = absolutePath,
                relativePath = relativePath,
                startLine = null,
                endLine = null,
                selectedText = null,
                workingDir = workingDir
            )
            assertEquals(JsonPrimitive(absolutePath), payload["relativePath"])
        }

        /**
         * Verifies the schema contract: all 6 fields are always present.
         */
        @Test
        fun `payload always contains all required schema fields`() {
            val payload = EditorContextPayload.buildSelectionPayload(
                absolutePath = "/a/b.kt",
                relativePath = "b.kt",
                startLine = null,
                endLine = null,
                selectedText = null,
                workingDir = "/a"
            )
            val requiredKeys = setOf(
                "absolutePath", "relativePath",
                "startLine", "endLine", "selectedText", "workingDir"
            )
            assertEquals(requiredKeys, payload.keys)
        }
    }
}
