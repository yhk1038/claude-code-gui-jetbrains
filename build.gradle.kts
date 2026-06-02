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
            untilBuild = "261.*"
        }
        changeNotes = """
            <h3>0.16.1 - Restore WebView panel on IntelliJ 2026.1+</h3>
            <ul>
                <li>Fixed a regression where the WebView panel rendered as a black/blank rectangle on IntelliJ Platform 2026.1+, which runs JCEF in out-of-process (remote) mode. The plugin now detects remote-mode at runtime and skips the windowed-rendering flag that was introduced in v0.16.0 for HiDPI sharpness — that flag is unsupported in remote-mode and silently ignored by the platform, leaving the browser unable to paint (closes #51).</li>
                <li>On 2024.x/2025.x (in-process JCEF) behavior is unchanged — the HiDPI fix from #23 still applies. On 2026.1+ the WebView renders via off-screen rendering, which restores functionality at the cost of some HiDPI sharpness until the platform-level scale-propagation issue is resolved upstream.</li>
            </ul>
            <h3>0.16.0 - System theme follows IDE, desktop notifications, ccg launcher</h3>
            <ul>
                <li>System theme now follows the IDE's Look-and-Feel in JetBrains mode and reacts to LAF changes without a restart; standalone (browser) mode continues to follow the OS preference. The dropdown is labeled "System (IDE)" or "System (OS)" accordingly (closes #45).</li>
                <li>Light theme legibility fixed for inline code, code blocks, blockquotes, table borders, and tool labels — the previous cyan-on-cyan rendering is gone (closes #46).</li>
                <li>Desktop notifications for stream errors and for awaiting permission / plan approval / user input, with OS sounds and an unread favicon indicator.</li>
                <li>New <code>ccg</code> terminal launcher for Standalone mode: install with <code>curl | bash</code>, browser auto-opens, Ctrl+C exits immediately, <code>ccg update</code> always re-downloads the runtime.</li>
                <li>Streaming UX: auto-scroll respects manual scroll-up and shows a jump-to-bottom pill; the auto-scroll threshold is configurable under Appearance.</li>
                <li>JCEF embedded browser now renders at full HiDPI (no more pixelation on Retina/4K displays).</li>
                <li>Plugin updates refresh the WebView correctly thanks to <code>Cache-Control</code> on the SPA shell with immutable hashed assets.</li>
                <li>QR code in the Tunnel modal stays readable on dark themes (forced white background).</li>
                <li>Browser auto-translate is disabled on the UI, and the update banner is hidden in standalone mode where it does not apply.</li>
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
                "-Dplugin.project.root=${projectDir.absolutePath}"
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

    named("processResources") {
        dependsOn("verifyBuildVersions")
    }
}
