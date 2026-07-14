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
     * Which tab id the "Open Claude Code" action should target.
     *
     * "Open" means *reveal the chat*, not *always spawn a new one* — spawning a
     * fresh tab is the separate "New Tab" action's job (Cmd/Ctrl+N). So when any
     * chat tab is already open this returns the tab to focus: the active one, or
     * the most recently opened tab as a fallback when the persisted [activeTabId]
     * is null or stale (not in [openTabIds]). Only when nothing is open does it
     * return [newTabId] to mint a brand-new session.
     *
     * Without this, every invocation passed a fresh random tab id, so
     * `openOrFocus` never matched an existing tab and a new (empty) tab piled up
     * on every keypress (issue #180).
     */
    fun planOpen(openTabIds: List<String>, activeTabId: String?, newTabId: String): String {
        if (openTabIds.isEmpty()) return newTabId
        return activeTabId?.takeIf { it in openTabIds } ?: openTabIds.last()
    }

    /**
     * What a host should do when its UI is first built (e.g. the tool window is
     * opened for the first time):
     *
     *  - [FreshSession] — nothing was persisted, so open one brand-new session
     *    (so the user lands on a usable chat rather than an empty container);
     *  - [Restore] — re-open the persisted sessions in [planRestoreOrder].
     */
    sealed interface HydratePlan {
        object FreshSession : HydratePlan
        data class Restore(val order: List<String>) : HydratePlan
    }

    fun planHydrate(openTabIds: List<String>, activeTabId: String?): HydratePlan =
        if (openTabIds.isEmpty()) HydratePlan.FreshSession
        else HydratePlan.Restore(planRestoreOrder(openTabIds, activeTabId))

    /**
     * The host to use right now: read `hostMode` from settings and resolve it to
     * the matching host for [project] (multi-project: the tool-window host is a
     * per-project service).
     */
    fun currentHost(project: Project): ChatHost =
        selectHost(
            SettingsManager.getInstance().getHostMode(),
            EditorTabHost,
            ToolWindowHost.getInstance(project),
        )
}
