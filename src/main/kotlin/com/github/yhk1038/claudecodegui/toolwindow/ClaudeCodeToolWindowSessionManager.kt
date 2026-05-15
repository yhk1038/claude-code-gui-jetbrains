package com.github.yhk1038.claudecodegui.toolwindow

import com.github.yhk1038.claudecodegui.editor.ClaudeCodeVirtualFile
import com.github.yhk1038.claudecodegui.editor.TabBadge
import com.github.yhk1038.claudecodegui.services.ClaudeCodeBrowserService
import com.github.yhk1038.claudecodegui.services.EditorTabStateService
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.Key
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.content.Content
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.content.ContentManagerEvent
import com.intellij.ui.content.ContentManagerListener
import javax.swing.SwingUtilities

/**
 * Hosts Claude chat [ClaudeCodePanel] instances in the **Claude Code** tool window (sidebar),
 * instead of editor tabs, so the main code editor keeps focus (Copilot-style UX).
 */
@Service(Service.Level.PROJECT)
class ClaudeCodeToolWindowSessionManager(private val project: Project) {

    private val logger = Logger.getInstance(ClaudeCodeToolWindowSessionManager::class.java)
    private var closeListenerInstalled = false

    companion object {
        const val TOOL_WINDOW_ID = "Claude Code"
        private val SESSION_ID_KEY = Key.create<String>("ClaudeCode.SessionId")

        fun getInstance(project: Project): ClaudeCodeToolWindowSessionManager =
            project.getService(ClaudeCodeToolWindowSessionManager::class.java)
    }

    fun installContentCloseListener(toolWindow: ToolWindow) {
        if (closeListenerInstalled) return
        closeListenerInstalled = true
        toolWindow.contentManager.addContentManagerListener(object : ContentManagerListener {
            override fun contentAdded(event: ContentManagerEvent) {}
            override fun contentRemoveQuery(event: ContentManagerEvent) {}

            override fun selectionChanged(event: ContentManagerEvent) {
                val content = event.content ?: return
                val sid = content.getUserData(SESSION_ID_KEY) ?: return
                EditorTabStateService.getInstance(project).addTab(sid)
                val vf = ClaudeCodeVirtualFile.getOrCreate(project, sid, null)
                if (vf.badgeState == TabBadge.UNREAD) {
                    vf.setBadge(TabBadge.NONE)
                }
            }

            override fun contentRemoved(event: ContentManagerEvent) {
                val content = event.content
                val sessionId = content.getUserData(SESSION_ID_KEY) ?: return
                val panel = content.component as? ClaudeCodePanel ?: return
                SwingUtilities.invokeLater {
                    if (!Disposer.isDisposed(panel)) {
                        Disposer.dispose(panel)
                    }
                    ClaudeCodeVirtualFile.removeSession(project, sessionId)
                    EditorTabStateService.getInstance(project).removeTab(sessionId)
                    ClaudeCodeBrowserService.getInstance(project).release(sessionId)
                    logger.info("Claude Code session closed from tool window: $sessionId")
                    if (toolWindow.contentManager.contentCount == 0 && toolWindow.isVisible) {
                        openSession(
                            sessionId = java.util.UUID.randomUUID().toString(),
                            initialPath = null,
                            activateToolWindow = false,
                        )
                    }
                }
            }
        })
    }

    /**
     * Opens or focuses a chat session in the tool window.
     *
     * @param activateToolWindow If true, shows and activates the **Claude Code** tool window.
     */
    fun openSession(sessionId: String, initialPath: String? = null, activateToolWindow: Boolean = true) {
        val tw = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID) ?: run {
            logger.warn("Tool window '$TOOL_WINDOW_ID' not found")
            return
        }
        installContentCloseListener(tw)

        val existing = findContentBySessionId(tw, sessionId)
        if (existing != null) {
            tw.contentManager.setSelectedContent(existing)
            EditorTabStateService.getInstance(project).addTab(sessionId)
            if (activateToolWindow) {
                tw.activate(null)
            }
            return
        }

        EditorTabStateService.getInstance(project).addTab(sessionId)
        val virtualFile = ClaudeCodeVirtualFile.getOrCreate(project, sessionId, initialPath)

        var wasStreaming = false
        val panel = ClaudeCodePanel(project, sessionId, virtualFile.currentPath ?: virtualFile.initialPath)

        panel.onTitleChanged = { title ->
            virtualFile.setDisplayName(title)
            val twRef = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID)
            if (twRef != null) {
                findContentBySessionId(twRef, sessionId)?.let { c ->
                    c.displayName = virtualFile.presentableName
                }
            }
        }
        panel.onPathChanged = { path -> virtualFile.currentPath = path }
        panel.onStreamingStateChanged = { isStreaming ->
            if (!isStreaming && wasStreaming) {
                val twRef = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID)
                val selected = twRef?.contentManager?.selectedContent
                if (selected?.getUserData(SESSION_ID_KEY) != sessionId) {
                    virtualFile.setBadge(TabBadge.UNREAD)
                }
            }
            wasStreaming = isStreaming
        }

        val content = ContentFactory.getInstance().createContent(
            panel,
            virtualFile.presentableName,
            false,
        )
        content.isCloseable = true
        content.putUserData(SESSION_ID_KEY, sessionId)

        tw.contentManager.addContent(content)
        tw.contentManager.setSelectedContent(content)

        if (activateToolWindow) {
            tw.activate(null)
        }
    }

    fun hasOpenSessions(): Boolean {
        val tw = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID) ?: return false
        return tw.contentManager.contentCount > 0
    }

    fun isToolWindowActive(): Boolean {
        val tw = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID) ?: return false
        return tw.isActive
    }

    /**
     * Called from [ClaudeCodeToolWindowFactory] the first time the tool window UI is created.
     * Restores persisted sessions, or creates a default chat when there is no saved state.
     */
    fun hydrateOnFirstToolWindowOpen(toolWindow: ToolWindow) {
        installContentCloseListener(toolWindow)
        if (toolWindow.contentManager.contentCount > 0) {
            return
        }
        val state = EditorTabStateService.getInstance(project)
        val ids = state.getOpenSessionIds()
        if (ids.isEmpty()) {
            openSession(
                sessionId = java.util.UUID.randomUUID().toString(),
                initialPath = null,
                activateToolWindow = false,
            )
            return
        }
        val active = state.getActiveSessionId()
        for (sessionId in ids) {
            if (sessionId != active) {
                openSession(sessionId, "/sessions/$sessionId", activateToolWindow = false)
            }
        }
        if (active != null && active in ids) {
            openSession(active, "/sessions/$active", activateToolWindow = false)
        }
    }

    private fun findContentBySessionId(toolWindow: ToolWindow, sessionId: String): Content? {
        for (i in 0 until toolWindow.contentManager.contentCount) {
            val c = toolWindow.contentManager.getContent(i) ?: continue
            if (c.getUserData(SESSION_ID_KEY) == sessionId) return c
        }
        return null
    }
}
