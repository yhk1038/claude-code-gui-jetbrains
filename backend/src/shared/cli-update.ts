/**
 * Shared types for Claude Code CLI version detection + updating.
 *
 * NOTE: This file is mirrored 1:1 in `webview/src/shared/cli-update.ts`.
 * Any edit here MUST be copied there (see `shared/CLAUDE.md`).
 */

/**
 * How the running `claude` binary was installed, inferred from its resolved path.
 *
 * Only values the path-based detector can actually produce are listed. System
 * package managers (apt/dnf/apk) install to `/usr/bin` and cannot be told apart
 * from a bare path — and they need sudo to update anyway — so they fall under
 * UNKNOWN, which yields no update affordance (same safe outcome).
 */
export enum PackageManager {
  NPM = 'npm',
  PNPM = 'pnpm',
  YARN = 'yarn',
  VOLTA = 'volta',
  /** Claude's own native installer (curl/irm → ~/.local/bin). Updates via `claude update`. */
  NATIVE = 'native',
  /** Homebrew cask (claude-code / claude-code@latest). Updates via `brew upgrade`. */
  HOMEBREW = 'homebrew',
  /** Windows WinGet package (Anthropic.ClaudeCode). Updates via `winget upgrade`. */
  WINGET = 'winget',
  /** Undetectable / system-managed / needs sudo → no non-interactive update path. */
  UNKNOWN = 'unknown',
}

/** Update affordance the UI shows, derived from the package manager. */
export enum UpdateMode {
  /** PM can install a specific version → dropdown offering stable / latest. */
  VERSIONED = 'versioned',
  /** One upgrade command, no version targeting → a plain Update button. */
  SIMPLE = 'simple',
  /** No non-interactive update path → no affordance shown. */
  NONE = 'none',
}

/** Result of GET_CLI_UPDATE_INFO: current version + how/what can be updated. */
export interface CliUpdateInfo {
  /** Currently installed CLI version (from `claude --version`), or null if undetected. */
  cliVersion: string | null;
  packageManager: PackageManager;
  updateMode: UpdateMode;
  /** npm `stable` dist-tag version, or null if the registry lookup failed. */
  stable: string | null;
  /** npm `latest` dist-tag version, or null if the registry lookup failed. */
  latest: string | null;
  /** True when an update is offerable: updateMode != NONE and a newer version exists. */
  updatable: boolean;
}
