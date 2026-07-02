import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError} from "../../common";
import {JetBrainsToolHeader, JetBrainsResultError, InOutBlock, prettyResult} from "./_shared";

class EvaluateExpressionToolUseDto extends ToolUseBlockDto {
    declare input: {expression?: string; frameIndex?: number; sessionId?: string};
}

/**
 * `xdebug_evaluate_expression`: the expression to evaluate goes in an IN block
 * (reviewable, like a command) and the debugger's evaluation result in OUT.
 */
export function DebuggerEvalRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as EvaluateExpressionToolUseDto;
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const expression = toolUse.input?.expression ?? '';
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <JetBrainsToolHeader name={toolUse.name} input={input} />
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : (
                <InOutBlock inContent={expression} outContent={out ? prettyResult(out) : ''} />
            )}
        </ToolWrapper>
    );
}
