import { ClientEnv } from '../shared';

/**
 * @deprecated Use ClientEnv from shared instead
 */
export const IdeAdapterType = ClientEnv;
export type IdeAdapterType = ClientEnv;

/**
 * IDE Adapter Interface
 *
 * Abstracts IDE-specific operations so the WebView can work
 * in both JetBrains IDE and browser environments.
 */
export interface IdeAdapter {
  /**
   * The type of environment this adapter handles
   */
  readonly type: ClientEnv;

  /**
   * Open a new tab/window
   * - In JetBrains: Opens a new editor tab via Kotlin bridge
   * - In Browser: Opens a new browser tab
   */
  openNewTab(): Promise<void>;

  /**
   * Open an existing session in a new tab/window
   * - In JetBrains: Opens a new editor tab navigated to the session via Kotlin bridge
   * - In Browser: Opens a new browser tab at the session route
   */
  openSession(sessionId: string): Promise<void>;

  /**
   * Open settings in a new tab/window
   * - In JetBrains: Opens a new editor tab navigated to settings
   * - In Browser: Opens a new browser tab with settings hash
   */
  openSettings(): Promise<void>;

  /**
   * Open a file in the IDE editor
   * - In JetBrains: Opens the file in the IDE editor via Kotlin bridge
   * - In Browser: Logs the file path (cannot open local files)
   */
  openFile(filePath: string): Promise<void>;

  /**
   * Open Claude in an external terminal
   * - In JetBrains: Opens Claude in the IDE's built-in terminal
   * - In Browser: Opens the configured terminal app and runs claude
   */
  openTerminal(workingDir: string): Promise<void>;

  /**
   * Open a URL in an external browser
   * - In JetBrains: Delegates to Node.js backend which calls the bridge
   * - In Browser: Opens the URL in a new tab
   */
  openUrl(url: string): Promise<void>;

  /**
   * Trigger a backend restart.
   * - In JetBrains: Sends RESTART_BACKEND so the backend exits with the unified
   *   restart code and the IDE respawns it.
   * - In Browser: Same — sends RESTART_BACKEND so the backend restarts itself.
   * Behaves identically in both runtimes; no environment-specific branching.
   */
  restartBackend(): Promise<void>;

  /**
   * Check if the adapter is ready to use
   */
  isReady(): boolean;
}
