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
            // 마켓플레이스 전용 소개 문서(영어 원본)를 그대로 HTML로 변환.
            // 언어별 번역본은 같은 폴더(docs/marketplaces/jetbrains/<lang>.md)에 있고,
            // 본문 상단의 언어 링크 줄에서 GitHub 절대 URL로 이동한다.
            val markdown = file("docs/marketplaces/jetbrains/en.md").readText()

            // Markdown → HTML 변환
            val parser = org.commonmark.parser.Parser.builder().build()
            val renderer = org.commonmark.renderer.html.HtmlRenderer.builder().build()
            val document = parser.parse(markdown)
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
            <h3>0.19.2 - Faster session switching & smarter usage hints</h3>
            <ul>
                <li>Jump between conversations faster: open the session dropdown with the new /resume command, navigate it entirely from the keyboard, and search instantly by session ID.</li>
                <li>Switch accounts in seconds with the new /login command in the command palette.</li>
                <li>Optional, consent-based usage analytics to help improve the plugin — off by default, sent only if you opt in.</li>
                <li>Fixed the usage hint not showing in some shell locales. (#116)</li>
            </ul>
            <h3>0.19.0 - Session panel & Sidebar chats now available!</h3>
            <ul>
                <li>New session list panel on the left: browse all your Claude sessions and click one to open it in a new tab — even when no editor tab is open.</li>
                <li>Choose where chats open — a dedicated editor tab or the sidebar tool window — under Settings → General → Preferred Location.</li>
                <li>Fixed a startup freeze — restoring Claude tabs no longer locks up the IDE for up to a minute. (#110)</li>
            </ul>
        """.trimIndent()
    }
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
    pluginVerification {
        ides {
            // Lower bound: matches our platformVersion (2024.2) / sinceBuild=242.
            // Deprecations accumulate, so the upper-bound IU EAP below subsumes
            // intermediate release lines (e.g. 2024.3) for forward-compat checks.
            ide("IC", "2024.2.6")
            // 2026.2 EAP coverage — driving #50 (Allow IDE EAP versions). Forward-compat
            // needs to hold before we drop untilBuild. IU EAP is published with the
            // build-number-based "<build>-EAP-SNAPSHOT" suffix.
            ide("IU", "262.8117.19-EAP-SNAPSHOT", false)
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
        // CI=true lets pnpm recreate node_modules non-interactively when the
        // resolved pnpm version differs from how the modules were last installed
        // (the pinned packageManager field forces a specific version). Without
        // it, the install aborts under Gradle with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY.
        environment("CI", "true")
        commandLine("pnpm", "install", "--frozen-lockfile")
        inputs.files(file("webview/package.json"), file("webview/pnpm-lock.yaml"))
        outputs.dir(file("webview/node_modules"))
    }

    register<Exec>("pnpmInstallBackend") {
        description = "Install backend npm dependencies via pnpm"
        dependsOn("syncVersions")
        workingDir = file("backend")
        environment("CI", "true")
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
