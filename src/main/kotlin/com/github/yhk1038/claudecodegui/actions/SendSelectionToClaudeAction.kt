package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.bridge.NodeProcessManager
import com.github.yhk1038.claudecodegui.bridge.NotificationOutcome
import com.github.yhk1038.claudecodegui.editor.ClaudeCodeVirtualFile
import com.github.yhk1038.claudecodegui.services.NodeBackendService
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.net.HttpURLConnection
import java.net.URI
import java.util.UUID

/**
 * Pure, platform-independent logic for building the editor-context payload.
 *
 * Extracted from [SendSelectionToClaudeAction] so it can be unit-tested without
 * the IntelliJ platform, EDT, coroutines, or HTTP. Only string handling and
 * kotlinx.serialization are used here.
 */
object EditorContextPayload {

    /**
     * Compute the path of [absolutePath] relative to [workingDir].
     *
     * Returns [absolutePath] unchanged when:
     * - [workingDir] is null or blank, or
     * - [absolutePath] is not located under [workingDir].
     *
     * A trailing slash on [workingDir] is normalized. Sibling directories that
     * merely share a name prefix (e.g. "/abs/path" vs "/abs/pathology") are not
     * treated as a parent.
     */
    fun computeRelativePath(absolutePath: String, workingDir: String?): String {
        if (workingDir.isNullOrBlank()) return absolutePath
        val normalizedDir = workingDir.trimEnd('/')
        val prefix = "$normalizedDir/"
        return if (absolutePath.startsWith(prefix)) {
            absolutePath.substring(prefix.length)
        } else {
            absolutePath
        }
    }

    /**
     * Build the JSON payload sent to the backend's /internal/editor-context endpoint.
     *
     * When there is no selection, [startLine] and [endLine] are null and serialized
     * as JSON null. [workingDir] is serialized as JSON null when null. Note that
     * selectedText and language are intentionally omitted — the chat input only
     * needs the file path and optional line range.
     */
    fun buildPayload(
        absolutePath: String,
        relativePath: String,
        startLine: Int?,
        endLine: Int?,
        workingDir: String?
    ): JsonObject = buildJsonObject {
        put("absolutePath", JsonPrimitive(absolutePath))
        put("relativePath", JsonPrimitive(relativePath))
        put("startLine", startLine?.let { JsonPrimitive(it) } ?: JsonNull)
        put("endLine", endLine?.let { JsonPrimitive(it) } ?: JsonNull)
        put("workingDir", workingDir?.let { JsonPrimitive(it) } ?: JsonNull)
    }
}

/**
 * Editor action that sends the current file path (and selected line range, if any)
 * to the Claude Code chat input.
 *
 * Triggered via Alt+K or the editor context menu. The action:
 * 1. Extracts file path + optional selection range from the editor.
 * 2. Ensures the Node.js backend is running and focuses/opens a Claude Code tab.
 * 3. POSTs the editor context to the backend's /internal/editor-context endpoint
 *    on a background coroutine (fire-and-forget).
 *
 * The backend forwards the context to the webview, which inserts it as text into
 * the chat input (implemented in later stages).
 */
class SendSelectionToClaudeAction : AnAction() {

    private val logger = Logger.getInstance(SendSelectionToClaudeAction::class.java)

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val vFile = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return

        val selectionModel = editor.selectionModel
        val hasSelection = selectionModel.hasSelection() && selectionModel.selectedText != null
        val startLine: Int?
        val endLine: Int?
        if (hasSelection) {
            // Editor positions are 0-based; the payload uses 1-based line numbers.
            startLine = selectionModel.selectionStartPosition?.line?.plus(1)
            endLine = selectionModel.selectionEndPosition?.line?.plus(1)
        } else {
            startLine = null
            endLine = null
        }

        val absolutePath = vFile.path
        val workingDir = project.basePath
        val relativePath = EditorContextPayload.computeRelativePath(absolutePath, workingDir)
        val payload = EditorContextPayload.buildPayload(
            absolutePath = absolutePath,
            relativePath = relativePath,
            startLine = startLine,
            endLine = endLine,
            workingDir = workingDir
        )

        // Ensure the backend is running. A transient panel id keeps a no-op handler
        // registered only for the lifetime of this request, then is released in finally.
        val backend = NodeBackendService.getInstance()
        val transientPanelId = "action-transient-" + System.currentTimeMillis()
        // Key the backend by IDE project root (not workingDir) so this action shares
        // the same per-root backend as the project's Claude Code panels (#57).
        val backendKey = project.basePath ?: workingDir ?: ""
        backend.ensureStarted(backendKey, transientPanelId, NoopRpcHandler)

        // Reuse the most recent Claude Code tab, or open a new one. FileEditorManager
        // focuses the tab when it is already open. Must run on the EDT.
        focusOrOpenClaudeTab(project)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val port = backend.awaitPort(backendKey)
                postEditorContext(port, payload)
            } catch (ex: Exception) {
                logger.warn("Failed to send editor context to backend", ex)
            } finally {
                backend.releasePanel(backendKey, transientPanelId)
            }
        }
    }

    private fun focusOrOpenClaudeTab(project: Project) {
        ApplicationManager.getApplication().invokeLater {
            val fileEditorManager = FileEditorManager.getInstance(project)
            // Find a Claude Code tab that is actually open, regardless of whether its
            // session has been created yet. EditorTabStateService tracks session ids,
            // which an uninitialized tab (no first message sent) does not have — relying
            // on it would spuriously open a brand-new tab instead of focusing the open one.
            val existingTab = fileEditorManager.openFiles.firstOrNull { it is ClaudeCodeVirtualFile }
            if (existingTab != null) {
                fileEditorManager.openFile(existingTab, true)
            } else {
                OpenClaudeCodeAction.openTab(project, UUID.randomUUID().toString())
            }
        }
    }

    private fun postEditorContext(port: Int, payload: JsonObject) {
        val url = URI("http://127.0.0.1:$port/internal/editor-context").toURL()
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 2000
            conn.readTimeout = 2000
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            // Fire-and-forget: read the response code only to flush the request.
            val code = conn.responseCode
            logger.info("Editor context POST returned HTTP $code")
        } finally {
            conn.disconnect()
        }
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        val vFile = e.getData(CommonDataKeys.VIRTUAL_FILE)
        // Disable inside the Claude Code JCEF panel itself.
        e.presentation.isEnabledAndVisible =
            editor != null && vFile != null && vFile !is ClaudeCodeVirtualFile
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    /**
     * No-op RPC handler registered transiently while this action ensures the backend
     * is running. The action never needs IDE-native callbacks, so every method is a
     * minimal default. Released in [actionPerformed]'s finally block.
     */
    private object NoopRpcHandler : NodeProcessManager.RpcHandler {
        override suspend fun openFile(path: String) {}
        override suspend fun openDiff(filePath: String, oldContent: String, newContent: String, toolUseId: String?) {}
        override suspend fun applyDiff(filePath: String, newContent: String, toolUseId: String?): Boolean = false
        override suspend fun rejectDiff(toolUseId: String?) {}
        override suspend fun refreshFiles(paths: List<String>) {}
        override suspend fun createSession(workingDir: String) {}
        override suspend fun openNewTab(workingDir: String) {}
        override suspend fun openSettings(workingDir: String) {}
        override suspend fun openTerminal(workingDir: String) {}
        override suspend fun openUrl(url: String) {}
        override suspend fun pickFiles(mode: String, multiple: Boolean): List<String> = emptyList()
        override suspend fun updatePlugin() {}
        override suspend fun requiresRestart(): Boolean = false
        override suspend fun getIdeRoot(workingDir: String?): String? = null
        override suspend fun showNotification(title: String, body: String, panelId: String?) =
            NotificationOutcome(shown = false, ideFocused = true)
    }
}
