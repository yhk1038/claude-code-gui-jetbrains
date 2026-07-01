package com.github.yhk1038.claudecodegui.bridge

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.util.concurrent.atomic.AtomicInteger

class PluginResourceExtractorTest {

    /** Writes a complete, verifiable bundle into the extractor's temp targets. */
    private fun completeUnpack(webviewTarget: File, backendDirTarget: File) {
        File(webviewTarget, "assets").mkdirs()
        File(webviewTarget, "assets/index-abc123.js").writeText("// bundle")
        File(webviewTarget, "index.html").writeText("<html></html>")
        File(backendDirTarget, "backend.mjs").writeText("// backend")
    }

    private fun extractor(
        baseDir: File,
        version: String = "1.2.3",
        unpack: (File, File) -> Unit,
    ) = PluginResourceExtractor(baseDir = baseDir, version = version, unpack = unpack)

    @Test
    fun `extracts into a version-scoped dir on first resolve`(@TempDir base: File) {
        val calls = AtomicInteger(0)
        val result = extractor(base) { wv, bd -> calls.incrementAndGet(); completeUnpack(wv, bd) }.resolve()

        assertEquals(1, calls.get(), "unpack should run exactly once")
        assertEquals(File(base, "1.2.3/webview"), result.webviewDir)
        assertEquals(File(base, "1.2.3/backend/backend.mjs"), result.backendFile)
        assertTrue(File(result.webviewDir, "assets/index-abc123.js").isFile)
        assertTrue(result.backendFile.isFile)
    }

    @Test
    fun `skips extraction when the version dir is already complete`(@TempDir base: File) {
        // Pre-seed a complete version dir.
        extractor(base) { wv, bd -> completeUnpack(wv, bd) }.resolve()

        val calls = AtomicInteger(0)
        val result = extractor(base) { _, _ -> calls.incrementAndGet() }.resolve()

        assertEquals(0, calls.get(), "a complete version dir must not be re-extracted")
        assertTrue(File(result.webviewDir, "assets/index-abc123.js").isFile)
    }

    @Test
    fun `prunes other version dirs but keeps the current one`(@TempDir base: File) {
        // A stale previous version left on disk.
        val stale = File(base, "1.0.0/webview/assets").apply { mkdirs() }
        File(stale, "index-old.js").writeText("// old")
        File(base, "1.0.0/backend").mkdirs()

        extractor(base, version = "1.2.3") { wv, bd -> completeUnpack(wv, bd) }.resolve()

        assertFalse(File(base, "1.0.0").exists(), "stale other-version dir should be pruned")
        assertTrue(File(base, "1.2.3/webview/assets/index-abc123.js").isFile, "current version kept")
    }

    @Test
    fun `leaves no temp dir after a successful extraction`(@TempDir base: File) {
        extractor(base) { wv, bd -> completeUnpack(wv, bd) }.resolve()

        val leftovers = base.listFiles()?.filter { it.name.startsWith(".tmp-") } ?: emptyList()
        assertTrue(leftovers.isEmpty(), "no .tmp-* dir should remain: $leftovers")
    }

    @Test
    fun `throws and does not publish a version dir on incomplete extraction`(@TempDir base: File) {
        // Unpack writes backend but no hashed JS bundle → verification must fail.
        val ex = assertThrows(IllegalStateException::class.java) {
            extractor(base) { _, bd -> File(bd, "backend.mjs").writeText("// backend") }.resolve()
        }
        assertTrue(ex.message!!.contains("Incomplete"), "message: ${ex.message}")
        assertFalse(File(base, "1.2.3").exists(), "no partial version dir should be published")
        val leftovers = base.listFiles()?.filter { it.name.startsWith(".tmp-") } ?: emptyList()
        assertTrue(leftovers.isEmpty(), "temp dir should be cleaned up on failure: $leftovers")
    }

    @Test
    fun `re-extracts when the version dir exists but is partial`(@TempDir base: File) {
        // A partial version dir (backend present, hashed bundle missing).
        File(base, "1.2.3/webview/assets").mkdirs()
        File(base, "1.2.3/backend").mkdirs()
        File(base, "1.2.3/backend/backend.mjs").writeText("// stale backend")

        val calls = AtomicInteger(0)
        extractor(base) { wv, bd -> calls.incrementAndGet(); completeUnpack(wv, bd) }.resolve()

        assertEquals(1, calls.get(), "a partial version dir must be re-extracted")
        assertTrue(File(base, "1.2.3/webview/assets/index-abc123.js").isFile)
    }
}
