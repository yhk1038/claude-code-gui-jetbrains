package com.github.yhk1038.claudecodegui.services

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class SelectKillablePidsTest {

    @Test
    fun `parses one PID per line`() {
        assertEquals(listOf(123L, 456L), selectKillablePids("123\n456", 999L))
    }

    @Test
    fun `excludes our own PID so the IDE never kills itself`() {
        assertEquals(listOf(123L, 456L), selectKillablePids("123\n777\n456", 777L))
    }

    @Test
    fun `ignores blank lines and surrounding whitespace`() {
        assertEquals(listOf(123L, 456L), selectKillablePids("  123 \n\n  456\n", 999L))
    }

    @Test
    fun `drops non-numeric and non-positive values`() {
        assertEquals(listOf(123L), selectKillablePids("abc\n0\n-5\n123", 999L))
    }

    @Test
    fun `returns empty list for empty input`() {
        assertEquals(emptyList<Long>(), selectKillablePids("", 999L))
        assertEquals(emptyList<Long>(), selectKillablePids("   \n  ", 999L))
    }

    @Test
    fun `de-duplicates repeated PIDs`() {
        assertEquals(listOf(123L, 456L), selectKillablePids("123\n123\n456", 999L))
    }
}
