package com.github.yhk1038.claudecodegui.services

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Tests for [pathMatchesBase] — the cross-platform path prefix matcher used by
 * CompositeRpcHandler to route RPC calls to the correct project handler.
 */
class PathMatchesBaseTest {

    @Nested
    inner class NormalCases {
        @Test
        fun `exact match returns true`() {
            assertTrue(pathMatchesBase("/home/user/project/src/file.ts", "/home/user/project"))
        }

        @Test
        fun `path under basePath returns true`() {
            assertTrue(pathMatchesBase("/home/user/project/src/deep/file.kt", "/home/user/project"))
        }

        @Test
        fun `basePath with trailing slash matches`() {
            assertTrue(pathMatchesBase("/home/user/project/file.ts", "/home/user/project/"))
        }
    }

    @Nested
    inner class SegmentBoundary {
        @Test
        fun `sibling prefix does not match — foobar is not under foo`() {
            // /foobar/x must NOT match basePath /foo
            assertFalse(pathMatchesBase("/foobar/x/file.ts", "/foo"))
        }

        @Test
        fun `sibling prefix does not match — project2 is not under project`() {
            assertFalse(pathMatchesBase("/home/user/project2/file.ts", "/home/user/project"))
        }

        @Test
        fun `exact basePath path itself matches`() {
            // path == basePath (no trailing content) should match
            assertTrue(pathMatchesBase("/home/user/project", "/home/user/project"))
        }
    }

    @Nested
    inner class SeparatorNormalization {
        @Test
        fun `backslash separators in path are normalized to forward slash`() {
            // Windows-style path from backend
            assertTrue(pathMatchesBase("C:\\Projects\\MyApp\\src\\file.ts", "C:/Projects/MyApp"))
        }

        @Test
        fun `backslash separators in basePath are normalized to forward slash`() {
            assertTrue(pathMatchesBase("C:/Projects/MyApp/src/file.ts", "C:\\Projects\\MyApp"))
        }

        @Test
        fun `both backslash normalized correctly`() {
            assertTrue(pathMatchesBase("C:\\Projects\\MyApp\\src\\file.ts", "C:\\Projects\\MyApp"))
        }

        @Test
        fun `mixed separators in path do not break boundary check`() {
            // Ensure /foo is not matched by /foobar even with trailing backslash
            assertFalse(pathMatchesBase("C:\\Projects\\MyAppExtra\\file.ts", "C:/Projects/MyApp"))
        }
    }

    @Nested
    inner class CaseInsensitiveEnvironment {
        /**
         * These tests exercise the case-insensitive branch.
         * On a real CI machine (Linux, case-sensitive FS) the function may fall back
         * to case-sensitive comparison; we verify both behaviours are consistent with
         * what [pathMatchesBase] promises for the supplied [caseSensitive] override.
         */

        @Test
        fun `uppercase drive letter in path matches lowercase basePath when case-insensitive`() {
            assertTrue(
                pathMatchesBase(
                    path = "C:/Projects/MyApp/src/file.ts",
                    basePath = "c:/projects/myapp",
                    caseSensitive = false
                )
            )
        }

        @Test
        fun `mixed case path matches lowercase basePath when case-insensitive`() {
            assertTrue(
                pathMatchesBase(
                    path = "C:/Proj/File.ts",
                    basePath = "c:/proj",
                    caseSensitive = false
                )
            )
        }

        @Test
        fun `case mismatch does NOT match when case-sensitive`() {
            assertFalse(
                pathMatchesBase(
                    path = "C:/Proj/File.ts",
                    basePath = "c:/proj",
                    caseSensitive = true
                )
            )
        }

        @Test
        fun `segment boundary still respected in case-insensitive mode`() {
            // /FOOBAR/x must NOT match basePath /foo even case-insensitively
            assertFalse(
                pathMatchesBase(
                    path = "/FOOBAR/x/file.ts",
                    basePath = "/foo",
                    caseSensitive = false
                )
            )
        }

        @Test
        fun `backslash plus case mismatch normalized correctly in case-insensitive mode`() {
            assertTrue(
                pathMatchesBase(
                    path = "C:\\Proj\\file.ts",
                    basePath = "c:/proj",
                    caseSensitive = false
                )
            )
        }
    }

    @Nested
    inner class Regression {
        @Test
        fun `Linux absolute path still works case-sensitively`() {
            assertTrue(pathMatchesBase("/home/alice/project/main.kt", "/home/alice/project"))
        }

        @Test
        fun `different projects do not cross-match`() {
            assertFalse(pathMatchesBase("/home/alice/projectA/file.ts", "/home/alice/projectB"))
        }
    }
}
