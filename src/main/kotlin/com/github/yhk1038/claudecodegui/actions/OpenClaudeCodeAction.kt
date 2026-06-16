package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.hosting.ChatHostRouter
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import java.util.UUID

class OpenClaudeCodeAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        // 새 탭 열기 (탭 ID로 UUID 생성)
        openTab(project, UUID.randomUUID().toString())
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
