package com.github.yhk1038.claudecodegui.settings

import com.intellij.openapi.components.*

@Service(Service.Level.APP)
@State(
    name = "ClaudeCodeSettings",
    storages = [Storage("claude-code.xml")]
)
class ClaudeCodeSettings : PersistentStateComponent<ClaudeCodeSettings.State> {

    data class State(
        var cliPath: String? = null,
        var permissionMode: String = "ALWAYS_ASK",
        var autoApplyLowRisk: Boolean = false,
        var theme: String = "system",
        var fontSize: Int = 13,
        var debugMode: Boolean = false,
        var logLevel: String = "info",
        var initialInputMode: String = "ask_before_edit"
    )

    private var state = State()

    override fun getState(): State = state

    override fun loadState(state: State) {
        this.state = state
    }

    companion object {
        fun getInstance(): ClaudeCodeSettings = service()
    }
}
