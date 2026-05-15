package com.github.yhk1038.claudecodegui.services

import com.github.yhk1038.claudecodegui.toolwindow.ClaudeCodeToolWindowSessionManager
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Injects JavaScript into the pooled JCEF WebView for the given session so React can pick up
 * native-drop paths or IDE-provided composer contexts (mirrors [ClaudeCodePanel] drag-and-drop).
 */
object ClaudeWebViewInjector {

    private val logger = Logger.getInstance(ClaudeWebViewInjector::class.java)

    data class NativeDropEntry(val path: String, val isDirectory: Boolean)

    /**
     * Ensures at least one Claude Code session exists and focuses the active session tab.
     * When the tool window is hidden, it is activated so the user sees attachments/context applied.
     */
    fun prepareActiveSessionForIdeInjection(project: Project): String {
        val tw = ToolWindowManager.getInstance(project).getToolWindow(ClaudeCodeToolWindowSessionManager.TOOL_WINDOW_ID)
        val activateToolWindow = tw?.isVisible != true
        val mgr = ClaudeCodeToolWindowSessionManager.getInstance(project)
        val state = EditorTabStateService.getInstance(project)
        var sessionId = state.getActiveSessionId()
        if (!mgr.hasOpenSessions() || sessionId == null) {
            sessionId = UUID.randomUUID().toString()
        }
        mgr.openSession(sessionId, null, activateToolWindow)
        return sessionId
    }

    fun injectNativeDropEntries(project: Project, sessionId: String, entries: List<NativeDropEntry>) {
        if (entries.isEmpty()) return
        val entriesJson = Json.encodeToString(
            JsonElement.serializer(),
            buildJsonArray {
                entries.forEach { file ->
                    add(buildJsonObject {
                        put("path", file.path)
                        put("type", if (file.isDirectory) "folder" else "file")
                    })
                }
            },
        )
        val js = """
            (function() {
              const entries = $entriesJson;
              window.__CLAUDE_CODE_PENDING_DROP_ENTRIES__ = [
                ...(window.__CLAUDE_CODE_PENDING_DROP_ENTRIES__ || []),
                ...entries
              ];
              window.dispatchEvent(new CustomEvent('claude-code:native-drop-paths', {
                detail: { entries }
              }));
              setTimeout(function() {
                window.dispatchEvent(new CustomEvent('claude-code:native-drop-paths', {
                  detail: { entries }
                }));
              }, 100);
              setTimeout(function() {
                window.dispatchEvent(new CustomEvent('claude-code:native-drop-paths', {
                  detail: { entries }
                }));
              }, 500);
            })();
        """.trimIndent()
        executeJavaScript(project, sessionId, js)
    }

    fun injectComposerContexts(project: Project, sessionId: String, contexts: JsonArray) {
        if (contexts.isEmpty()) return
        val contextsJson = Json.encodeToString(JsonElement.serializer(), contexts)
        val js = """
            (function() {
              const contexts = $contextsJson;
              window.__CLAUDE_CODE_PENDING_COMPOSER_CONTEXTS__ = [
                ...(window.__CLAUDE_CODE_PENDING_COMPOSER_CONTEXTS__ || []),
                ...contexts
              ];
              const detail = { contexts: contexts };
              window.dispatchEvent(new CustomEvent('claude-code:ide-composer-context', {
                detail: detail
              }));
              setTimeout(function() {
                window.dispatchEvent(new CustomEvent('claude-code:ide-composer-context', { detail: detail }));
              }, 100);
              setTimeout(function() {
                window.dispatchEvent(new CustomEvent('claude-code:ide-composer-context', { detail: detail }));
              }, 500);
            })();
        """.trimIndent()
        executeJavaScript(project, sessionId, js)
    }

    private fun executeJavaScript(project: Project, sessionId: String, js: String) {
        ApplicationManager.getApplication().invokeLater {
            try {
                val holder = ClaudeCodeBrowserService.getInstance(project).getOrCreate(sessionId)
                holder.injectIdeJavaScriptWhenReady(js)
            } catch (e: Exception) {
                logger.warn("Failed to inject JS into WebView for session $sessionId", e)
            }
        }
    }
}
