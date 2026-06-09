package com.github.yhk1038.claudecodegui.bridge

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class WslPathResolverTest {

    @Nested
    inner class IsWslUncPath {
        @Test
        fun `recognizes modern wsl_localhost prefix`() {
            assertTrue(WslPathResolver.isWslUncPath("\\\\wsl.localhost\\Ubuntu\\home\\user"))
        }

        @Test
        fun `recognizes legacy wsl dollar prefix`() {
            assertTrue(WslPathResolver.isWslUncPath("\\\\wsl\$\\Ubuntu\\home\\user"))
        }

        @Test
        fun `matches host case-insensitively`() {
            assertTrue(WslPathResolver.isWslUncPath("\\\\WSL.LOCALHOST\\Ubuntu\\home"))
        }

        @Test
        fun `rejects ordinary windows and linux paths`() {
            assertFalse(WslPathResolver.isWslUncPath("C:\\Users\\foo"))
            assertFalse(WslPathResolver.isWslUncPath("/home/user/proj"))
            assertFalse(WslPathResolver.isWslUncPath("\\\\some-server\\share"))
        }

        @Test
        fun `rejects null and blank`() {
            assertFalse(WslPathResolver.isWslUncPath(null))
            assertFalse(WslPathResolver.isWslUncPath(""))
            assertFalse(WslPathResolver.isWslUncPath("   "))
        }
    }

    @Nested
    inner class ParseUncPath {
        @Test
        fun `extracts distro and linux path from modern prefix`() {
            val loc = WslPathResolver.parseUncPath("\\\\wsl.localhost\\Ubuntu\\home\\user\\proj")
            assertNotNull(loc)
            assertEquals("Ubuntu", loc!!.distro)
            assertEquals("/home/user/proj", loc.linuxPath)
        }

        @Test
        fun `extracts distro and linux path from legacy prefix`() {
            val loc = WslPathResolver.parseUncPath("\\\\wsl\$\\NixOS\\home\\maicol07")
            assertNotNull(loc)
            assertEquals("NixOS", loc!!.distro)
            assertEquals("/home/maicol07", loc.linuxPath)
        }

        @Test
        fun `preserves distro casing`() {
            val loc = WslPathResolver.parseUncPath("\\\\WSL.LOCALHOST\\Ubuntu-22.04\\srv\\app")
            assertNotNull(loc)
            assertEquals("Ubuntu-22.04", loc!!.distro)
            assertEquals("/srv/app", loc.linuxPath)
        }

        @Test
        fun `returns distro root when no inner path`() {
            val loc = WslPathResolver.parseUncPath("\\\\wsl.localhost\\Ubuntu")
            assertNotNull(loc)
            assertEquals("Ubuntu", loc!!.distro)
            assertEquals("/", loc.linuxPath)
        }

        @Test
        fun `returns null for non-wsl paths`() {
            assertNull(WslPathResolver.parseUncPath("C:\\Users\\foo"))
            assertNull(WslPathResolver.parseUncPath("/home/user"))
            assertNull(WslPathResolver.parseUncPath(null))
        }
    }

    @Nested
    inner class ToWslPath {
        @Test
        fun `converts drive path to mnt`() {
            assertEquals("/mnt/c/Users/foo/bar", WslPathResolver.toWslPath("C:\\Users\\foo\\bar"))
            assertEquals("/mnt/d/work", WslPathResolver.toWslPath("D:\\work"))
        }

        @Test
        fun `converts drive path without separator after colon`() {
            assertEquals("/mnt/c/Users/foo", WslPathResolver.toWslPath("C:Users\\foo"))
        }

        @Test
        fun `converts bare drive root`() {
            assertEquals("/mnt/c", WslPathResolver.toWslPath("C:\\"))
            assertEquals("/mnt/c", WslPathResolver.toWslPath("C:"))
        }

        @Test
        fun `converts wsl unc path to inner linux path`() {
            assertEquals("/home/user/proj", WslPathResolver.toWslPath("\\\\wsl.localhost\\Ubuntu\\home\\user\\proj"))
            assertEquals("/home/maicol07", WslPathResolver.toWslPath("\\\\wsl\$\\NixOS\\home\\maicol07"))
        }

        @Test
        fun `leaves linux path unchanged`() {
            assertEquals("/home/user/proj", WslPathResolver.toWslPath("/home/user/proj"))
        }

        @Test
        fun `null and blank pass through`() {
            assertNull(WslPathResolver.toWslPath(null))
            assertEquals("", WslPathResolver.toWslPath(""))
        }

        @Test
        fun `falls back to slash normalization for relative paths`() {
            assertEquals("foo/bar", WslPathResolver.toWslPath("foo\\bar"))
        }
    }
}
