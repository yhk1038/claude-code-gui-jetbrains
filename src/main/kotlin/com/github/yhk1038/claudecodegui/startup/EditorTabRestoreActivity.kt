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
        val tabIds = stateService.getOpenTabIds()

        if (tabIds.isEmpty()) {
            logger.info("No saved editor tabs to restore")
            return
        }

        logger.info("Restoring ${tabIds.size} editor tab(s): $tabIds")

        val activeTabId = stateService.getActiveTabId()

        ApplicationManager.getApplication().invokeLater {
            // 비활성 탭 먼저 복원 (마지막으로 보던 경로로, 없으면 탭 페이지로)
            for (tabId in tabIds) {
                if (tabId != activeTabId) {
                    OpenClaudeCodeAction.openTab(
                        project,
                        tabId,
                        stateService.getRestorePath(tabId),
                        stateService.getTitle(tabId)
                    )
                }
            }
            // 활성 탭은 마지막에 열어서 포커스 획득
            if (activeTabId != null && activeTabId in tabIds) {
                OpenClaudeCodeAction.openTab(
                    project,
                    activeTabId,
                    stateService.getRestorePath(activeTabId),
                    stateService.getTitle(activeTabId)
                )
            }

            logger.info("Editor tabs restored successfully")
        }
    }
}
