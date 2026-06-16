package com.github.yhk1038.claudecodegui.hosting

import com.github.yhk1038.claudecodegui.editor.ClaudeCodeVirtualFile
import com.github.yhk1038.claudecodegui.services.EditorTabStateService
import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodePanel
import com.intellij.openapi.application.ApplicationManager
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
import java.util.UUID

/**
 * Hosts chat sessions in the **Claude Code** tool window's content tabs.
 *
 * This is the Phase-4 home for the chat hosting that the abandoned PR #30 put in
 * `ClaudeCodeToolWindowSessionManager`, re-expressed through [ChatHost] and
 * adapted to the current architecture:
 *
 *  - tab-id vocabulary (not "session id"),
 *  - shared [EditorTabStateService] for persistence (no second store),
 *  - teardown is just `Disposer.dispose(panel)` — `ClaudeCodePanel.dispose()`
 *    already self-cleans (releaseRef → removeTab + state/virtual-file cleanup),
 *  - closing the last tab leaves an **empty** tool window (no auto-new-session).
 */
@Service(Service.Level.PROJECT)
class ToolWindowHost(private val project: Project) : ChatHost {

    private val logger = Logger.getInstance(ToolWindowHost::class.java)
    private var closeListenerInstalled = false

    override fun openOrFocus(project: Project, tabId: String, initialPath: String?, initialTitle: String?) {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID) ?: run {
            logger.warn("Tool window '$TOOL_WINDOW_ID' not found")
            return
        }
        installCloseListener(toolWindow)

        val existing = findContent(toolWindow, tabId)
        if (existing != null) {
            toolWindow.contentManager.setSelectedContent(existing)
            EditorTabStateService.getInstance(project).addTab(tabId)
            toolWindow.activate(null)
            return
        }

        val content = createSessionContent(toolWindow, tabId, initialPath, initialTitle)
        toolWindow.contentManager.addContent(content)
        toolWindow.contentManager.setSelectedContent(content)
        toolWindow.activate(null)
    }

    override fun restorePersistedSessions(project: Project) {
        // No-op on purpose. Tool-window content is created lazily by the factory's
        // [hydrate] the first time the UI is built. The IDE re-opens the tool
        // window (and thus calls the factory) on restart when it was open at
        // shutdown, so restore happens there — keeping editor-tab restore and
        // tool-window hydrate mutually exclusive (no double restore).
    }

    /**
     * Called by `ClaudeCodeToolWindowFactory` the first time the tool-window UI
     * is built (TOOL_WINDOW mode). Restores persisted sessions, or opens one
     * fresh session when nothing was persisted.
     */
    fun hydrate(toolWindow: ToolWindow) {
        installCloseListener(toolWindow)
        if (toolWindow.contentManager.contentCount > 0) return

        val state = EditorTabStateService.getInstance(project)
        when (val plan = ChatHostRouter.planHydrate(state.getOpenTabIds(), state.getActiveTabId())) {
            is ChatHostRouter.HydratePlan.FreshSession ->
                openOrFocus(project, UUID.randomUUID().toString(), initialPath = null, initialTitle = null)

            is ChatHostRouter.HydratePlan.Restore ->
                for (tabId in plan.order) {
                    openOrFocus(project, tabId, state.getRestorePath(tabId), state.getTitle(tabId))
                }
        }
    }

    private fun createSessionContent(
        toolWindow: ToolWindow,
        tabId: String,
        initialPath: String?,
        initialTitle: String?,
    ): Content {
        val state = EditorTabStateService.getInstance(project)
        state.addTab(tabId)

        val virtualFile = ClaudeCodeVirtualFile.getOrCreate(project, tabId, initialPath, initialTitle)
        val panel = ClaudeCodePanel(project, tabId, virtualFile.currentPath ?: virtualFile.initialPath)

        // Mirror the editor-tab callbacks (ClaudeCodeFileEditor) so the persisted
        // title/path stay in sync and the content label tracks the WebView title.
        panel.onTitleChanged = { title ->
            virtualFile.setDisplayName(title)
            state.updateTitle(tabId, title)
            ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID)?.let { tw ->
                findContent(tw, tabId)?.displayName = virtualFile.presentableName
            }
        }
        panel.onPathChanged = { path ->
            virtualFile.currentPath = path
            state.updatePath(tabId, path)
        }

        return ContentFactory.getInstance().createContent(panel, virtualFile.presentableName, false).apply {
            isCloseable = true
            putUserData(TAB_ID_KEY, tabId)
        }
    }

    private fun installCloseListener(toolWindow: ToolWindow) {
        if (closeListenerInstalled) return
        closeListenerInstalled = true

        toolWindow.contentManager.addContentManagerListener(object : ContentManagerListener {
            override fun selectionChanged(event: ContentManagerEvent) {
                val tabId = event.content.getUserData(TAB_ID_KEY) ?: return
                // Track the active tab so restart restore re-focuses the right one.
                EditorTabStateService.getInstance(project).addTab(tabId)
            }

            override fun contentRemoved(event: ContentManagerEvent) {
                val content = event.content
                content.getUserData(TAB_ID_KEY) ?: return
                val panel = content.component as? ClaudeCodePanel ?: return
                // Disposing the panel self-cleans: releaseRef (grace-period, harmless
                // here) → removeTab + EditorTabStateService.removeTab + virtual-file
                // cleanup. Closing the last tab leaves the tool window empty by design.
                ApplicationManager.getApplication().invokeLater {
                    if (!Disposer.isDisposed(panel)) {
                        Disposer.dispose(panel)
                    }
                }
            }
        })
    }

    private fun findContent(toolWindow: ToolWindow, tabId: String): Content? {
        val contentManager = toolWindow.contentManager
        for (i in 0 until contentManager.contentCount) {
            val content = contentManager.getContent(i) ?: continue
            if (content.getUserData(TAB_ID_KEY) == tabId) return content
        }
        return null
    }

    companion object {
        const val TOOL_WINDOW_ID = "Claude Code"
        private val TAB_ID_KEY = Key.create<String>("ClaudeCode.ToolWindow.TabId")

        fun getInstance(project: Project): ToolWindowHost =
            project.getService(ToolWindowHost::class.java)
    }
}
