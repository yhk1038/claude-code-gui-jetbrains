import { execFile, exec } from 'child_process';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

function openFolderDialogMac(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-e', 'POSIX path of (choose folder with prompt "Select a project folder")'],
      (err, stdout, _stderr) => {
        if (err) {
          // exit code 1 means user cancelled
          if (err.code === 1) {
            resolve(null);
          } else {
            reject(err);
          }
          return;
        }
        const path = stdout.trim();
        resolve(path.length > 0 ? path : null);
      },
    );
  });
}

function openFolderDialogLinux(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    exec(
      'zenity --file-selection --directory --title="Select a project folder"',
      (err, stdout, _stderr) => {
        if (err) {
          if (err.code === 1) {
            // user cancelled
            resolve(null);
            return;
          }
          // zenity not available, try kdialog
          exec(
            'kdialog --getexistingdirectory',
            (err2, stdout2, _stderr2) => {
              if (err2) {
                if (err2.code === 1) {
                  resolve(null);
                } else {
                  reject(err2);
                }
                return;
              }
              const path = stdout2.trim();
              resolve(path.length > 0 ? path : null);
            },
          );
          return;
        }
        const path = stdout.trim();
        resolve(path.length > 0 ? path : null);
      },
    );
  });
}

function openFolderDialogWindows(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$f = New-Object System.Windows.Forms.FolderBrowserDialog;',
      '$f.ShowDialog() | Out-Null;',
      '$f.SelectedPath',
    ].join(' ');
    exec(`powershell -Command "${script}"`, (err, stdout, _stderr) => {
      if (err) {
        reject(err);
        return;
      }
      const path = stdout.trim();
      resolve(path.length > 0 ? path : null);
    });
  });
}

export async function openFolderDialogHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  try {
    let selectedPath: string | null = null;

    if (process.platform === 'darwin') {
      selectedPath = await openFolderDialogMac();
    } else if (process.platform === 'linux') {
      selectedPath = await openFolderDialogLinux();
    } else if (process.platform === 'win32') {
      selectedPath = await openFolderDialogWindows();
    } else {
      connections.sendTo(connectionId, 'ERROR', {
        message: `Unsupported platform: ${process.platform}`,
      });
      return;
    }

    connections.sendTo(connectionId, 'FOLDER_SELECTED', { path: selectedPath });
  } catch (err) {
    connections.sendTo(connectionId, 'ERROR', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
