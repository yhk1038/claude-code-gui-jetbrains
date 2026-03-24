buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.commonmark:commonmark:0.24.0")
    }
}

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

    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    jvmToolchain(21)
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
            <h3>0.13.2 - Editor tab & resource fixes</h3>
            <ul>
                <li>Fixed new editor tab not opening in JetBrains environment</li>
                <li>Fixed missing favicon-unread.svg in fallback resource extraction</li>
            </ul>
            <h3>0.13.1 - Maintenance patch</h3>
            <ul>
                <li>Maintenance patch release</li>
            </ul>
            <h3>0.13.0 - Session management & agent tool rendering</h3>
            <ul>
                <li>Added session delete button to session dropdown with confirmation dialog</li>
                <li>Added TaskOutput and TaskStop tool renderers for agent sub-task display</li>
                <li>Added horizontal scroll for tool output content</li>
                <li>Fixed browser back navigation triggered by trackpad horizontal swipe</li>
                <li>Fixed potential Windows path error on language change</li>
            </ul>
        """.trimIndent()
    }
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
    pluginVerification {
        ides {
            recommended()
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
