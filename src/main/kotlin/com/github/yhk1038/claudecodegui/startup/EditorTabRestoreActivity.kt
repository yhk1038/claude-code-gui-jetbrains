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
            logger.info("No saved editor tabs to restore")
            return
        }

        logger.info("Restoring ${sessionIds.size} editor tab(s): $sessionIds")

        val activeSessionId = stateService.getActiveSessionId()

        ApplicationManager.getApplication().invokeLater {
            // 비활성 탭 먼저 복원
            for (sessionId in sessionIds) {
                if (sessionId != activeSessionId) {
                    OpenClaudeCodeAction.openSession(project, sessionId, "/sessions/$sessionId")
                }
            }
            // 활성 탭은 마지막에 열어서 포커스 획득
            if (activeSessionId != null && activeSessionId in sessionIds) {
                OpenClaudeCodeAction.openSession(project, activeSessionId, "/sessions/$activeSessionId")
            }

            logger.info("Editor tabs restored successfully")
        }
    }
}
