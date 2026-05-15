package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodeToolWindowSessionManager
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project

class OpenClaudeCodeAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        openSession(project, java.util.UUID.randomUUID().toString())
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }

    companion object {
        /**
         * Opens or focuses a chat session in the **Claude Code** tool window.
         *
         * @param activateToolWindow When true, shows the tool window (e.g. user invoked Open action).
         *   When false, only adds/selects content (e.g. session restore before the user opens the tool window).
         */
        fun openSession(
            project: Project,
            sessionId: String,
            initialPath: String? = null,
            activateToolWindow: Boolean = true,
        ) {
            ClaudeCodeToolWindowSessionManager.getInstance(project)
                .openSession(sessionId, initialPath, activateToolWindow)
        }
    }
}
