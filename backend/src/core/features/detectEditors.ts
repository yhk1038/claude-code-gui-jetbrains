import { access } from 'fs/promises';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

export interface EditorInfo {
  id: string;
  label: string;
  isDefault: boolean;
}

interface EditorCandidate {
  id: string;
  label: string;
  appName?: string;       // macOS: /Applications/<appName>.app
  paths?: string[];       // Windows: 알려진 실행 파일 경로
  binary?: string;        // Linux: which로 탐색할 바이너리 이름
  windowsCmd?: string;    // Windows: where 명령으로 탐색할 이름
}

const MAC_CANDIDATES: EditorCandidate[] = [
  { id: 'vscode',   label: 'Visual Studio Code', appName: 'Visual Studio Code' },
  { id: 'cursor',   label: 'Cursor',              appName: 'Cursor' },
  { id: 'sublime',  label: 'Sublime Text',        appName: 'Sublime Text' },
  { id: 'zed',      label: 'Zed',                 appName: 'Zed' },
  { id: 'textmate', label: 'TextMate',            appName: 'TextMate' },
  { id: 'bbedit',   label: 'BBEdit',              appName: 'BBEdit' },
];

const WINDOWS_CANDIDATES: EditorCandidate[] = [
  {
    id: 'vscode',
    label: 'Visual Studio Code',
    paths: [
      `${process.env['LOCALAPPDATA'] ?? ''}\\Programs\\Microsoft VS Code\\Code.exe`,
      `${process.env['PROGRAMFILES'] ?? ''}\\Microsoft VS Code\\Code.exe`,
    ],
    windowsCmd: 'code',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    paths: [
      `${process.env['LOCALAPPDATA'] ?? ''}\\Programs\\cursor\\Cursor.exe`,
    ],
    windowsCmd: 'cursor',
  },
  {
    id: 'sublime',
    label: 'Sublime Text',
    paths: [
      `${process.env['PROGRAMFILES'] ?? 'C:\\Program Files'}\\Sublime Text\\subl.exe`,
    ],
    windowsCmd: 'subl',
  },
  {
    id: 'zed',
    label: 'Zed',
    paths: [
      `${process.env['LOCALAPPDATA'] ?? ''}\\Programs\\Zed\\Zed.exe`,
    ],
    windowsCmd: 'zed',
  },
];

const LINUX_CANDIDATES: EditorCandidate[] = [
  { id: 'vscode',  label: 'Visual Studio Code', binary: 'code' },
  { id: 'cursor',  label: 'Cursor',              binary: 'cursor' },
  { id: 'sublime', label: 'Sublime Text',        binary: 'subl' },
  { id: 'zed',     label: 'Zed',                 binary: 'zed' },
  { id: 'gedit',   label: 'gedit',               binary: 'gedit' },
  { id: 'kate',    label: 'Kate',                binary: 'kate' },
];

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectMacOS(): Promise<EditorInfo[]> {
  const found: EditorInfo[] = [];

  for (const candidate of MAC_CANDIDATES) {
    if (!candidate.appName) continue;
    const appPath = `/Applications/${candidate.appName}.app`;
    const exists = await pathExists(appPath);
    if (exists) {
      found.push({
        id: candidate.id,
        label: candidate.label,
        isDefault: false,
      });
    }
  }

  return found;
}

async function detectWindows(): Promise<EditorInfo[]> {
  const found: EditorInfo[] = [];

  for (const candidate of WINDOWS_CANDIDATES) {
    let exists = false;

    // 알려진 경로로 먼저 확인
    if (candidate.paths && candidate.paths.length > 0) {
      for (const p of candidate.paths) {
        if (await pathExists(p)) {
          exists = true;
          break;
        }
      }
    }

    // 경로 확인 실패 시 where 명령으로 재시도
    if (!exists && candidate.windowsCmd) {
      try {
        await exec(`where ${candidate.windowsCmd}`);
        exists = true;
      } catch {
        exists = false;
      }
    }

    if (exists) {
      found.push({
        id: candidate.id,
        label: candidate.label,
        isDefault: false,
      });
    }
  }

  return found;
}

async function detectLinux(): Promise<EditorInfo[]> {
  const found: EditorInfo[] = [];

  for (const candidate of LINUX_CANDIDATES) {
    if (!candidate.binary) continue;
    try {
      await exec(`which ${candidate.binary}`);
      found.push({
        id: candidate.id,
        label: candidate.label,
        isDefault: false,
      });
    } catch {
      // 바이너리 없음
    }
  }

  return found;
}

export async function detectInstalledEditors(): Promise<EditorInfo[]> {
  const platform = process.platform;

  if (platform === 'darwin') {
    return detectMacOS();
  }

  if (platform === 'win32') {
    return detectWindows();
  }

  // linux, freebsd 등 Unix 계열
  return detectLinux();
}
