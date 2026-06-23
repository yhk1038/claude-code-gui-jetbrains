package com.github.yhk1038.claudecodegui.bridge

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class ShellPathResolverTest {

    @Nested
    inner class ExtractBetweenMarkers {
        @Test
        fun `should extract the PATH sandwiched between two markers`() {
            val marker = "abc123"
            val output = "noise before${marker}/usr/local/bin:/usr/bin:/bin${marker}noise after"
            assertEquals("/usr/local/bin:/usr/bin:/bin", ShellPathResolver.extractBetweenMarkers(output, marker))
        }

        @Test
        fun `should trim surrounding whitespace and newlines`() {
            val marker = "M"
            val output = "${marker}\n  /usr/bin:/bin  \n${marker}"
            assertEquals("/usr/bin:/bin", ShellPathResolver.extractBetweenMarkers(output, marker))
        }

        @Test
        fun `should ignore shell startup noise outside the markers`() {
            val marker = "ZZ"
            // Simulates a noisy interactive shell: banner + prompt then the marked PATH.
            val output = "Welcome to zsh!\n[32m➜[0m ${marker}/opt/homebrew/bin:/usr/bin${marker}\nbye"
            assertEquals("/opt/homebrew/bin:/usr/bin", ShellPathResolver.extractBetweenMarkers(output, marker))
        }

        @Test
        fun `should return null when markers are absent`() {
            assertNull(ShellPathResolver.extractBetweenMarkers("/usr/bin:/bin", "M"))
        }

        @Test
        fun `should return null when only one marker is present`() {
            assertNull(ShellPathResolver.extractBetweenMarkers("M/usr/bin:/bin", "M"))
        }

        @Test
        fun `should take the first marker pair only`() {
            val marker = "Q"
            val output = "${marker}/first:/path${marker}middle${marker}/second${marker}"
            assertEquals("/first:/path", ShellPathResolver.extractBetweenMarkers(output, marker))
        }

        @Test
        fun `should handle a marker that contains regex-special characters`() {
            val marker = "a.b*c+"
            val output = "${marker}/usr/bin:/bin${marker}"
            assertEquals("/usr/bin:/bin", ShellPathResolver.extractBetweenMarkers(output, marker))
        }
    }

    @Nested
    inner class LooksLikePath {
        @Test
        fun `should accept a colon-separated PATH`() {
            assertTrue(ShellPathResolver.looksLikePath("/usr/local/bin:/usr/bin:/bin"))
        }

        @Test
        fun `should reject a single directory without colon`() {
            assertFalse(ShellPathResolver.looksLikePath("/usr/bin"))
        }

        @Test
        fun `should reject blank or null`() {
            assertFalse(ShellPathResolver.looksLikePath(null))
            assertFalse(ShellPathResolver.looksLikePath(""))
            assertFalse(ShellPathResolver.looksLikePath("   "))
        }
    }

    @Nested
    inner class MarkerFor {
        @Test
        fun `should sandwich the variable name between the base marker`() {
            assertEquals("MARKPATHMARK", ShellPathResolver.markerFor("MARK", "PATH"))
            assertEquals(
                "MARKCLAUDE_CONFIG_DIRMARK",
                ShellPathResolver.markerFor("MARK", "CLAUDE_CONFIG_DIR"),
            )
        }

        @Test
        fun `should produce distinct markers per variable so values never collide`() {
            val a = ShellPathResolver.markerFor("M", "PATH")
            val b = ShellPathResolver.markerFor("M", "CLAUDE_CONFIG_DIR")
            assertNotEquals(a, b)
            assertFalse(a.contains(b) || b.contains(a))
        }
    }

    @Nested
    inner class BuildShellCommand {
        @Test
        fun `should wrap each variable in its own per-variable marker pair`() {
            val cmd = ShellPathResolver.buildShellCommand("MARK", listOf("PATH", "CLAUDE_CONFIG_DIR"))
            // command printenv bypasses aliases/functions; per-variable markers sandwich each value.
            assertTrue(cmd.contains("command printenv PATH"), "command was: $cmd")
            assertTrue(cmd.contains("command printenv CLAUDE_CONFIG_DIR"), "command was: $cmd")
            // each variable's marker must appear exactly twice so the extractor can find a pair
            assertEquals(2, Regex("MARKPATHMARK").findAll(cmd).count())
            assertEquals(2, Regex("MARKCLAUDE_CONFIG_DIRMARK").findAll(cmd).count())
        }

        @Test
        fun `should extract each value from a combined output using its own marker`() {
            val cmd = ShellPathResolver.buildShellCommand("M", listOf("PATH", "CLAUDE_CONFIG_DIR"))
            assertTrue(cmd.isNotBlank())
            // Simulate the shell having printed both values back, in order.
            val output = "noise" +
                "MPATHM/usr/bin:/binMPATHM" +
                "MCLAUDE_CONFIG_DIRM/data/claudeMCLAUDE_CONFIG_DIRM" +
                "tail"
            assertEquals(
                "/usr/bin:/bin",
                ShellPathResolver.extractBetweenMarkers(output, ShellPathResolver.markerFor("M", "PATH")),
            )
            assertEquals(
                "/data/claude",
                ShellPathResolver.extractBetweenMarkers(output, ShellPathResolver.markerFor("M", "CLAUDE_CONFIG_DIR")),
            )
        }

        @Test
        fun `should yield an empty string for an unset variable (markers present, value blank)`() {
            // `command printenv` prints nothing for an unset var, so the markers wrap "".
            val output = "MCLAUDE_CONFIG_DIRMMCLAUDE_CONFIG_DIRM"
            assertEquals(
                "",
                ShellPathResolver.extractBetweenMarkers(output, ShellPathResolver.markerFor("M", "CLAUDE_CONFIG_DIR")),
            )
        }
    }

    @Nested
    inner class MergePaths {
        @Test
        fun `should put the shell PATH entries first then the base entries`() {
            val result = ShellPathResolver.mergePaths("/nvm/bin:/usr/bin", "/usr/bin:/sbin", ":")
            assertEquals("/nvm/bin:/usr/bin:/sbin", result)
        }

        @Test
        fun `should de-duplicate while preserving first-seen order`() {
            val result = ShellPathResolver.mergePaths("/a:/b", "/b:/c:/a", ":")
            assertEquals("/a:/b:/c", result)
        }

        @Test
        fun `should drop empty segments`() {
            val result = ShellPathResolver.mergePaths("/a::/b", ":/c:", ":")
            assertEquals("/a:/b:/c", result)
        }

        @Test
        fun `should return base when shell PATH is null`() {
            assertEquals("/usr/bin:/sbin", ShellPathResolver.mergePaths(null, "/usr/bin:/sbin", ":"))
        }

        @Test
        fun `should return shell PATH when base is empty`() {
            assertEquals("/nvm/bin", ShellPathResolver.mergePaths("/nvm/bin", "", ":"))
        }

        @Test
        fun `should honour a custom separator`() {
            val result = ShellPathResolver.mergePaths("C:\\node", "C:\\sys;C:\\node", ";")
            assertEquals("C:\\node;C:\\sys", result)
        }
    }
}
