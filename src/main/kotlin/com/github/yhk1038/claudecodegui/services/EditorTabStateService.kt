package com.github.yhk1038.claudecodegui.services

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.project.Project

@State(
    name = "ClaudeCodeEditorTabs",
    storages = [Storage("claudeCodeEditorTabs.xml")]
)
@Service(Service.Level.PROJECT)
class EditorTabStateService : PersistentStateComponent<EditorTabStateService.EditorTabState> {

    data class EditorTabState(
        var openSessionIds: MutableList<String> = mutableListOf(),
        var activeSessionId: String? = null
    )

    private var state = EditorTabState()

    override fun getState(): EditorTabState = state

    override fun loadState(state: EditorTabState) {
        this.state = state
    }

    fun addTab(sessionId: String) {
        if (sessionId !in state.openSessionIds) {
            state.openSessionIds.add(sessionId)
        }
        state.activeSessionId = sessionId
    }

    fun removeTab(sessionId: String) {
        state.openSessionIds.remove(sessionId)
        if (state.activeSessionId == sessionId) {
            state.activeSessionId = state.openSessionIds.lastOrNull()
        }
    }

    fun getOpenSessionIds(): List<String> = state.openSessionIds.toList()

    fun getActiveSessionId(): String? = state.activeSessionId

    companion object {
        fun getInstance(project: Project): EditorTabStateService =
            project.getService(EditorTabStateService::class.java)
    }
}
