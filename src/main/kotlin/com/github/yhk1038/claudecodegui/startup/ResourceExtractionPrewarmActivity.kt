package com.github.yhk1038.claudecodegui.startup

import com.github.yhk1038.claudecodegui.services.NodeBackendService
import com.intellij.ide.ApplicationInitializedListener
import kotlinx.coroutines.CoroutineScope

/**
 * Prewarms plugin resource extraction at application initialization.
 *
 * The plugin's webview/backend resources are extracted from the JAR once per
 * (IDE product, plugin version) by [NodeBackendService]. Kicking that off here means an
 * IDE restart — which the plugin already requires after an update — is the natural moment
 * the extraction happens, so by the time a panel opens the shared extraction gate is
 * usually already complete and backend start doesn't wait on disk IO. See issue #149.
 *
 * This is only a prewarm: the gate is LAZY and self-heals on first use, so extraction
 * still runs correctly even when this listener doesn't (e.g. a dynamic plugin reload).
 *
 * `execute(CoroutineScope)` is the non-deprecated, non-internal entry point
 * ([ApplicationInitializedListener.componentsInitialized] is `@Deprecated`); it runs off
 * the EDT so the blocking extraction inside [NodeBackendService.prewarmResources] (itself
 * dispatched to IO) never touches the UI thread.
 */
class ResourceExtractionPrewarmActivity : ApplicationInitializedListener {
    override suspend fun execute(asyncScope: CoroutineScope) {
        NodeBackendService.getInstance().prewarmResources()
    }
}
