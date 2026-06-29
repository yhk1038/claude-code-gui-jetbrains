/** Format a millisecond duration as "Ns" / "Nm" / "Nm Ms". Returns undefined for 0/none. */
export function formatDuration(ms?: number): string | undefined {
    if (!ms || ms <= 0) return undefined;
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return sec ? `${min}m ${sec}s` : `${min}m`;
}

/** Format a token count as "1.2k" once it crosses 1000. Returns undefined for 0/none. */
export function formatTokens(n?: number): string | undefined {
    if (n === undefined || n <= 0) return undefined;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

/** Tailwind text color for a workflow/agent status. */
export const WORKFLOW_STATUS_COLOR: Record<string, string> = {
    running: 'text-text-link',
    completed: 'text-state-success-fg',
    failed: 'text-state-error-fg',
    stopped: 'text-state-warning-fg',
};

/**
 * Tailwind background for an agent progress dot. `done` is green (succeeded),
 * `stopped` is a muted grey (cut off when the workflow was interrupted — not a
 * success), `running` pulses blue.
 */
export function agentDotClass(status: 'running' | 'done' | 'stopped'): string {
    switch (status) {
        case 'done':
            return 'bg-state-success-fg';
        case 'stopped':
            return 'bg-text-tertiary';
        default:
            return 'bg-text-link animate-pulse';
    }
}
