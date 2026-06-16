package com.github.yhk1038.claudecodegui.hosting

/**
 * The "place" a Claude Code chat session is hosted in.
 *
 * This is the single source of truth for the host vocabulary shared across the
 * router ([ChatHostRouter]), the settings layers (`hostMode` key), and the
 * concrete hosts ([EditorTabHost], and the tool-window host added in Phase 4).
 */
enum class HostMode {
    /** Each chat session lives in its own editor tab (the original behaviour). */
    EDITOR_TAB,

    /** Each chat session lives in a tool-window content tab. */
    TOOL_WINDOW,
}
