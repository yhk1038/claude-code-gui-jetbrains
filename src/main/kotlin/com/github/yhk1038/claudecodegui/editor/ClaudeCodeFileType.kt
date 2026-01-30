package com.github.yhk1038.claudecodegui.editor

import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.util.IconLoader
import javax.swing.Icon

object ClaudeCodeFileType : FileType {
    private val ICON: Icon = IconLoader.getIcon("/icons/claudeCode.svg", ClaudeCodeFileType::class.java)

    override fun getName(): String = "Claude Code"
    override fun getDescription(): String = "Claude Code Session"
    override fun getDefaultExtension(): String = "claude"
    override fun getIcon(): Icon = ICON
    override fun isBinary(): Boolean = false
    override fun isReadOnly(): Boolean = true
}
