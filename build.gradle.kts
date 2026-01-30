plugins {
    id("org.jetbrains.kotlin.jvm") version "2.1.0"
    id("org.jetbrains.intellij.platform") version "2.2.1"
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0"
}

group = "com.github.yhk1038"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        val platformType = providers.gradleProperty("platformType").getOrElse("IC")
        val platformVersion = providers.gradleProperty("platformVersion").getOrElse("2024.3")

        create(platformType, platformVersion)
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
        name = "Claude Code GUI"
        version = project.version.toString()
        description = "Claude Code GUI for JetBrains IDEs - Cursor-like UX"
        vendor {
            name = "yhk1038"
            url = "https://github.com/yhk1038"
        }
        ideaVersion {
            sinceBuild = "243"
            untilBuild = "252.*"
        }
    }
}

tasks {
    wrapper {
        gradleVersion = "8.11.1"
    }

    // Disable instrumentation for IDEs without Java compiler (WS, PS, PY, RD, RM)
    named("instrumentCode") {
        val platformType = providers.gradleProperty("platformType").getOrElse("IC")
        enabled = platformType !in listOf("WS", "PS", "PY", "RD", "RM")
    }
    named("instrumentTestCode") {
        val platformType = providers.gradleProperty("platformType").getOrElse("IC")
        enabled = platformType !in listOf("WS", "PS", "PY", "RD", "RM")
    }

    // Enable dev mode for runIde (uses Vite dev server)
    named<org.jetbrains.intellij.platform.gradle.tasks.RunIdeTask>("runIde") {
        jvmArgumentProviders += CommandLineArgumentProvider {
            listOf("-Dclaude.dev.mode=true")
        }
    }
}
