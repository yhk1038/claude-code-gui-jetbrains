package com.github.yhk1038.claudecodegui.startup

import com.github.yhk1038.claudecodegui.actions.OpenClaudeCodeAction
import com.github.yhk1038.claudecodegui.services.EditorTabStateService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

class EditorTabRestoreActivity : ProjectActivity {

    private val logger = Logger.getInstance(EditorTabRestoreActivity::class.java)

    override suspend fun execute(project: Project) {
        val stateService = EditorTabStateService.getInstance(project)
        val sessionIds = stateService.getOpenSessionIds()

        if (sessionIds.isEmpty()) {
            logger.info("No saved Claude Code sessions to restore")
            return
        }

        logger.info("Restoring ${sessionIds.size} Claude Code session(s) in tool window: $sessionIds")

        val activeSessionId = stateService.getActiveSessionId()

        ApplicationManager.getApplication().invokeLater {
            for (sessionId in sessionIds) {
                if (sessionId != activeSessionId) {
                    OpenClaudeCodeAction.openSession(
                        project,
                        sessionId,
                        "/sessions/$sessionId",
                        activateToolWindow = false,
                    )
                }
            }
            if (activeSessionId != null && activeSessionId in sessionIds) {
                OpenClaudeCodeAction.openSession(
                    project,
                    activeSessionId,
                    "/sessions/$activeSessionId",
                    activateToolWindow = false,
                )
            }

            logger.info("Claude Code sessions restored in tool window")
        }
    }
}
