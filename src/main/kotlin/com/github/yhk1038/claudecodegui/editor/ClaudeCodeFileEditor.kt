package com.github.yhk1038.claudecodegui.editor

import com.github.yhk1038.claudecodegui.services.EditorTabStateService
import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodePanel
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorLocation
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.UserDataHolderBase
import com.intellij.openapi.vfs.VirtualFile
import java.beans.PropertyChangeListener
import javax.swing.JComponent

class ClaudeCodeFileEditor(
    private val project: Project,
    private val virtualFile: ClaudeCodeVirtualFile
) : UserDataHolderBase(), FileEditor {

    private val panel: ClaudeCodePanel = ClaudeCodePanel(
        project,
        virtualFile.sessionId,
        virtualFile.currentPath ?: virtualFile.initialPath
    )

    @Volatile
    private var wasStreaming: Boolean = false

    init {
        Disposer.register(this, panel)

        // WebView의 title 변경을 VirtualFile에 전달
        panel.onTitleChanged = { title ->
            virtualFile.setDisplayName(title)
        }

        // WebView의 URL 변경을 VirtualFile에 전달 (탭 이동/분할 시 복원용)
        // 그리고 IDE 재시작 후에도 복원되도록 영속 저장소에도 반영.
        panel.onPathChanged = { path ->
            virtualFile.currentPath = path
            EditorTabStateService.getInstance(project).updatePath(virtualFile.sessionId, path)
        }

        // Streaming state change: show unread badge when streaming ends on inactive tab
        panel.onStreamingStateChanged = { isStreaming ->
            if (!isStreaming && wasStreaming) {
                if (!isTabActive()) {
                    virtualFile.setBadge(TabBadge.UNREAD)
                }
            }
            wasStreaming = isStreaming
        }
    }

    private fun isTabActive(): Boolean {
        val fem = FileEditorManager.getInstance(project)
        return fem.selectedEditors.any { it === this }
    }

    override fun getComponent(): JComponent = panel

    override fun getPreferredFocusedComponent(): JComponent = panel

    override fun getName(): String = virtualFile.presentableName

    override fun getFile(): VirtualFile = virtualFile

    override fun isValid(): Boolean = true

    override fun isModified(): Boolean = false

    override fun setState(state: FileEditorState) {}

    override fun addPropertyChangeListener(listener: PropertyChangeListener) {}

    override fun removePropertyChangeListener(listener: PropertyChangeListener) {}

    override fun getCurrentLocation(): FileEditorLocation? = null

    override fun dispose() {
        // NOTE: removeSession/removeTab은 여기서 호출하지 않음.
        // 탭 이동/분할 시에도 dispose()가 호출되기 때문에,
        // 실제 탭 닫기는 ClaudeCodeEditorManagerListener.fileClosed()에서 처리.
        // panel은 Disposer에 의해 자동으로 dispose됨.
    }
}
