export enum IdeAdapterType {
  JETBRAINS = 'jetbrains',
  BROWSER = 'browser',
}

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
  readonly type: IdeAdapterType;

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
   * Check if the adapter is ready to use
   */
  isReady(): boolean;
}
