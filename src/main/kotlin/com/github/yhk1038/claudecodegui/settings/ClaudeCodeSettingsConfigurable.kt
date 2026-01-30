package com.github.yhk1038.claudecodegui.settings

import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.*
import javax.swing.JComponent

class ClaudeCodeSettingsConfigurable : Configurable {

    private var panel: DialogPanel? = null
    private val settings = ClaudeCodeSettings.getInstance()

    override fun getDisplayName(): String = "Claude Code"

    override fun createComponent(): JComponent {
        panel = panel {
            group("CLI Configuration") {
                row("CLI Path:") {
                    textField()
                        .bindText(
                            { settings.state.cliPath ?: "" },
                            { settings.state.cliPath = it.ifBlank { null } }
                        )
                        .columns(COLUMNS_LARGE)
                        .comment("Path to Claude Code CLI. Leave empty for auto-detection.")
                }
            }

            group("Permissions") {
                row("Permission Mode:") {
                    comboBox(listOf("ALWAYS_ASK", "REMEMBER_SESSION", "TRUST_WORKSPACE"))
                        .bindItem(
                            { settings.state.permissionMode },
                            { settings.state.permissionMode = it ?: "ALWAYS_ASK" }
                        )
                }
                row {
                    checkBox("Auto-apply low-risk changes")
                        .bindSelected(settings.state::autoApplyLowRisk)
                }
            }
        }
        return panel!!
    }

    override fun isModified(): Boolean = panel?.isModified() ?: false

    override fun apply() {
        panel?.apply()
    }

    override fun reset() {
        panel?.reset()
    }
}
