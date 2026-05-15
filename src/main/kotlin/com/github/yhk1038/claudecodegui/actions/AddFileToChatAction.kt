package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.services.ClaudeWebViewInjector
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.vfs.LocalFileSystem

/**
 * Adds selected project-view files/folders to the active Claude Code chat as path attachments.
 */
class AddFileToChatAction : AnAction() {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        val project = e.project
        val files = e.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY)
        val single = e.getData(CommonDataKeys.VIRTUAL_FILE)
        val hasTarget = !files.isNullOrEmpty() || single != null
        e.presentation.isEnabledAndVisible = project != null && hasTarget
    }

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val listFromArray = e.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY)?.filterNotNull().orEmpty()
        val files = listFromArray.takeUnless { it.isEmpty() }
            ?: listOfNotNull(e.getData(CommonDataKeys.VIRTUAL_FILE))

        val entries = files.mapNotNull { vf ->
            if (vf.fileSystem !is LocalFileSystem) return@mapNotNull null
            val path = runCatching { vf.path }.getOrNull().orEmpty().ifBlank { return@mapNotNull null }
            ClaudeWebViewInjector.NativeDropEntry(path, vf.isDirectory)
        }
        if (entries.isEmpty()) return

        val sessionId = ClaudeWebViewInjector.prepareActiveSessionForIdeInjection(project)
        ClaudeWebViewInjector.injectNativeDropEntries(project, sessionId, entries)
    }
}
