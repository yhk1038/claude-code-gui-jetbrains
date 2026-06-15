package com.github.yhk1038.claudecodegui.toolwindow.realization

/**
 * The sequential phases shown in the panel's placeholder label while the JCEF browser
 * is not yet realized. Each phase carries an English [message] string suitable for
 * display directly in the UI.
 */
enum class LoadingPhase(val message: String) {
    INDEXING_WAIT("Waiting for project indexing..."),
    BACKEND_START("Starting backend..."),
    // Fine-grained backend-start sub-phases, emitted from NodeProcessManager.start()
    // so the placeholder reflects real progress instead of a single frozen line while
    // node discovery / shell-PATH capture / resource extraction run (issue #97).
    LOCATING_NODE("Locating Node.js..."),
    PREPARING_BACKEND("Preparing backend files..."),
    WAITING_FOR_PORT("Waiting for backend to be ready..."),
}
