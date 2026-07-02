import {ReactNode} from "react";
import type {LoadedMessageDto} from "@/types";
import {parseUserDeclined} from "@/shared";
import {toolResultIsError, toolResultText} from "../../../../common";
import {type DebuggerOutcome} from "../helpers";
import {surprisingFields} from "../tool-params";
import {Badge} from "./Badge";

interface DebuggerOutcomeRowProps {
    outcome: DebuggerOutcome;
}

/**
 * Compact debugger outcome: status badge, value change (old → new), applied /
 * result message — shown instead of raw JSON (the IDE's own debugger panel is
 * the rich view). paused/running/stopped are normal states, so only 'timeout'
 * is warning-toned.
 */
export const DebuggerOutcomeRow = (props: DebuggerOutcomeRowProps) => {
    const {outcome} = props;
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-[0.8461rem]">
            {outcome.status && (
                <Badge tone={outcome.status === 'timeout' ? 'warning' : 'default'}>{outcome.status}</Badge>
            )}
            {outcome.oldValue !== undefined && (
                <span className="font-mono text-text-primary/80">{outcome.oldValue} → {outcome.newValue}</span>
            )}
            {outcome.applied !== undefined && (
                <Badge tone={outcome.applied ? 'success' : 'error'}>{outcome.applied ? 'applied' : 'not applied'}</Badge>
            )}
            {outcome.message && <span className="text-text-primary/70">{outcome.message}</span>}
        </div>
    );
};

function formatFieldValue(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

interface UnrecognizedInputNoticeProps {
    toolName: string;
    input: Record<string, unknown>;
}

/**
 * Security backstop: surfaces any input field we don't handle natively — keys
 * absent from the tool's schema, or known keys with an unexpected type. Renders
 * nothing when the input is clean. When present it sits directly under the
 * header (never buried), warning-toned and expanded, so a field can't be
 * smuggled past the user's approval. Distinct from the intentional IN/OUT block.
 */
export const UnrecognizedInputNotice = (props: UnrecognizedInputNoticeProps) => {
    const fields = surprisingFields(props.toolName, props.input);
    if (!fields.length) return null;

    return (
        <div className="mt-1.5 rounded border border-state-warning-fg/40 bg-state-warning-bg/40 p-2 text-[0.8461rem]">
            <div className="flex items-center gap-1.5 mb-1 text-state-warning-fg font-medium">
                <span aria-hidden>⚠</span>
                <span>Unrecognized input — review before allowing</span>
            </div>
            <div className="flex flex-col gap-0.5 font-mono text-text-primary/80">
                {fields.map((f) => (
                    <div key={f.key} className="whitespace-pre-wrap break-all">
                        <span className="text-text-primary">{f.key}</span>
                        {f.reason === 'type' && <span className="text-state-warning-fg"> (unexpected type)</span>}
                        <span className="text-text-primary/50">: </span>
                        {formatFieldValue(f.value)}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface JetBrainsErrorRowProps {
    children?: ReactNode;
}

/** Distinct error line (the leading status dot is already red on error). */
export const JetBrainsErrorRow = (props: JetBrainsErrorRowProps) => (
    <div className="mt-1 text-[0.8461rem] font-mono text-state-error-fg whitespace-pre-wrap">{props.children}</div>
);

interface JetBrainsDeclinedNoteProps {
    instruction?: string;
}

/**
 * Neutral note for a user's denial decision — deliberately NOT red, so it can't
 * be mistaken for a tool failure or an "MCP server disabled" error. Shows the
 * instruction the user gave Claude (if any).
 */
export const JetBrainsDeclinedNote = (props: JetBrainsDeclinedNoteProps) => (
    <div className="mt-1 flex items-start gap-1.5 text-[0.8461rem]">
        <Badge>declined</Badge>
        {props.instruction
            ? <span className="text-text-primary/70 italic whitespace-pre-wrap">“{props.instruction}”</span>
            : <span className="text-text-tertiary">You declined this tool.</span>}
    </div>
);

interface JetBrainsResultErrorProps {
    toolResult?: LoadedMessageDto;
}

/**
 * Renders the tool's result when it didn't run normally: a user's decline as a
 * neutral note, or a real `is_error` failure in red. Otherwise nothing — letting
 * a renderer show its normal body only on success.
 */
export const JetBrainsResultError = (props: JetBrainsResultErrorProps) => {
    const declined = parseUserDeclined(toolResultText(props.toolResult));
    if (declined) return <JetBrainsDeclinedNote instruction={declined.instruction} />;
    if (!toolResultIsError(props.toolResult)) return null;
    return <JetBrainsErrorRow>{toolResultText(props.toolResult)}</JetBrainsErrorRow>;
};
