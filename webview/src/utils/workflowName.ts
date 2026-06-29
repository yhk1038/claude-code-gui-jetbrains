interface WorkflowInputLike {
    script?: string;
    scriptPath?: string;
    description?: string;
}

/**
 * Best-effort display name for a Workflow tool_use: the script's `meta.name`,
 * else the resumed scriptPath basename (sans extension), else the description.
 */
export function parseWorkflowName(input: WorkflowInputLike | undefined): string {
    if (!input) return 'workflow';
    const fromScript = input.script?.match(/name\s*:\s*['"]([^'"]+)['"]/)?.[1];
    if (fromScript) return fromScript;
    if (input.scriptPath) {
        const base = input.scriptPath.split(/[\\/]/).pop() ?? input.scriptPath;
        return base.replace(/\.[cm]?[jt]s$/i, '');
    }
    return input.description || 'workflow';
}
