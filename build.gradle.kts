plugins {
    id("org.jetbrains.kotlin.jvm") version "2.1.0"
    id("org.jetbrains.intellij.platform") version "2.10.4"
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0"
}

group = "com.github.yhk1038"
version = "0.3.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        val platformVersion = providers.gradleProperty("platformVersion").getOrElse("2025.3.2")

        intellijIdea(platformVersion)
    }

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
}

kotlin {
    jvmToolchain(21)
}

intellijPlatform {
    pluginConfiguration {
        id = "com.github.yhk1038.claude-code-gui"
        name = "Claude Code with GUI"
        version = project.version.toString()
        description = "Claude Code GUI for JetBrains IDEs - Cursor-like UX"
        vendor {
            name = "yhk1038"
            url = "https://github.com/yhk1038"
        }
        ideaVersion {
            sinceBuild = "253"
            untilBuild = "253.*"
        }
        changeNotes = """
            <h3>0.3.0 - Permission Mode &amp; Data Integrity</h3>
            <ul>
                <li>Added permission mode support: inputMode selection maps to Claude Code CLI --permission-mode flag</li>
                <li>Aligned session wire format with Claude Code CLI original data structures</li>
                <li>Fixed header and input area with improved chat panel layout</li>
                <li>Refactored slash command panel to registry-based CommandPalette module</li>
                <li>Refactored dev-bridge from single file to modular architecture</li>
                <li>Added CLI command logging for debugging</li>
            </ul>
            <h3>0.2.1 - Patch</h3>
            <ul>
                <li>Fix deprecated API usage: replaced UIUtil.isUnderDarcula() with JBColor.isBright()</li>
            </ul>
            <h3>0.2.0 - Feature-Complete Initial Release</h3>
            <ul>
                <li>Chat interface with Claude Code agent and streaming Markdown responses</li>
                <li>Tool call visualization for file read/write, bash, search, and skill operations</li>
                <li>Diff cards with Apply/Reject actions for code changes</li>
                <li>Permission management dialog for file and bash operations</li>
                <li>Session management with multiple editor tabs and session dropdown</li>
                <li>Image attachment rendering from session content blocks</li>
                <li>Integrated settings panel under Tools menu</li>
                <li>Auto-focus chat input on window activation</li>
                <li>Unified workingDir source via URL parameter (SSOT)</li>
            </ul>
        """.trimIndent()
    }
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
}

tasks {
    wrapper {
        gradleVersion = "8.13"
    }

    // Enable dev mode for runIde (uses Vite dev server if available)
    // Can be disabled via: CLAUDE_DEV_MODE=false ./gradlew runIde
    named<org.jetbrains.intellij.platform.gradle.tasks.RunIdeTask>("runIde") {
        jvmArgumentProviders += CommandLineArgumentProvider {
            listOf("-Dclaude.dev.mode=${System.getenv("CLAUDE_DEV_MODE") ?: "true"}")
        }
    }
}
