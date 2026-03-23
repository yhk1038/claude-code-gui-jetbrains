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
   * Check if the adapter is ready to use
   */
  isReady(): boolean;
}
