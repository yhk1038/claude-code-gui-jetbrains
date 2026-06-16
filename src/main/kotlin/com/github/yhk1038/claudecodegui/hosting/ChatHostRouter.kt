package com.github.yhk1038.claudecodegui.hosting

import com.github.yhk1038.claudecodegui.settings.SettingsManager
import com.intellij.openapi.project.Project

/**
 * Routes "open a chat session" requests to the currently selected [ChatHost].
 *
 * Every entry point (the "+" button RPC, settings RPC, the popup, Cmd+N,
 * Ctrl+Shift+C, restart restore) funnels through `OpenClaudeCodeAction.openTab`,
 * which now asks this router for the current host instead of opening an editor
 * tab directly. That makes this object the single place that becomes host-mode
 * aware — the WebView needs zero changes.
 *
 * The two decisions below are kept free of IDE API calls so they can be
 * unit-tested (see `ChatHostRouterTest`).
 */
object ChatHostRouter {

    /**
     * Pick the host for [mode].
     *
     * [toolWindowHost] is nullable on purpose: the tool-window host does not
     * exist until Phase 4, so selecting [HostMode.TOOL_WINDOW] before then must
     * degrade safely to the editor-tab host rather than fail.
     */
    fun selectHost(mode: HostMode, editorTabHost: ChatHost, toolWindowHost: ChatHost?): ChatHost =
        when (mode) {
            HostMode.EDITOR_TAB -> editorTabHost
            HostMode.TOOL_WINDOW -> toolWindowHost ?: editorTabHost
        }

    /**
     * The order to restore tabs in after a restart: inactive tabs first (in
     * their original order), the active tab last so it ends up focused.
     *
     * An [activeTabId] that is null — or not present in [openTabIds] — simply
     * restores every tab in its original order. A list containing only the
     * active tab restores it exactly once.
     */
    fun planRestoreOrder(openTabIds: List<String>, activeTabId: String?): List<String> {
        val inactive = openTabIds.filter { it != activeTabId }
        val active = activeTabId?.takeIf { it in openTabIds }
        return if (active != null) inactive + active else inactive
    }

    /**
     * The host to use right now: read `hostMode` from settings and resolve it.
     *
     * The tool-window host does not exist until Phase 4, so [selectHost] degrades
     * TOOL_WINDOW to the editor-tab host for now — the default `editor-tab` keeps
     * behaviour unchanged regardless. The [project] parameter is part of the
     * contract (multi-project routing reads the target project here).
     */
    @Suppress("UNUSED_PARAMETER")
    fun currentHost(project: Project): ChatHost =
        selectHost(SettingsManager.getInstance().getHostMode(), EditorTabHost, toolWindowHost = null)
}
