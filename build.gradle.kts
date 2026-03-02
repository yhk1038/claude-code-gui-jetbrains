plugins {
    id("org.jetbrains.kotlin.jvm") version "2.1.0"
    id("org.jetbrains.intellij.platform") version "2.10.4"
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0"
}

group = "com.github.yhk1038"
version = "0.6.2"

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
            sinceBuild = "242"
            untilBuild = "253.*"
        }
        changeNotes = """
            <h3>0.6.2 - Command Palette Fix</h3>
            <ul>
                <li>Fix stale WebView bundle causing command palette items to be non-functional</li>
                <li>Remove phantom Thinking toggle from Model section</li>
                <li>Fix wv-build alias to use subshell (prevent cd side-effect in dist builds)</li>
            </ul>
            <h3>0.6.1 - Compact Session History Preservation</h3>
            <ul>
                <li>Fix compacted sessions losing pre-compact message history on reload</li>
                <li>Add compact summary card rendering at conversation boundaries</li>
            </ul>
            <h3>0.6.0 - Streaming Stability &amp; Rich Tool Rendering</h3>
            <ul>
                <li>Context window usage bar in status bar with /compact click integration</li>
                <li>ESC key interrupt support with immediate interrupted message display</li>
                <li>Dynamic slash command loading with auto-reset on session switch</li>
                <li>CLI error propagation and session crash recovery</li>
                <li>Image attachment via clipboard paste, drag-and-drop, and file picker</li>
                <li>Inline diff view for Edit tool blocks</li>
                <li>Sub-agent tool call rendering inside Task blocks</li>
                <li>Fix streaming tool block loss and error handling improvements</li>
                <li>Fix sessions without slug/file-history-snapshot missing from dropdown</li>
                <li>Fix ESM bundle Node.js built-in module require failure</li>
                <li>Remove dead PermissionMode code; merge Default Input Mode into Permissions tab</li>
                <li>Fix CommandPalette panel positioning and sizing</li>
            </ul>
            <h3>0.5.0 - Unified Node.js Backend &amp; Account Dashboard</h3>
            <ul>
                <li>Migrated to single Node.js backend architecture (replaced dual Kotlin/dev-bridge)</li>
                <li>Added Account &amp; Usage modal with real-time plan usage display</li>
                <li>Dynamic version display showing both Plugin and Claude Code CLI versions</li>
                <li>Skeleton UI loading states for Account section</li>
                <li>Global thinking block expand/collapse state via ChatStreamContext</li>
                <li>Accurate UsageMeter reset time display</li>
                <li>Cross-version compatibility fix (removed CefContextMenuHandler)</li>
                <li>Refactored CommandPalettePanel into separate component files</li>
            </ul>
            <h3>0.4.2 - Compatibility Fix</h3>
            <ul>
                <li>Remove CefContextMenuHandler to resolve cross-version compatibility (DevTools via F12 only)</li>
                <li>Fix deprecated URL(String) constructor usage</li>
            </ul>
            <h3>0.4.0 - Cross-Tab Sync &amp; Broader IDE Support</h3>
            <ul>
                <li>Expanded JetBrains IDE support range to 2024.2+</li>
                <li>Real-time cross-tab session list synchronization</li>
                <li>Added Plan Usage Limits page in Settings</li>
                <li>Input history integration on session restore with multi-line cursor guard</li>
            </ul>
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

    // Node.js 빌드 통합 태스크
    register<Exec>("pnpmInstallWebview") {
        description = "Install webview npm dependencies via pnpm"
        workingDir = file("webview")
        commandLine("pnpm", "install", "--frozen-lockfile")
        inputs.files(file("webview/package.json"), file("webview/pnpm-lock.yaml"))
        outputs.dir(file("webview/node_modules"))
    }

    register<Exec>("pnpmInstallBackend") {
        description = "Install backend npm dependencies via pnpm"
        workingDir = file("backend")
        commandLine("pnpm", "install")
        inputs.files(fileTree("backend").include("package.json"))
        outputs.dir(file("backend/node_modules"))
    }

    register<Exec>("buildWebviewFrontend") {
        description = "Build the WebView frontend (Vite)"
        dependsOn("pnpmInstallWebview")
        workingDir = file("webview")
        commandLine("pnpm", "run", "build")
        inputs.dir(file("webview/src"))
        inputs.files(file("webview/package.json"), file("webview/vite.config.ts"))
        outputs.dir(file("webview/dist"))
    }

    register<Exec>("buildNodeBackend") {
        description = "Build the Node.js backend bundle (esbuild)"
        dependsOn("pnpmInstallBackend")
        workingDir = file("backend")
        commandLine("pnpm", "run", "build")
        inputs.dir(file("backend/src"))
        inputs.files(file("backend/esbuild.mjs"), file("backend/package.json"))
        outputs.file(file("backend/dist/backend.mjs"))
    }

    register("syncWebviewResources") {
        description = "Sync built webview/backend artifacts into src/main/resources"
        dependsOn("buildWebviewFrontend", "buildNodeBackend")
        inputs.dir(file("webview/dist"))
        inputs.file(file("backend/dist/backend.mjs"))
        outputs.dir(file("src/main/resources/webview"))
        outputs.file(file("src/main/resources/backend/backend.mjs"))
        doLast {
            // WebView 정적 파일 동기화 (stale 파일 방지를 위해 기존 디렉토리 삭제 후 복사)
            file("src/main/resources/webview").deleteRecursively()
            copy {
                from(file("webview/dist"))
                into(file("src/main/resources/webview"))
            }
            // Node.js 백엔드 번들 복사
            file("src/main/resources/backend").mkdirs()
            copy {
                from(file("backend/dist/backend.mjs"))
                into(file("src/main/resources/backend"))
            }
        }
    }

    named("processResources") {
        dependsOn("syncWebviewResources")
    }
}
