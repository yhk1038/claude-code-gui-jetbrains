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
  newSession(): Promise<void>;
  openSettings(): Promise<void>;
}
