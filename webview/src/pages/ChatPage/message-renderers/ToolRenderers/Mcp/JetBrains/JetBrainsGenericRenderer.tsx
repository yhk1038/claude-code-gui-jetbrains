import {RendererProps, ToolWrapper, toolResultText, toolResultIsError} from "../../common";
import {JetBrainsToolHeader, JetBrainsResultError, InOutBlock, isTrivialResult, prettyResult, resultIndicatesError} from "./_shared";

/**
 * Branded fallback for any JetBrains tool without a dedicated renderer (DB,
 * Rails, inspection-kts, the unmodeled long tail). Since we don't interpret
 * these tools' fields, full disclosure is the priority: the entire input is
 * shown verbatim in an IN block (so nothing can be smuggled past approval) and
 * the result in OUT. Header still carries the product name + human action title.
 */
export function JetBrainsGenericRenderer(props: RendererProps) {
    const {toolUse, toolResult, message} = props;
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const hasInput = Object.keys(input).length > 0;
    const out = toolResultText(toolResult);
    const isError = toolResultIsError(toolResult);
    const output = isTrivialResult(out) ? '' : prettyResult(out);

    return (
        <ToolWrapper
            message={message}
            groupClassName="pb-2.5"
            forceStatus={resultIndicatesError(out) ? 'error' : undefined}
        >
            <JetBrainsToolHeader name={toolUse.name} />
            {isError ? (
                <JetBrainsResultError toolResult={toolResult} />
            ) : (hasInput || output) && (
                <InOutBlock
                    inContent={hasInput ? JSON.stringify(input, null, 2) : undefined}
                    outContent={output || undefined}
                />
            )}
        </ToolWrapper>
    );
}
