package com.github.yhk1038.claudecodegui.toolwindow

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.DumbService
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener

/**
 * Registers the **Claude Code** tool window on the right edge and hosts chat UI here
 * (not in editor tabs), matching Copilot / built-in AI sidebar UX.
 */
class ClaudeCodeToolWindowFactory : ToolWindowFactory, DumbAware {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val sessionManager = ClaudeCodeToolWindowSessionManager.getInstance(project)
        val hydrate = Runnable {
            if (!toolWindow.isDisposed) {
                sessionManager.hydrateOnFirstToolWindowOpen(toolWindow)
            }
        }
        val connection = project.messageBus.connect(toolWindow.disposable)
        connection.subscribe(ToolWindowManagerListener.TOPIC, object : ToolWindowManagerListener {
            override fun stateChanged(toolWindowManager: ToolWindowManager) {
                val currentToolWindow = toolWindowManager.getToolWindow(ClaudeCodeToolWindowSessionManager.TOOL_WINDOW_ID)
                    ?: return
                if (currentToolWindow.isVisible && currentToolWindow.contentManager.contentCount == 0) {
                    ApplicationManager.getApplication().invokeLater {
                        if (!currentToolWindow.isDisposed) {
                            sessionManager.hydrateOnFirstToolWindowOpen(currentToolWindow)
                        }
                    }
                }
            }
        })
        if (DumbService.isDumb(project)) {
            DumbService.getInstance(project).runWhenSmart {
                ApplicationManager.getApplication().invokeLater(hydrate)
            }
        } else {
            ApplicationManager.getApplication().invokeLater(hydrate)
        }
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}
