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
    TOOL_WINDOW;

    /**
     * The kebab-case string stored under the `hostMode` settings key. The same
     * whitelist is enforced by the backend `validateSetting` and the WebView.
     */
    fun toSetting(): String = when (this) {
        EDITOR_TAB -> "editor-tab"
        TOOL_WINDOW -> "tool-window"
    }

    companion object {
        /**
         * Parse the `hostMode` settings value. An unknown or missing value falls
         * back to [EDITOR_TAB] — the safe default that preserves existing behaviour.
         */
        fun fromSetting(value: String?): HostMode = when (value) {
            "tool-window" -> TOOL_WINDOW
            else -> EDITOR_TAB
        }
    }
}
