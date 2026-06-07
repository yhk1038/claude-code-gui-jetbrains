package com.github.yhk1038.claudecodegui.editor

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.testFramework.LightVirtualFile
import java.util.Collections
import java.util.WeakHashMap
import java.util.concurrent.ConcurrentHashMap

enum class TabBadge {
    NONE,
    UNREAD
}

/**
 * Virtual file backing one Claude Code editor **tab**.
 *
 * [tabId] is the per-tab UUID minted when the tab is opened — it identifies the
 * editor/browser tab, NOT a Claude Code conversation session. The conversation
 * currently shown is tracked separately via [currentPath] (a WebView URL).
 */
class ClaudeCodeVirtualFile(
    val tabId: String,
    val initialPath: String? = null
) : LightVirtualFile("Claude Code", ClaudeCodeFileType, "") {

    // 동적으로 변경 가능한 표시 이름
    @Volatile
    private var displayName: String = "Claude: ${tabId.take(8)}"

    // WebView가 현재 표시 중인 경로 (탭 이동 시 복원용)
    @Volatile
    var currentPath: String? = initialPath

    // Tab badge state for unread notification dot
    @Volatile
    var badgeState: TabBadge = TabBadge.NONE
        private set

    fun setBadge(badge: TabBadge) {
        if (badgeState == badge) return
        badgeState = badge
        // Trigger tab icon refresh by notifying a property change
        VirtualFileManager.getInstance().notifyPropertyChanged(this, PROP_NAME, name, name)
    }

    companion object {
        private const val MAX_DISPLAY_NAME_LENGTH = 20
        private val openTabs = Collections.synchronizedMap(
            WeakHashMap<Project, MutableMap<String, ClaudeCodeVirtualFile>>()
        )

        fun getOrCreate(project: Project, tabId: String, initialPath: String? = null): ClaudeCodeVirtualFile {
            synchronized(openTabs) {
                val projectTabs = openTabs.getOrPut(project) { ConcurrentHashMap() }
                return projectTabs.getOrPut(tabId) { ClaudeCodeVirtualFile(tabId, initialPath) }
            }
        }

        fun isTabOpen(project: Project, tabId: String): Boolean {
            synchronized(openTabs) {
                return openTabs[project]?.containsKey(tabId) == true
            }
        }

        fun removeTab(project: Project, tabId: String) {
            synchronized(openTabs) {
                openTabs[project]?.remove(tabId)
            }
        }
    }

    fun setDisplayName(name: String) {
        val truncated = if (name.length > MAX_DISPLAY_NAME_LENGTH) {
            name.take(MAX_DISPLAY_NAME_LENGTH) + "…"
        } else {
            name
        }
        if (displayName == truncated) return
        val oldName = displayName
        displayName = truncated
        // VirtualFile 변경 알림
        VirtualFileManager.getInstance().notifyPropertyChanged(this, PROP_NAME, oldName, truncated)
    }

    override fun getName(): String = displayName
    override fun getPresentableName(): String = displayName

    override fun isWritable(): Boolean = false
    override fun isValid(): Boolean = true

    override fun equals(other: Any?): Boolean {
        if (other !is ClaudeCodeVirtualFile) return false
        return tabId == other.tabId
    }

    override fun hashCode(): Int = tabId.hashCode()
}
