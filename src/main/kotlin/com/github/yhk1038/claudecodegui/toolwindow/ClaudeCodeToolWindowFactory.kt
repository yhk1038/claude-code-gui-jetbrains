package com.github.yhk1038.claudecodegui.toolwindow

import com.github.yhk1038.claudecodegui.editor.ClaudeCodeVirtualFile
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.ui.content.ContentFactory
import java.util.UUID
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants
import java.awt.BorderLayout

class ClaudeCodeToolWindowFactory : ToolWindowFactory, DumbAware {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        // 빈 패널 추가 (Tool Window 구조상 필요)
        val panel = JPanel(BorderLayout())
        panel.add(JLabel("Loading...", SwingConstants.CENTER), BorderLayout.CENTER)
        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)

        // Tool Window가 활성화될 때마다 에디터 탭 열기/포커스
        val connection = project.messageBus.connect(toolWindow.disposable)
        connection.subscribe(ToolWindowManagerListener.TOPIC, object : ToolWindowManagerListener {
            override fun stateChanged(toolWindowManager: ToolWindowManager) {
                val tw = toolWindowManager.getToolWindow("Claude Code")
                if (tw != null && tw.isVisible) {
                    focusOrOpenClaudeCodeTab(project)
                    tw.hide()
                }
            }
        })

        // 첫 번째 열기에서도 에디터 탭 열기
        focusOrOpenClaudeCodeTab(project)
        toolWindow.hide()
    }

    private fun focusOrOpenClaudeCodeTab(project: Project) {
        val fileEditorManager = FileEditorManager.getInstance(project)

        // 이미 열린 Claude Code 탭 찾기
        val openClaudeFiles = fileEditorManager.openFiles.filterIsInstance<ClaudeCodeVirtualFile>()

        if (openClaudeFiles.isNotEmpty()) {
            // 마지막으로 선택된 Claude Code 탭으로 포커스
            val lastSelected = fileEditorManager.selectedFiles
                .filterIsInstance<ClaudeCodeVirtualFile>()
                .firstOrNull()

            val fileToFocus = lastSelected ?: openClaudeFiles.last()
            fileEditorManager.openFile(fileToFocus, true)
        } else {
            // 열린 탭이 없으면 새 세션 열기
            val newFile = ClaudeCodeVirtualFile.getOrCreate(project, UUID.randomUUID().toString())
            fileEditorManager.openFile(newFile, true)
        }
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}
