package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.services.ClaudeWebViewInjector
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.vfs.LocalFileSystem
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Sends the current editor selection to the active Claude Code chat as composer context (selection chip + fenced body on send).
 */
class AddSelectionToChatAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        val project = e.project
        val editor = e.getData(CommonDataKeys.EDITOR)
        val selectedText = editor?.selectionModel?.selectedText
        e.presentation.isEnabledAndVisible =
            project != null &&
                editor != null &&
                !selectedText.isNullOrBlank()
    }

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val selectedText = editor.selectionModel.selectedText?.takeIf { it.isNotBlank() } ?: return
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document) ?: return
        if (virtualFile.fileSystem !is LocalFileSystem) {
            return
        }
        val path = virtualFile.path
        if (path.isBlank()) return

        val startOffset = editor.selectionModel.selectionStart
        val endOffset = editor.selectionModel.selectionEnd
        val document = editor.document
        val startLine = document.getLineNumber(startOffset.coerceAtMost(document.textLength)) + 1
        val endLine = document.getLineNumber(endOffset.coerceAtMost(document.textLength)) + 1

        val contexts = buildJsonArray {
            add(
                buildJsonObject {
                    put("type", "selection")
                    put("path", path)
                    put("content", selectedText)
                    put("startLine", startLine)
                    put("endLine", endLine)
                },
            )
        }

        val sessionId = ClaudeWebViewInjector.prepareActiveSessionForIdeInjection(project)
        ClaudeWebViewInjector.injectComposerContexts(project, sessionId, contexts)
    }
}
