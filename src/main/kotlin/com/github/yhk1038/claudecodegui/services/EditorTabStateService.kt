package com.github.yhk1038.claudecodegui.services

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.project.Project

/**
 * Persists which Claude Code editor **tabs** are open so they can be restored
 * after an IDE restart.
 *
 * Terminology — this service deals exclusively with **tab IDs** (the per-tab
 * UUID minted when an editor tab is opened), NOT Claude Code conversation
 * session IDs. The only place a conversation appears is the stored *path*
 * value (a WebView URL like `/sessions/{conversationId}/...`), which is opaque
 * to this service.
 *
 * NOTE: the persisted [EditorTabState] field names (`openSessionIds`,
 * `activeSessionId`, `sessionPaths`) are kept as-is on purpose — they are the
 * on-disk XML schema (`claudeCodeEditorTabs.xml`) and renaming them would break
 * restore for existing users. Their *values* are tab IDs; the public API below
 * uses the correct `tabId` vocabulary.
 */
@State(
    name = "ClaudeCodeEditorTabs",
    storages = [Storage("claudeCodeEditorTabs.xml")]
)
@Service(Service.Level.PROJECT)
class EditorTabStateService : PersistentStateComponent<EditorTabStateService.EditorTabState> {

    data class EditorTabState(
        // Persisted XML field names retained for backward compatibility.
        // Values are TAB IDs (not conversation session IDs).
        var openSessionIds: MutableList<String> = mutableListOf(),
        var activeSessionId: String? = null,
        // Last WebView path per tab, so a restored tab lands on the conversation
        // the user was actually viewing at shutdown rather than the tab's own page.
        var sessionPaths: MutableMap<String, String> = mutableMapOf(),
        // Last WebView-reported title per tab. Used to show a sensible tab label
        // immediately after restart, before the lazy FileEditor mounts and the
        // WebView reconnects to push a fresh title.
        var sessionTitles: MutableMap<String, String> = mutableMapOf()
    )

    private var state = EditorTabState()

    override fun getState(): EditorTabState = state

    override fun loadState(state: EditorTabState) {
        this.state = state
    }

    fun addTab(tabId: String) {
        if (tabId !in state.openSessionIds) {
            state.openSessionIds.add(tabId)
        }
        state.activeSessionId = tabId
    }

    fun removeTab(tabId: String) {
        state.openSessionIds.remove(tabId)
        state.sessionPaths.remove(tabId)
        state.sessionTitles.remove(tabId)
        if (state.activeSessionId == tabId) {
            state.activeSessionId = state.openSessionIds.lastOrNull()
        }
    }

    fun updatePath(tabId: String, path: String) {
        state.sessionPaths[tabId] = path
    }

    fun getPath(tabId: String): String? = state.sessionPaths[tabId]

    fun updateTitle(tabId: String, title: String) {
        state.sessionTitles[tabId] = title
    }

    fun getTitle(tabId: String): String? = state.sessionTitles[tabId]

    /**
     * Path to restore a tab to: the last-viewed WebView path if known.
     *
     * Fallback `/sessions/$tabId` is legacy — it formats the tab ID as if it
     * were a conversation path. In practice a real path is almost always stored
     * (via updatePath on URL change), and for a brand-new tab the WebView simply
     * redirects an unknown session to `/sessions/new`. Behavior preserved.
     */
    fun getRestorePath(tabId: String): String =
        state.sessionPaths[tabId] ?: "/sessions/$tabId"

    fun getOpenTabIds(): List<String> = state.openSessionIds.toList()

    fun getActiveTabId(): String? = state.activeSessionId

    companion object {
        fun getInstance(project: Project): EditorTabStateService =
            project.getService(EditorTabStateService::class.java)
    }
}
