import type { ChildProcess } from 'child_process';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { Claude } from '../claude';

// In-flight `claude auth login` processes, keyed by the webview connection that
// started them. Kept so a later SUBMIT_LOGIN_CODE message can write the pasted
// OAuth code to the right process's stdin. Issue #57.
const activeLoginChildren = new Map<string, ChildProcess>();

export function loginHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  return new Promise((resolve) => {
    // Map the webview-selected login method to the CLI flag. The default
    // (`claude auth login` with no flag) is the Claude subscription flow, so an
    // unknown/missing method falls back to --claudeai. Previously the method was
    // dropped entirely, so "Anthropic Console" always ran the subscription flow.
    const method = message.payload?.method as string | undefined;
    const methodFlag = method === 'console' ? '--console' : '--claudeai';

    // stdin stays open ('pipe') so we can feed back the OAuth code the user pastes
    // after signing in (see submitLoginCode).
    const child = Claude.spawn(['auth', 'login', methodFlag], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    activeLoginChildren.set(connectionId, child);

    let buf = '';
    let urlOpened = false;
    let codeRequested = false;
    const scan = (chunk: Buffer): void => {
      buf += chunk.toString();

      // (1) claude tries to open the browser itself, but where it can't find an
      // opener it silently prints "visit: <url>" and waits — e.g. WSL with
      // appendWindowsPath=false (no xdg-open/cmd/explorer on PATH; claude ignores
      // $BROWSER), where the user got an endless spinner and no browser. Capture the
      // OAuth URL and open it through the IDE (BrowserUtil.browse on the Windows
      // side). Issue #57.
      if (!urlOpened) {
        const match = buf.match(/https:\/\/[^\s]*\/oauth\/authorize[^\s]*/);
        if (match) {
          urlOpened = true;
          console.error('[login] opening OAuth URL via IDE:', match[0]);
          bridge.openUrl(match[0]).catch((err) => {
            console.error('[login] bridge.openUrl failed:', err);
          });
        }
      }

      // (2) When the flow can't auto-complete via a local callback, the CLI prints
      // the post-sign-in code prompt ("Paste code here ...") and waits on stdin. This
      // prompt does NOT appear for every user/flow, so we tell the webview to reveal
      // an OPTIONAL code-input field only once we actually observe it. Issue #57.
      if (!codeRequested && /paste code/i.test(buf)) {
        codeRequested = true;
        console.error('[login] CLI is prompting for an OAuth code; asking webview to show input');
        connections.sendTo(connectionId, 'LOGIN_CODE_REQUIRED', {
          requestId: message.requestId,
        });
      }
    };
    child.stdout?.on('data', scan);
    child.stderr?.on('data', scan);

    const cleanup = (): void => {
      if (activeLoginChildren.get(connectionId) === child) {
        activeLoginChildren.delete(connectionId);
      }
    };

    child.on('close', (code) => {
      cleanup();
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: code === 0 ? 'ok' : 'error',
        ...(code !== 0 && { error: 'Login failed or cancelled' }),
      });
      resolve();
    });

    child.on('error', (err) => {
      cleanup();
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'error',
        error: err.message,
      });
      resolve();
    });
  });
}

/**
 * Feed the OAuth code the user pasted in the webview to the in-flight
 * `claude auth login` process for [connectionId]. Returns false when there is no
 * such process or its stdin is no longer writable. Issue #57.
 */
export function submitLoginCode(connectionId: string, code: string): boolean {
  const child = activeLoginChildren.get(connectionId);
  if (!child?.stdin?.writable) return false;
  child.stdin.write(code.trim() + '\n');
  return true;
}

/**
 * Kill the in-flight `claude auth login` process for [connectionId], if any, and
 * forget it. Called when the webview connection drops: an interactive login that
 * is still waiting on stdin (e.g. the "paste code" prompt) never closes on its
 * own, so without this it would linger as a zombie. Returns false when there was
 * no such process.
 */
export function cancelLogin(connectionId: string): boolean {
  const child = activeLoginChildren.get(connectionId);
  if (!child) return false;
  activeLoginChildren.delete(connectionId);
  child.kill();
  return true;
}
