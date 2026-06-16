package com.github.yhk1038.claudecodegui.toolwindow

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

/**
 * Left tool window that hosts the session list panel.
 *
 * Unlike [ClaudeCodeToolWindowFactory] — a right-side trigger that opens an
 * editor tab and immediately hides itself — this factory hosts real content: a
 * [ClaudeCodePanel] pointed at the `/session-panel` WebView route. Reusing
 * ClaudeCodePanel means the panel registers its own RPC handler and backend
 * connection, so selecting a session there opens it in a fresh editor tab via
 * the OPEN_SESSION RPC even when no editor tab is currently open.
 */
class ClaudeSessionsToolWindowFactory : ToolWindowFactory, DumbAware {

    private val logger = Logger.getInstance(ClaudeSessionsToolWindowFactory::class.java)

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = ClaudeCodePanel(project, SESSION_PANEL_TAB_ID, SESSION_PANEL_PATH)
        Disposer.register(toolWindow.disposable, panel)

        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
        logger.info("Claude Sessions tool window content created")
    }

    override fun shouldBeAvailable(project: Project): Boolean = true

    companion object {
        // Fixed tabId so the pooled JCEF browser is reused across reopen, and is
        // namespaced apart from the UUID-keyed editor tabs.
        const val SESSION_PANEL_TAB_ID = "session-panel"
        private const val SESSION_PANEL_PATH = "/session-panel"
    }
}
