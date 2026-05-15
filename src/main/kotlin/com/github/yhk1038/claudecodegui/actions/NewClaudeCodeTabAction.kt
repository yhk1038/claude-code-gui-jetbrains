package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodeToolWindowSessionManager
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import java.util.UUID

/**
 * Opens a new Claude Code chat as an additional tab inside the **Claude Code** tool window.
 */
class NewClaudeCodeTabAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        OpenClaudeCodeAction.openSession(project, UUID.randomUUID().toString())
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        if (project == null) {
            e.presentation.isEnabledAndVisible = false
            return
        }
        e.presentation.isEnabledAndVisible = ClaudeCodeToolWindowSessionManager.getInstance(project).hasOpenSessions()
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
}
