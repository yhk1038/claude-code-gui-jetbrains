package com.github.yhk1038.claudecodegui.editor

import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.FileEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile

class ClaudeCodeEditorProvider : FileEditorProvider, DumbAware {

    override fun accept(project: Project, file: VirtualFile): Boolean {
        return file is ClaudeCodeVirtualFile
    }

    override fun createEditor(project: Project, file: VirtualFile): FileEditor {
        return ClaudeCodeFileEditor(project, file as ClaudeCodeVirtualFile)
    }

    override fun getEditorTypeId(): String = "ClaudeCodeEditor"

    override fun getPolicy(): FileEditorPolicy = FileEditorPolicy.HIDE_DEFAULT_EDITOR
}
