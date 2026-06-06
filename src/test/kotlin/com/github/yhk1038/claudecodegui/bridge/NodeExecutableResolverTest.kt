package com.github.yhk1038.claudecodegui.bridge

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class NodeExecutableResolverTest {

    @Nested
    inner class SelectNvmVersion {
        @Test
        fun `should return null when no versions installed`() {
            assertNull(NodeExecutableResolver.selectNvmVersion(emptyList(), null))
            assertNull(NodeExecutableResolver.selectNvmVersion(emptyList(), "v24.16.0"))
        }

        @Test
        fun `should pick the only installed version`() {
            val result = NodeExecutableResolver.selectNvmVersion(listOf("v24.16.0"), null)
            assertEquals("v24.16.0", result)
        }

        @Test
        fun `should pick newest version by semver when no default alias`() {
            val installed = listOf("v18.20.4", "v20.10.0", "v24.16.0")
            val result = NodeExecutableResolver.selectNvmVersion(installed, null)
            assertEquals("v24.16.0", result)
        }

        @Test
        fun `should sort by numeric semver not string order`() {
            // String sort would put v24.9.0 above v24.16.0 (9 > 1); numeric must not.
            val installed = listOf("v24.9.0", "v24.16.0", "v24.2.0")
            val result = NodeExecutableResolver.selectNvmVersion(installed, null)
            assertEquals("v24.16.0", result)
        }

        @Test
        fun `should match exact version from default alias`() {
            val installed = listOf("v18.20.4", "v20.10.0", "v24.16.0")
            assertEquals("v20.10.0", NodeExecutableResolver.selectNvmVersion(installed, "v20.10.0"))
            assertEquals("v20.10.0", NodeExecutableResolver.selectNvmVersion(installed, "20.10.0"))
        }

        @Test
        fun `should match major prefix from default alias picking newest minor`() {
            val installed = listOf("v24.2.0", "v24.16.0", "v20.10.0")
            assertEquals("v24.16.0", NodeExecutableResolver.selectNvmVersion(installed, "24"))
            assertEquals("v24.16.0", NodeExecutableResolver.selectNvmVersion(installed, "v24"))
        }

        @Test
        fun `should fall back to newest when default alias is an lts codename`() {
            val installed = listOf("v18.20.4", "v24.16.0")
            // We cannot resolve "lts/iron" without nvm's alias map; fall back to newest installed.
            assertEquals("v24.16.0", NodeExecutableResolver.selectNvmVersion(installed, "lts/iron"))
        }

        @Test
        fun `should fall back to newest when default alias matches nothing`() {
            val installed = listOf("v18.20.4", "v24.16.0")
            assertEquals("v24.16.0", NodeExecutableResolver.selectNvmVersion(installed, "v99.0.0"))
        }

        @Test
        fun `should ignore non-version directory names`() {
            // nvm versions dir never contains these, but be defensive.
            val installed = listOf("v24.16.0", ".DS_Store", "default")
            assertEquals("v24.16.0", NodeExecutableResolver.selectNvmVersion(installed, null))
        }

        @Test
        fun `should trim whitespace and newline from default alias`() {
            val installed = listOf("v20.10.0", "v24.16.0")
            assertEquals("v20.10.0", NodeExecutableResolver.selectNvmVersion(installed, "v20.10.0\n"))
            assertEquals("v20.10.0", NodeExecutableResolver.selectNvmVersion(installed, "  20.10.0  "))
        }
    }

    @Nested
    inner class NormalizeConfiguredNodePath {
        @Test
        fun `should return null for null input`() {
            assertNull(NodeExecutableResolver.normalizeConfiguredNodePath(null))
        }

        @Test
        fun `should return null for empty or blank input`() {
            assertNull(NodeExecutableResolver.normalizeConfiguredNodePath(""))
            assertNull(NodeExecutableResolver.normalizeConfiguredNodePath("   "))
            assertNull(NodeExecutableResolver.normalizeConfiguredNodePath("\n\t"))
        }

        @Test
        fun `should trim surrounding whitespace from a real path`() {
            assertEquals(
                "/usr/local/bin/node",
                NodeExecutableResolver.normalizeConfiguredNodePath("  /usr/local/bin/node\n"),
            )
        }

        @Test
        fun `should preserve a path that needs no trimming`() {
            assertEquals(
                "/Users/me/.n/bin/node",
                NodeExecutableResolver.normalizeConfiguredNodePath("/Users/me/.n/bin/node"),
            )
        }
    }
}
