package com.github.yhk1038.claudecodegui.editor

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.testFramework.LightVirtualFile
import java.util.Collections
import java.util.WeakHashMap
import java.util.concurrent.ConcurrentHashMap

class ClaudeCodeVirtualFile(
    val sessionId: String,
    val initialPath: String? = null
) : LightVirtualFile("Claude Code", ClaudeCodeFileType, "") {

    // 동적으로 변경 가능한 표시 이름
    @Volatile
    private var displayName: String = "Claude: ${sessionId.take(8)}"

    companion object {
        private val openSessions = Collections.synchronizedMap(
            WeakHashMap<Project, MutableMap<String, ClaudeCodeVirtualFile>>()
        )

        fun getOrCreate(project: Project, sessionId: String, initialPath: String? = null): ClaudeCodeVirtualFile {
            synchronized(openSessions) {
                val projectSessions = openSessions.getOrPut(project) { ConcurrentHashMap() }
                return projectSessions.getOrPut(sessionId) { ClaudeCodeVirtualFile(sessionId, initialPath) }
            }
        }

        fun isSessionOpen(project: Project, sessionId: String): Boolean {
            synchronized(openSessions) {
                return openSessions[project]?.containsKey(sessionId) == true
            }
        }

        fun removeSession(project: Project, sessionId: String) {
            synchronized(openSessions) {
                openSessions[project]?.remove(sessionId)
            }
        }
    }

    fun setDisplayName(name: String) {
        if (displayName == name) return  // 같은 값이면 무시
        val oldName = displayName
        displayName = name
        // VirtualFile 변경 알림
        VirtualFileManager.getInstance().notifyPropertyChanged(this, PROP_NAME, oldName, name)
    }

    override fun getName(): String = displayName
    override fun getPresentableName(): String = displayName

    override fun isWritable(): Boolean = false
    override fun isValid(): Boolean = true

    override fun equals(other: Any?): Boolean {
        if (other !is ClaudeCodeVirtualFile) return false
        return sessionId == other.sessionId
    }

    override fun hashCode(): Int = sessionId.hashCode()
}
