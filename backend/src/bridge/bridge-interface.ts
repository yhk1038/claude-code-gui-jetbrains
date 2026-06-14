export interface Bridge {
  openFile(path: string): Promise<void>;
  openDiff(params: {
    filePath: string;
    oldContent: string;
    newContent: string;
    toolUseId?: string;
  }): Promise<void>;
  applyDiff(params: {
    filePath: string;
    newContent: string;
    toolUseId?: string;
  }): Promise<{ applied: boolean }>;
  rejectDiff(params: { toolUseId?: string }): Promise<void>;
  /**
   * Ask the IDE host to reload the given files from disk. Used after the CLI
   * edits files directly, so open editor tabs reflect the new content even when
   * the IDE's native filesystem watcher misses the change (e.g. on Windows).
   */
  refreshFiles(params: { paths: string[] }): Promise<void>;
  createSession(workingDir?: string): Promise<void>;
  openNewTab(workingDir?: string): Promise<void>;
  openSettings(workingDir?: string): Promise<void>;
  openTerminal(workingDir: string): Promise<void>;
  openUrl(url: string): Promise<void>;
  pickFiles(options: {
    mode: 'files' | 'folders' | 'both';
    multiple?: boolean;
  }): Promise<{ paths: string[] }>;
  updatePlugin(): Promise<void>;
  requiresRestart(): Promise<boolean>;
  /**
   * Returns the IDE project root that contains [workingDir], or null when the
   * host has no IDE context (browser mode). The WebView uses this as the
   * ancestor cap in the working-directory dropdown so a user cannot navigate
   * above the IDE project they are inside.
   */
  getIdeRoot(workingDir?: string): Promise<string | null>;
  /**
   * Show a host-native desktop notification. Used for "agent needs your
   * attention" / "response complete" events when the webview cannot raise its
   * own browser notification (JCEF has no Notification API). In browser mode the
   * webview shows the notification itself, so this is a no-op there.
   *
   * [workingDir] routes the request to the IDE host serving that project root
   * when several IDEs share one backend; [panelId] then selects the exact panel
   * (session tab) inside that IDE so the notification — and its "Open session"
   * action — target the right tab.
   *
   * Returns whether the IDE balloon was shown (false when suppressed because the
   * user is viewing the session) and whether the IDE window was focused. The
   * caller raises a real OS notification when the IDE is NOT focused, since an
   * in-IDE balloon is hidden behind other apps then.
   */
  showNotification(params: {
    title: string;
    body: string;
    workingDir?: string;
    panelId?: string;
  }): Promise<{ shown: boolean; ideFocused: boolean }>;
}
