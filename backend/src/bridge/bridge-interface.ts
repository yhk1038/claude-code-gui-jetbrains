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
}
