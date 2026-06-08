import org.gradle.language.jvm.tasks.ProcessResources

buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.commonmark:commonmark:0.24.0")
    }
}

plugins {
    id("org.jetbrains.kotlin.jvm") version "2.3.21"
    id("org.jetbrains.intellij.platform") version "2.10.4"
    id("org.jetbrains.kotlin.plugin.serialization") version "2.3.21"
    id("org.jetbrains.kotlinx.kover") version "0.9.1"
}

group = "com.github.yhk1038"
version = providers.gradleProperty("pluginVersion").get()

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
        // EAP / nightly builds (262.* and beyond) live in the snapshots repo, not
        // the release repo defaultRepositories() configures. Without this the
        // verifyPlugin task can't resolve EAP IDE artifacts. Needed for #50.
        snapshots()
    }
}

dependencies {
    intellijPlatform {
        val platformVersion = providers.gradleProperty("platformVersion").getOrElse("2025.3.2")
        // PLATFORM_TYPE switches the sandbox IDE for runIde. Defaults to IntelliJ
        // IDEA Community; set PLATFORM_TYPE=RD to launch a Rider sandbox instead
        // (used to manually reproduce Marketplace review #140014 / #50).
        val platformType = providers.environmentVariable("PLATFORM_TYPE").getOrElse("IC")

        when (platformType) {
            "RD" -> create("RD", platformVersion, useInstaller = false)
            // IU with useInstaller=false resolves EAP/snapshot coordinates
            // (e.g. 262.6653.22-EAP-SNAPSHOT) from the snapshots repo, reusing
            // the artifact the Plugin Verifier already cached — no re-download.
            "IU" -> create("IU", platformVersion, useInstaller = false)
            else -> intellijIdea(platformVersion)
        }
        bundledPlugin("org.jetbrains.plugins.terminal")
    }

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")

    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    jvmToolchain(21)
    // Kotlin 2.2+ changed default-method ABI: implementing classes get bridge methods
    // that Plugin Verifier flags as "overrides of deprecated/internal API" even when
    // the source has no override. Compile interface default methods as standard JVM
    // default methods instead, so implementing classes do not carry the bridge bytecode.
    // (v0.16.0 with Kotlin 2.1.0 had zero warnings on every IDE; this restores that.)
    compilerOptions {
        freeCompilerArgs.add("-Xjvm-default=all")
    }
}

kover {
    reports {
        total {
            xml { onCheck = false }
            html { onCheck = false }
        }
    }
}

intellijPlatform {
    pluginConfiguration {
        id = "com.github.yhk1038.claude-code-gui"
        name = "Claude Code with GUI"
        version = project.version.toString()
        description = providers.provider {
            // README.md에서 마켓플레이스용 HTML 설명을 동적으로 생성
            val readme = file("README.md").readText()
            val lines = readme.lines()

            // 헤더(h1)와 한 줄 설명 추출: 첫 번째 비어있지 않은 줄들
            val titleLine = lines.firstOrNull { it.startsWith("# ") } ?: ""
            val subtitleLine = lines.drop(1).firstOrNull { it.isNotBlank() && !it.startsWith("[![") && !it.startsWith("![") } ?: ""

            // 추출할 섹션: Overview, Features, Requirements, Quick Start
            val targetSections = setOf("Overview", "Features", "Requirements", "Quick Start")
            val stopSection = "Changelog"

            val sectionContent = StringBuilder()
            var inTargetSection = false
            var done = false

            for (line in lines) {
                if (done) break
                // h2 섹션 시작 감지
                val h2Match = Regex("""^## (.+)$""").find(line)
                if (h2Match != null) {
                    val sectionName = h2Match.groupValues[1].trim()
                    if (sectionName == stopSection) {
                        done = true
                        break
                    }
                    inTargetSection = sectionName in targetSections
                }
                if (!inTargetSection) continue

                // 제외 규칙: 배지, TODO 주석, 수평선
                if (line.startsWith("[![") || line.startsWith("![")) continue
                if (line.trimStart().startsWith("<!-- TODO")) continue
                if (line.trim() == "---") continue

                sectionContent.appendLine(line)
            }

            // 제목 블록 + 섹션 내용 조합
            val fullContent = buildString {
                if (titleLine.isNotBlank()) appendLine(titleLine)
                if (subtitleLine.isNotBlank()) appendLine(subtitleLine)
                appendLine()
                append(sectionContent.toString().trimEnd())
            }

            // Markdown → HTML 변환
            val parser = org.commonmark.parser.Parser.builder().build()
            val renderer = org.commonmark.renderer.html.HtmlRenderer.builder().build()
            val document = parser.parse(fullContent)
            renderer.render(document)
        }.get()
        vendor {
            name = "yhk1038"
            url = "https://github.com/yhk1038"
        }
        ideaVersion {
            sinceBuild = "242"
            // Open-ended until-build: forward-compatible with all future IntelliJ
            // Platform releases. Verified internal-API-clean against IDEA 2026.2 EAP
            // and Rider 2026.2 EAP via the verifyPlugin matrix below (#50, #53).
            untilBuild = provider { null }
        }
        changeNotes = """
            <h3>0.17.1 - Reliable Node.js detection, with a manual override</h3>
            <ul>
                <li><b>Automatic Node.js detection</b>: The plugin now reads your shell's real PATH, so Node.js installed via nvm, fnm, volta, or similar version managers is found even when the IDE is launched from the Dock or an app launcher — fixing the "Node.js not found" error on startup.</li>
                <li><b>Manual Node path</b>: You can now set the Node.js executable path explicitly in Settings, just like the Claude CLI path. Handy if you manage multiple Node versions (for example with <code>n</code>) and want to pin the exact one the backend runs on.</li>
            </ul>
            <h3>0.17.0 - Attach files faster, work with paths as chips</h3>
            <ul>
                <li><b>@-mention chips</b>: Typing @ in the composer turns a file path into an inline chip. Chips are preserved in sent messages — click one to open that file in the editor.</li>
                <li><b>Alt+K shortcut</b>: Attach the path of the file you are currently editing straight into the chat input with a single shortcut. Whether the input regains focus afterward is configurable in Settings.</li>
                <li><b>Native drag &amp; drop</b>: Drag files from the IDE onto the chat to attach them instantly.</li>
                <li><b>File picker attachments</b>: Choose files to attach through a native file picker.</li>
                <li><b>New rich composer</b>: The chat input was rebuilt on a contenteditable composer for natural chip rendering, IME input, and caret alignment.</li>
                <li><b>Smarter tab handling</b>: If a Claude Code tab is already open, it is focused instead of opening a new one.</li>
                <li><b>Cross-platform reliability</b>: Improved file attachment stability on Windows and in the browser (Standalone) environment.</li>
            </ul>
        """.trimIndent()
    }
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
    pluginVerification {
        ides {
            // Match our platformVersion (2024.2) for regression baseline
            ide("IC", "2024.2.6")
            // 2024.3 caught deprecated/override-only API usage in Marketplace verifier;
            // pin it locally so the same checks run on every release.
            ide("IC", "2024.3.7")
            // Android Studio Ladybug (2024.2.2) — primary target of issue #34
            ide("AI", "2024.2.2.13")
            // Rider 2026.1.2 — Marketplace review #140014 reports incompatibility (#53)
            // useInstaller=false: Rider installer downloads are not supported by the
            // plugin verifier task (see intellij-platform-gradle-plugin #1852).
            ide("RD", "2026.1.2", false)
            // 2026.2 EAP coverage — driving #50 (Allow IDE EAP versions). Both IDEA
            // Ultimate and Rider are checked because review #140014 came from a Rider
            // user, and forward-compat needs to hold on both lines before we drop
            // untilBuild. EAP artifact naming is product-specific in the JetBrains
            // snapshots repo: IU is published with the build-number-based
            // "<build>-EAP-SNAPSHOT" suffix, while Rider uses the marketing
            // "<version>-EAP<n>-SNAPSHOT" form.
            ide("IU", "262.6653.22-EAP-SNAPSHOT", false)
            ide("RD", "2026.2-EAP4-SNAPSHOT", false)
        }
    }
}

tasks {
    wrapper {
        gradleVersion = "8.13"
    }

    test {
        useJUnitPlatform()
    }

    // Enable dev mode for runIde (uses Vite dev server if available)
    // Can be disabled via: CLAUDE_DEV_MODE=false ./gradlew runIde
    // Simulate JCEF-unavailable runtime via: CLAUDE_SIMULATE_NO_JCEF=true ./gradlew runIde
    named<org.jetbrains.intellij.platform.gradle.tasks.RunIdeTask>("runIde") {
        jvmArgumentProviders += CommandLineArgumentProvider {
            listOf(
                "-Dclaude.dev.mode=${System.getenv("CLAUDE_DEV_MODE") ?: "true"}",
                "-Dclaude.simulate.no.jcef=${System.getenv("CLAUDE_SIMULATE_NO_JCEF") ?: "false"}",
                // Pin the project root so NodeProcessManager.findPluginProjectRoot() can
                // resolve webview/dist directly instead of falling back to the JAR-extracted
                // temp directory (which serves stale assets after a wv-build).
                "-Dplugin.project.root=${projectDir.absolutePath}",
                // Disable IDE's dynamic plugin reload in the sandbox. Every runIde
                // re-runs prepareSandbox which bumps plugin jar mtimes; the IDE then
                // tries to unload+reload the plugin mid-session and silently fails
                // ("Failed to unload modified plugins" notification → plugin disappears
                // from the sidebar). The plugin already loaded fresh at boot, so the
                // mid-session reload is pure cost.
                "-Didea.auto.reload.plugins=false"
            )
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

    named<ProcessResources>("processResources") {
        dependsOn("verifyBuildVersions")
        // Inject pluginVersion into plugin-info.properties so the runtime can read it
        // without touching internal PluginManager APIs (which were marked
        // @ApiStatus.Internal in IntelliJ 2026.2). See NodeBackendService.getPluginVersion().
        val pluginVer = providers.gradleProperty("pluginVersion").get()
        inputs.property("pluginVersion", pluginVer)
        filesMatching("plugin-info.properties") {
            expand("version" to pluginVer)
        }
    }
}
