package com.github.yhk1038.claudecodegui.bridge

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class PermissionModeTest {

    @Test
    fun `fromInputMode should return PLAN for plan`() {
        val result = PermissionMode.fromInputMode("plan")
        assertEquals(PermissionMode.PLAN, result)
        assertEquals("plan", result?.cliFlag)
    }

    @Test
    fun `fromInputMode should return BYPASS for bypass`() {
        val result = PermissionMode.fromInputMode("bypass")
        assertEquals(PermissionMode.BYPASS, result)
        assertEquals("bypassPermissions", result?.cliFlag)
    }

    @Test
    fun `fromInputMode should return ASK_BEFORE_EDIT for ask_before_edit`() {
        val result = PermissionMode.fromInputMode("ask_before_edit")
        assertEquals(PermissionMode.ASK_BEFORE_EDIT, result)
        assertEquals("default", result?.cliFlag)
    }

    @Test
    fun `fromInputMode should return AUTO_EDIT for auto_edit`() {
        val result = PermissionMode.fromInputMode("auto_edit")
        assertEquals(PermissionMode.AUTO_EDIT, result)
        assertEquals("acceptEdits", result?.cliFlag)
    }

    @Test
    fun `fromInputMode should return null for unknown input`() {
        assertNull(PermissionMode.fromInputMode("invalid"))
        assertNull(PermissionMode.fromInputMode(""))
        assertNull(PermissionMode.fromInputMode("PLAN"))
    }

    @Test
    fun `fromInputMode should return null for null input`() {
        assertNull(PermissionMode.fromInputMode(null))
    }

    @Test
    fun `all entries should have unique inputMode values`() {
        val inputModes = PermissionMode.entries.map { it.inputMode }
        assertEquals(inputModes.size, inputModes.toSet().size)
    }

    @Test
    fun `all entries should have unique cliFlag values`() {
        val cliFlags = PermissionMode.entries.map { it.cliFlag }
        assertEquals(cliFlags.size, cliFlags.toSet().size)
    }
}
