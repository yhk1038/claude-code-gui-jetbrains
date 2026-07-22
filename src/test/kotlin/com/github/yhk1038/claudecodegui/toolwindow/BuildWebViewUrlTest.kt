package com.github.yhk1038.claudecodegui.toolwindow

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class BuildWebViewUrlTest {

    @Nested
    inner class ThemeParam {
        @Test
        fun `includes theme=dark when isBright is false`() {
            val url = buildWebViewUrl(
                port = 1234,
                pathSegment = "/sessions/new",
                workingDir = null,
                panelId = "p1",
                isBright = false,
            )
            assertTrue(url.contains("theme=dark"), "expected theme=dark in: $url")
            assertFalse(url.contains("theme=light"))
        }

        @Test
        fun `includes theme=light when isBright is true`() {
            val url = buildWebViewUrl(
                port = 1234,
                pathSegment = "/sessions/new",
                workingDir = null,
                panelId = "p1",
                isBright = true,
            )
            assertTrue(url.contains("theme=light"), "expected theme=light in: $url")
            assertFalse(url.contains("theme=dark"))
        }
    }

    @Nested
    inner class UrlStructure {
        @Test
        fun `builds full url with host port and path`() {
            val url = buildWebViewUrl(
                port = 63342,
                pathSegment = "/sessions/new",
                workingDir = null,
                panelId = "p1",
                isBright = true,
            )
            assertTrue(url.startsWith("http://localhost:63342/sessions/new?"), "got: $url")
        }

        @Test
        fun `omits workingDir param when workingDir is null`() {
            val url = buildWebViewUrl(
                port = 1,
                pathSegment = "/sessions/new",
                workingDir = null,
                panelId = "p1",
                isBright = true,
            )
            assertFalse(url.contains("workingDir="), "got: $url")
        }

        @Test
        fun `includes encoded workingDir when provided`() {
            val url = buildWebViewUrl(
                port = 1,
                pathSegment = "/sessions/new",
                workingDir = "/Users/me/My Project",
                panelId = "p1",
                isBright = true,
            )
            assertTrue(url.contains("workingDir=%2FUsers%2Fme%2FMy+Project"), "got: $url")
        }

        @Test
        fun `includes encoded panelId`() {
            val url = buildWebViewUrl(
                port = 1,
                pathSegment = "/sessions/new",
                workingDir = null,
                panelId = "panel id/with-special",
                isBright = true,
            )
            assertTrue(url.contains("panelId=panel+id%2Fwith-special"), "got: $url")
        }

        @Test
        fun `joins all params with ampersand in order workingDir panelId theme`() {
            val url = buildWebViewUrl(
                port = 9,
                pathSegment = "/sessions/new",
                workingDir = "/tmp",
                panelId = "p1",
                isBright = false,
            )
            assertEquals(
                "http://localhost:9/sessions/new?workingDir=%2Ftmp&panelId=p1&theme=dark",
                url,
            )
        }

        @Test
        fun `respects custom path segment`() {
            val url = buildWebViewUrl(
                port = 9,
                pathSegment = "/sessions/abc",
                workingDir = null,
                panelId = "p1",
                isBright = false,
            )
            assertTrue(url.startsWith("http://localhost:9/sessions/abc?"), "got: $url")
        }
    }

    @Nested
    inner class PairParam {
        @Test
        fun `omits pair param when pairCode is null`() {
            val url = buildWebViewUrl(
                port = 1,
                pathSegment = "/sessions/new",
                workingDir = null,
                panelId = "p1",
                isBright = true,
                pairCode = null,
            )
            assertFalse(url.contains("pair="), "got: $url")
        }

        @Test
        fun `omits pair param when pairCode is blank`() {
            val url = buildWebViewUrl(
                port = 1,
                pathSegment = "/sessions/new",
                workingDir = null,
                panelId = "p1",
                isBright = true,
                pairCode = "  ",
            )
            assertFalse(url.contains("pair="), "got: $url")
        }

        @Test
        fun `never emits a token param even when a pair code is present`() {
            val url = buildWebViewUrl(
                port = 9,
                pathSegment = "/sessions/new",
                workingDir = "/tmp",
                panelId = "p1",
                isBright = false,
                pairCode = "abc123",
            )
            assertFalse(url.contains("token="), "the auth token must never appear in the URL: $url")
        }

        @Test
        fun `appends pair as the last param after theme`() {
            val url = buildWebViewUrl(
                port = 9,
                pathSegment = "/sessions/new",
                workingDir = "/tmp",
                panelId = "p1",
                isBright = false,
                pairCode = "abc123",
            )
            assertEquals(
                "http://localhost:9/sessions/new?workingDir=%2Ftmp&panelId=p1&theme=dark&pair=abc123",
                url,
            )
        }

        @Test
        fun `url-encodes the pair code`() {
            val url = buildWebViewUrl(
                port = 9,
                pathSegment = "/sessions/new",
                workingDir = null,
                panelId = "p1",
                isBright = false,
                pairCode = "a+b/c=",
            )
            assertTrue(url.contains("pair=a%2Bb%2Fc%3D"), "got: $url")
        }
    }

    @Nested
    inner class RedactUrlSecrets {
        @Test
        fun `redacts pair value when present`() {
            val redacted = redactUrlSecrets(
                "http://localhost:9/sessions/new?workingDir=%2Ftmp&panelId=p1&theme=dark&pair=deadbeef",
            )
            assertEquals(
                "http://localhost:9/sessions/new?workingDir=%2Ftmp&panelId=p1&theme=dark&pair=<redacted>",
                redacted,
            )
        }

        @Test
        fun `redacts token value when present`() {
            val redacted = redactUrlSecrets(
                "http://localhost:9/sessions/new?workingDir=%2Ftmp&panelId=p1&theme=dark&token=deadbeef",
            )
            assertEquals(
                "http://localhost:9/sessions/new?workingDir=%2Ftmp&panelId=p1&theme=dark&token=<redacted>",
                redacted,
            )
        }

        @Test
        fun `redacts pair when it is the first query param`() {
            val redacted = redactUrlSecrets("http://localhost:9/?pair=secret&foo=bar")
            assertEquals("http://localhost:9/?pair=<redacted>&foo=bar", redacted)
        }

        @Test
        fun `leaves urls without a secret untouched`() {
            val url = "http://localhost:9/sessions/new?workingDir=%2Ftmp&panelId=p1&theme=dark"
            assertEquals(url, redactUrlSecrets(url))
        }
    }
}
