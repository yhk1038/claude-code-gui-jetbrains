package com.github.yhk1038.claudecodegui.editor

import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodePanel
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorLocation
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

    private val panel: ClaudeCodePanel = ClaudeCodePanel(project, virtualFile.sessionId)

    init {
        Disposer.register(this, panel)

        // WebView의 title 변경을 VirtualFile에 전달
        panel.onTitleChanged = { title ->
            virtualFile.setDisplayName(title)
        }
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
        ClaudeCodeVirtualFile.removeSession(project, virtualFile.sessionId)
        // panel은 Disposer에 의해 자동으로 dispose됨
    }
}
