package com.github.yhk1038.claudecodegui.startup

import com.github.yhk1038.claudecodegui.hosting.ChatHostRouter
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

/**
 * Restores persisted Claude Code chat sessions after an IDE restart.
 *
 * Host-agnostic: it asks the [ChatHostRouter] for the current host and lets it
 * restore its own sessions. Because the persisted state
 * ([com.github.yhk1038.claudecodegui.services.EditorTabStateService]) is shared
 * across hosts, switching `hostMode` and restarting naturally restores the same
 * session list into whichever host is now current.
 */
class ChatHostRestoreActivity : ProjectActivity {

    override suspend fun execute(project: Project) {
        ChatHostRouter.currentHost(project).restorePersistedSessions(project)
    }
}
