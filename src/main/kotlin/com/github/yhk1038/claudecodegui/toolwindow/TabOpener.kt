package com.github.yhk1038.claudecodegui.toolwindow

import java.util.UUID

/**
 * Always opens a new Claude Code tab by generating a fresh UUID and delegating
 * to [tabOpener].
 *
 * This function contains no IDE API calls so it can be tested as a plain unit
 * test. The side-effect of actually opening the tab is injected via [tabOpener].
 *
 * @param project  The IDE project (or any sentinel value in tests).
 * @param tabOpener  Called with (project, tabId). In production, this is
 *   `OpenClaudeCodeAction::openTab`. In tests, a recording spy.
 */
fun <P> openNewTab(project: P, tabOpener: (P, String) -> Unit) {
    val tabId = UUID.randomUUID().toString()
    tabOpener(project, tabId)
}
