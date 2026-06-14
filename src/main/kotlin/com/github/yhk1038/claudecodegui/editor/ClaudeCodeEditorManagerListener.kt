package com.github.yhk1038.claudecodegui.editor

import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener

/**
 * Clears the unread badge when a Claude Code tab becomes selected.
 *
 * Session/browser cleanup on tab close is intentionally NOT done here.
 * JetBrains fires `fileClosed` on BOTH a real tab close AND a tab move/split,
 * so releasing the pooled JCEF browser from `fileClosed` destroyed it during a
 * move and forced a full reload (issue #29). Cleanup now lives in
 * [com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodePanel.dispose] via
 * [com.github.yhk1038.claudecodegui.services.ClaudeCodeBrowserService.releaseRef],
 * which distinguishes a real close from a move/split by reference counting.
 */
class ClaudeCodeEditorManagerListener : FileEditorManagerListener {

    override fun selectionChanged(event: FileEditorManagerEvent) {
        val file = event.newFile
        if (file is ClaudeCodeVirtualFile && file.badgeState == TabBadge.UNREAD) {
            file.setBadge(TabBadge.NONE, event.manager.project)
        }
    }
}
