package com.github.yhk1038.claudecodegui.toolwindow

import com.github.yhk1038.claudecodegui.actions.OpenClaudeCodeAction
import com.github.yhk1038.claudecodegui.hosting.HostMode
import com.github.yhk1038.claudecodegui.hosting.ToolWindowHost
import com.github.yhk1038.claudecodegui.settings.SettingsManager
import com.github.yhk1038.claudecodegui.toolwindow.realization.ReentrancyGate
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.DumbService
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.ui.content.ContentFactory
import com.intellij.util.ui.UIUtil
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants
import java.awt.BorderLayout

class ClaudeCodeToolWindowFactory : ToolWindowFactory, DumbAware {

    private val logger = Logger.getInstance(ClaudeCodeToolWindowFactory::class.java)

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        // TOOL_WINDOW mode: the tool window IS the chat host. Hydrate it (restore
        // persisted sessions, or open one fresh session) and let it own its tabs.
        // No "button trick", no auto-hide.
        if (SettingsManager.getInstance().getHostMode() == HostMode.TOOL_WINDOW) {
            ToolWindowHost.getInstance(project).hydrate(toolWindow)
            return
        }

        // EDITOR_TAB mode (default): the tool window is just a stripe button that
        // opens an editor tab and hides itself again.
        // Empty panel required by the ToolWindow content structure. Match the IDE
        // theme background so the brief flash during the open-tab "button" trick
        // does not expose the LAF default white on dark themes.
        val label = JLabel("Loading...", SwingConstants.CENTER)
        val panel = JPanel(BorderLayout())
        panel.background = UIUtil.getPanelBackground()
        panel.add(label, BorderLayout.CENTER)
        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)

        // Reentrancy guard shared by both open paths below. A single stripe-icon
        // click flips the ToolWindow to visible, during which `stateChanged` may
        // fire several times before the deferred `hide()` runs. Without a guard,
        // each fire would open another tab. The gate ensures exactly one open per
        // visible cycle and resets when the ToolWindow returns to invisible so the
        // next click opens again. All access happens on the EDT (invokeLater).
        val openGate = ReentrancyGate()

        // Open a new tab each time the stripe icon is clicked (ToolWindow becomes visible)
        val connection = project.messageBus.connect(toolWindow.disposable)
        connection.subscribe(ToolWindowManagerListener.TOPIC, object : ToolWindowManagerListener {
            override fun stateChanged(toolWindowManager: ToolWindowManager) {
                val tw = toolWindowManager.getToolWindow("Claude Code")
                if (tw == null) return
                if (tw.isVisible) {
                    ApplicationManager.getApplication().invokeLater {
                        if (!tw.isVisible) return@invokeLater
                        if (openGate.enter()) {
                            openNewTab(project, ::openTab)
                        }
                        tw.hide()
                    }
                } else {
                    // Back to invisible: re-arm the gate for the next click.
                    openGate.reset()
                }
            }
        })

        // Open a new tab immediately — retry after indexing finishes if the editor is not ready
        ApplicationManager.getApplication().invokeLater {
            if (!openGate.enter()) {
                toolWindow.hide()
                return@invokeLater
            }
            try {
                openNewTab(project, ::openTab)
                toolWindow.hide()
            } catch (e: Exception) {
                logger.info("Editor not ready yet, will retry after indexing", e)
                label.text = "Waiting for project initialization..."
                DumbService.getInstance(project).runWhenSmart {
                    ApplicationManager.getApplication().invokeLater {
                        openNewTab(project, ::openTab)
                        toolWindow.hide()
                    }
                }
            }
        }
    }

    /**
     * Delegates to [OpenClaudeCodeAction.openTab] and wraps failures with a
     * 500 ms retry — preserving the same safety net that existed in the old
     * `focusOrOpenClaudeCodeTab` path.
     */
    private fun openTab(project: Project, tabId: String) {
        try {
            OpenClaudeCodeAction.openTab(project, tabId)
        } catch (e: Exception) {
            logger.warn("Failed to open Claude Code tab, retrying in 500ms", e)
            retryOpenTab(project, tabId)
        }
    }

    private fun retryOpenTab(project: Project, tabId: String) {
        java.util.Timer().schedule(object : java.util.TimerTask() {
            override fun run() {
                ApplicationManager.getApplication().invokeLater {
                    try {
                        OpenClaudeCodeAction.openTab(project, tabId)
                    } catch (e: Exception) {
                        logger.warn("Retry also failed to open Claude Code tab", e)
                    }
                }
            }
        }, 500L)
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}
