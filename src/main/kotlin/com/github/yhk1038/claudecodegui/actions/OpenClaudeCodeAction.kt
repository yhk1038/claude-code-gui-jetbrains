package com.github.yhk1038.claudecodegui.actions

import com.github.yhk1038.claudecodegui.editor.ClaudeCodeVirtualFile
import com.github.yhk1038.claudecodegui.services.EditorTabStateService
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import java.util.UUID

class OpenClaudeCodeAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        // 새 세션 열기 (UUID 생성)
        openSession(project, UUID.randomUUID().toString())
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }

    companion object {
        fun openSession(project: Project, sessionId: String, initialPath: String? = null) {
            val fileEditorManager = FileEditorManager.getInstance(project)
            val virtualFile = ClaudeCodeVirtualFile.getOrCreate(project, sessionId, initialPath)

            // 이미 열린 세션이면 포커스만 이동, 아니면 새로 열기
            fileEditorManager.openFile(virtualFile, true)

            // 탭 상태 영속화
            EditorTabStateService.getInstance(project).addTab(sessionId)
        }
    }
}
