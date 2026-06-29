package com.github.yhk1038.claudecodegui.editor

import com.github.yhk1038.claudecodegui.actions.EditorContextPayload
import com.github.yhk1038.claudecodegui.services.NodeBackendService
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.Alarm
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URI

/**
 * Passive auto-selection channel that pushes the current editor file path and
 * selection to the backend's `/internal/ide-selection` endpoint whenever the
 * active editor or selection changes.
 *
 * This is **separate** from [com.github.yhk1038.claudecodegui.actions.SendSelectionToClaudeAction]
 * (the manual Alt+K action that posts to `/internal/editor-context`).
 *
 * ### Gating
 * Events are dispatched only when at least one [ClaudeCodeVirtualFile] tab is open
 * in the project. If no Claude Code tab is open there is no consumer, so the HTTP
 * call is suppressed entirely.
 *
 * The active file must not itself be a [ClaudeCodeVirtualFile] (the Claude panel
 * is not a real source file).
 *
 * ### Debounce
 * Selection events fire continuously during a drag. A 200 ms [Alarm]-based debounce
 * collapses bursts into a single dispatch after the burst ends.
 *
 * ### Deduplication
 * If the (absolutePath, startLine, endLine) triple is identical to the last
 * successfully dispatched event, the POST is skipped.
 */
object IdeSelectionDispatcher {

    private val logger = Logger.getInstance(IdeSelectionDispatcher::class.java)
    private val ioScope = CoroutineScope(Dispatchers.IO)

    /**
     * Tracks the last dispatched key so identical consecutive events are skipped.
     * Triple of (absolutePath, startLine, endLine).
     */
    @Volatile
    private var lastDispatched: Triple<String, Int?, Int?> = Triple("", null, null)

    /**
     * Per-project [Alarm] instances for debounce. Keys are project hash codes.
     * [Alarm] is not thread-safe; all access must happen on the EDT, which is
     * guaranteed because both [FileEditorManagerListener.selectionChanged] and
     * [com.intellij.openapi.editor.SelectionListener.selectionChanged] are always
     * called on the EDT.
     */
    private val alarms = mutableMapOf<Int, Alarm>()

    /**
     * Return (or create) the debounce [Alarm] for [project].
     *
     * Must be called on the EDT.
     */
    fun alarmFor(project: Project): Alarm =
        alarms.getOrPut(project.hashCode()) { Alarm(Alarm.ThreadToUse.SWING_THREAD) }

    /**
     * Dispose the [Alarm] associated with [project] when the project closes.
     *
     * Must be called on the EDT.
     */
    fun disposeAlarm(project: Project) {
        alarms.remove(project.hashCode())?.dispose()
    }

    /**
     * Schedule a debounced dispatch for the given [editor] / [vFile] within [project].
     *
     * Cancels any pending alarm for the project and schedules a new one to fire
     * after [DEBOUNCE_MS] milliseconds. Must be called on the EDT.
     *
     * @param project   The IDE project that owns this editor.
     * @param editor    The active [Editor] whose selection to read (may be null if
     *                  the file switch came from a tab-only focus event where no
     *                  editor reference is available — e.g. a future extension point).
     * @param vFile     The virtual file now active in the editor.
     */
    fun scheduleDispatch(project: Project, editor: Editor?, vFile: VirtualFile) {
        // Gate 1: ignore Claude Code panel files.
        if (vFile is ClaudeCodeVirtualFile) return

        // Gate 2: suppress when no Claude Code tab is open (no consumer).
        val fem = FileEditorManager.getInstance(project)
        val hasClaudeTab = fem.openFiles.any { it is ClaudeCodeVirtualFile }
        if (!hasClaudeTab) return

        val alarm = alarmFor(project)
        alarm.cancelAllRequests()
        alarm.addRequest(
            { doDispatch(project, editor, vFile) },
            DEBOUNCE_MS
        )
    }

    /**
     * Perform the actual payload build and HTTP POST (called from alarm callback,
     * still on the EDT). Launches HTTP I/O on [ioScope] to avoid blocking the EDT.
     */
    private fun doDispatch(project: Project, editor: Editor?, vFile: VirtualFile) {
        val absolutePath = vFile.path
        val workingDir = project.basePath
        val relativePath = EditorContextPayload.computeRelativePath(absolutePath, workingDir)

        val selectionModel = editor?.selectionModel
        val startLine: Int?
        val endLine: Int?
        val selectedText: String?
        if (selectionModel != null && selectionModel.hasSelection() && selectionModel.selectedText != null) {
            // Editor positions are 0-based; the payload uses 1-based line numbers.
            startLine = selectionModel.selectionStartPosition?.line?.plus(1)
            endLine = selectionModel.selectionEndPosition?.line?.plus(1)
            selectedText = selectionModel.selectedText
        } else {
            startLine = null
            endLine = null
            selectedText = null
        }

        // Deduplication: skip if this (path, startLine, endLine) was just sent.
        val key = Triple(absolutePath, startLine, endLine)
        if (key == lastDispatched) return
        lastDispatched = key

        val payload = EditorContextPayload.buildSelectionPayload(
            absolutePath = absolutePath,
            relativePath = relativePath,
            startLine = startLine,
            endLine = endLine,
            selectedText = selectedText,
            workingDir = workingDir
        )

        val backendKey = workingDir ?: return
        val backend = NodeBackendService.getInstance()

        ioScope.launch {
            try {
                val port = backend.awaitPort(backendKey)
                postIdeSelection(port, payload.toString())
            } catch (ex: Exception) {
                logger.debug("ide-selection dispatch failed (no backend yet or error): ${ex.message}")
            }
        }
    }

    /**
     * Fire-and-forget HTTP POST to `/internal/ide-selection`.
     *
     * Runs on [ioScope] (never the EDT). Short timeouts are intentional — this is
     * a passive channel and must not block the IDE if the backend is slow.
     */
    private fun postIdeSelection(port: Int, jsonBody: String) {
        val url = URI("http://127.0.0.1:$port/internal/ide-selection").toURL()
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 1000
            conn.readTimeout = 1000
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(jsonBody.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            logger.debug("POST /internal/ide-selection returned HTTP $code")
        } finally {
            conn.disconnect()
        }
    }

    /** Debounce window in milliseconds. */
    const val DEBOUNCE_MS: Int = 200
}
