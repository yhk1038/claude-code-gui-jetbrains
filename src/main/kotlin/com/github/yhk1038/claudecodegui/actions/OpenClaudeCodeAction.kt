package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.hosting.ChatHostRouter
import com.github.yhk1038.claudecodegui.services.EditorTabStateService
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import java.util.UUID

class OpenClaudeCodeAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        // "Open" reveals the chat: focus an already-open tab if there is one,
        // and only mint a fresh tab id when none is open. Spawning extra tabs is
        // the New Tab action's job — see ChatHostRouter.planOpen (issue #180).
        val state = EditorTabStateService.getInstance(project)
        val tabId = ChatHostRouter.planOpen(
            state.getOpenTabIds(),
            state.getActiveTabId(),
            UUID.randomUUID().toString(),
        )
        openTab(project, tabId)
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }

    companion object {
        /**
         * Open (or focus) a Claude Code editor tab identified by [tabId].
         * [tabId] is a tab identifier, NOT a Claude conversation session ID.
         * [initialPath] is the WebView path (conversation) the tab should land on.
         * [initialTitle] is the cached tab label to show before the WebView mounts
         * and reports a fresh title (used by the restart restore path).
         */
        fun openTab(
            project: Project,
            tabId: String,
            initialPath: String? = null,
            initialTitle: String? = null
        ) {
            // Host router: pick the current host and delegate. Every open entry
            // point funnels here, so this one line makes them all host-aware.
            ChatHostRouter.currentHost(project).openOrFocus(project, tabId, initialPath, initialTitle)
        }
    }
}
