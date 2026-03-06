plugins {
    id("org.jetbrains.kotlin.jvm") version "2.1.0"
    id("org.jetbrains.intellij.platform") version "2.10.4"
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0"
}

group = "com.github.yhk1038"
version = providers.gradleProperty("pluginVersion").get()

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
        bundledPlugin("org.jetbrains.plugins.terminal")
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
            <h3>0.8.0 - File &amp; Folder Attachments</h3>
            <ul>
                <li>Add file and folder attachment support (beyond images)</li>
                <li>Add native file picker dialog support for Windows/Linux</li>
                <li>Improve attachment context pills with chip-style UI in messages</li>
                <li>Fix settings page intermittently failing to open in production builds</li>
            </ul>
            <h3>0.7.2 - Compatibility Fix</h3>
            <ul>
                <li>Replace deprecated terminal API to fix compatibility warnings across all IDE versions</li>
            </ul>
            <h3>0.7.1 - Usage API Reliability Improvements</h3>
            <ul>
                <li>Improve Usage API rate limit handling with Retry-After header support</li>
                <li>Add inflight request deduplication to prevent concurrent Usage API calls</li>
                <li>Increase Usage API cache TTL to 60 seconds for better rate limit protection</li>
            </ul>
            <h3>0.7.0 - Account Switching, Terminal Integration &amp; Usage Battery</h3>
            <ul>
                <li>Add Switch Account page with account routing</li>
                <li>Open terminal and external URL integration</li>
                <li>Move Terminal App settings to CLI page with CLI path detection</li>
                <li>Add 5-hour token usage battery widget in top bar</li>
                <li>Add project folder switch button in top bar</li>
                <li>Improve stop/resume button to work across all active states</li>
                <li>Fix Cmd+Arrow text navigation in JCEF</li>
                <li>Add in-memory caching for Usage API to prevent 429 rate limit</li>
            </ul>
            <h3>0.6.7 - Permission Prompt &amp; Streaming Animation</h3>
            <ul>
                <li>Implement permission-prompt-tool protocol for AskUserQuestion and permission request handling</li>
                <li>Redesign StreamingIndicator with Cursor-style scramble animation</li>
            </ul>
            <h3>0.6.6 - Process Lifecycle &amp; Error Resilience</h3>
            <ul>
                <li>Prevent duplicate Node.js backend processes with project-level singleton service</li>
                <li>Clean up session processes and WebSocket connections on backend shutdown</li>
                <li>Fix static asset MIME type errors caused by SPA fallback routing</li>
                <li>Fix asset extraction to prefer dynamic directory scanning</li>
                <li>Add global ErrorBoundary with StreamErrorBanner component separation</li>
                <li>Migrate string literal union types to enums for better type safety</li>
            </ul>
            <h3>0.6.5 - Session Refresh &amp; Tab Routing Fix</h3>
            <ul>
                <li>Add manual refresh button to session dropdown for on-demand session list reload</li>
                <li>Fix new tab and settings opening as separate windows instead of editor tabs in JCEF</li>
                <li>Build-time version synchronization across webview and backend artifacts with cache validation</li>
            </ul>
            <h3>0.6.4 - Fixed Port</h3>
            <ul>
                <li>Use fixed default port 19836 for Node.js backend (dev and prod unified)</li>
                <li>Auto-retry on port conflict with graceful fallback</li>
                <li>Add Vite WebSocket proxy for browser dev environment</li>
            </ul>
            <h3>0.6.3 - Build Pipeline Fix</h3>
            <ul>
                <li>Fix stale WebView bundle causing command palette items to be non-functional</li>
                <li>Remove phantom Thinking toggle from Model section</li>
                <li>Restore dynamic slash command loading in production builds</li>
                <li>Remove dead devBridgePlugin import that broke Vite build since v0.6.0</li>
                <li>Delete stale vite.config.js that shadowed vite.config.ts</li>
                <li>Align Vite outDir with Gradle syncWebviewResources pipeline</li>
            </ul>
            <h3>0.6.2 - (Skipped: broken build)</h3>
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

    // package.json 버전을 pluginVersion으로 동기화
    register("syncVersions") {
        description = "Sync package.json versions with pluginVersion from gradle.properties"
        val pluginVer = providers.gradleProperty("pluginVersion").get()
        doLast {
            val versionPattern = Regex(""""version"\s*:\s*"[^"]+"""")
            val replacement = """"version": "$pluginVer""""
            listOf(file("webview/package.json"), file("backend/package.json")).forEach { pkgFile ->
                val original = pkgFile.readText()
                val updated = versionPattern.replaceFirst(original, replacement)
                if (original != updated) {
                    pkgFile.writeText(updated)
                    println("[syncVersions] Updated ${pkgFile.path} version → $pluginVer")
                } else {
                    println("[syncVersions] ${pkgFile.path} already at $pluginVer")
                }
            }
        }
    }

    register<Exec>("pnpmInstallWebview") {
        description = "Install webview npm dependencies via pnpm"
        dependsOn("syncVersions")
        workingDir = file("webview")
        commandLine("pnpm", "install", "--frozen-lockfile")
        inputs.files(file("webview/package.json"), file("webview/pnpm-lock.yaml"))
        outputs.dir(file("webview/node_modules"))
    }

    register<Exec>("pnpmInstallBackend") {
        description = "Install backend npm dependencies via pnpm"
        dependsOn("syncVersions")
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

    named("buildWebviewFrontend") {
        val pluginVer = providers.gradleProperty("pluginVersion").get()
        doLast {
            val buildVersionFile = file("webview/dist/.build-version")
            buildVersionFile.parentFile.mkdirs()
            buildVersionFile.writeText(pluginVer)
            println("[buildWebviewFrontend] Wrote webview/dist/.build-version → $pluginVer")
        }
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

    named("buildNodeBackend") {
        val pluginVer = providers.gradleProperty("pluginVersion").get()
        doLast {
            val buildVersionFile = file("backend/dist/.build-version")
            buildVersionFile.parentFile.mkdirs()
            buildVersionFile.writeText(pluginVer)
            println("[buildNodeBackend] Wrote backend/dist/.build-version → $pluginVer")
        }
    }

    register("verifyBuildVersions") {
        description = "Verify that webview and backend dist artifacts match pluginVersion"
        dependsOn("syncWebviewResources")
        val pluginVer = providers.gradleProperty("pluginVersion").get()
        doLast {
            val artifacts = mapOf(
                "webview/dist/.build-version" to file("webview/dist/.build-version"),
                "backend/dist/.build-version" to file("backend/dist/.build-version")
            )
            val mismatches = mutableListOf<String>()
            artifacts.forEach { (label, versionFile) ->
                if (!versionFile.exists()) {
                    mismatches += "$label: 파일 없음 (빌드가 실행되지 않았을 수 있습니다)"
                } else {
                    val actual = versionFile.readText().trim()
                    if (actual != pluginVer) {
                        mismatches += "$label: 기대=$pluginVer, 실제=$actual"
                    }
                }
            }
            if (mismatches.isNotEmpty()) {
                throw GradleException(
                    """
                    [verifyBuildVersions] 버전 불일치 감지:
                    ${mismatches.joinToString("\n    ")}

                    clear-cache 후 재빌드하세요:
                      ./gradlew clean && ./gradlew build
                    """.trimIndent()
                )
            }
            println("[verifyBuildVersions] 모든 아티팩트 버전 일치: $pluginVer")
        }
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
        dependsOn("verifyBuildVersions")
    }
}
