package com.github.yhk1038.claudecodegui.hosting

import com.github.yhk1038.claudecodegui.editor.ClaudeCodeVirtualFile
import com.github.yhk1038.claudecodegui.services.EditorTabStateService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project

/**
 * Hosts chat sessions in IDE **editor tabs** — the original behaviour, now
 * expressed through the [ChatHost] contract.
 *
 * The open/restore logic here was lifted verbatim from
 * `OpenClaudeCodeAction.openTab` and `EditorTabRestoreActivity`; the only change
 * is that the restart-restore ordering is now sourced from the pure
 * [ChatHostRouter.planRestoreOrder] so it can be unit-tested.
 */
object EditorTabHost : ChatHost {

    private val logger = Logger.getInstance(EditorTabHost::class.java)

    override fun openOrFocus(project: Project, tabId: String, initialPath: String?, initialTitle: String?) {
        val fileEditorManager = FileEditorManager.getInstance(project)
        val virtualFile = ClaudeCodeVirtualFile.getOrCreate(project, tabId, initialPath, initialTitle)

        // Already-open tab → focus; otherwise open a new one.
        fileEditorManager.openFile(virtualFile, true)

        // Persist tab state.
        EditorTabStateService.getInstance(project).addTab(tabId)
    }

    override fun restorePersistedSessions(project: Project) {
        val stateService = EditorTabStateService.getInstance(project)
        val tabIds = stateService.getOpenTabIds()

        if (tabIds.isEmpty()) {
            logger.info("No saved editor tabs to restore")
            return
        }

        val activeTabId = stateService.getActiveTabId()
        val restoreOrder = ChatHostRouter.planRestoreOrder(tabIds, activeTabId)

        logger.info("Restoring ${tabIds.size} editor tab(s): $tabIds")

        ApplicationManager.getApplication().invokeLater {
            // Inactive tabs first (original order), active tab last so it wins focus.
            for (tabId in restoreOrder) {
                openOrFocus(
                    project,
                    tabId,
                    stateService.getRestorePath(tabId),
                    stateService.getTitle(tabId)
                )
            }
            logger.info("Editor tabs restored successfully")
        }
    }
}
