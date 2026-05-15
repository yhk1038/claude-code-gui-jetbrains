package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodeToolWindowSessionManager
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import java.util.UUID

/**
 * Opens Claude Code settings inside the tool window (new session tab on the settings route).
 *
 * Intended to mirror Cmd+, / Ctrl+, when the **Claude Code** tool window is active.
 */
class OpenClaudeCodeSettingsAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val settingsSessionId = "settings-${UUID.randomUUID()}"
        OpenClaudeCodeAction.openSession(project, settingsSessionId, "/settings/general")
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        if (project == null) {
            e.presentation.isEnabledAndVisible = false
            return
        }
        val mgr = ClaudeCodeToolWindowSessionManager.getInstance(project)
        e.presentation.isEnabledAndVisible = mgr.isToolWindowActive() && mgr.hasOpenSessions()
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
}
