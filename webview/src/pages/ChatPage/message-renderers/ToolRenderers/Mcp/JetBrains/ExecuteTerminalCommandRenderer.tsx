import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError} from "../../common";
import {JetBrainsToolHeader, JetBrainsResultError, InOutBlock, Badge, safeParseJson} from "./_shared";

class ExecuteTerminalCommandToolUseDto extends ToolUseBlockDto {
    declare input: {command: string};
}

interface TerminalResult {
    command_exit_code?: number;
    command_output?: string;
}

/**
 * `execute_terminal_command`: shaped like the native Bash card — the command in
 * an IN block and the captured output in OUT, with an exit-code badge. Keeping
 * the command in a reviewable block (not the header) is deliberate: the user can
 * read exactly what will run before approving.
 */
export function ExecuteTerminalCommandRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as ExecuteTerminalCommandToolUseDto;
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const command = toolUse.input?.command ?? '';
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const parsed = safeParseJson<TerminalResult>(out);
    const exitCode = parsed?.command_exit_code;
    const output = parsed?.command_output ?? (parsed ? '' : out);

    return (
        <ToolWrapper
            message={props.message}
            groupClassName="pb-2.5"
            forceStatus={typeof exitCode === 'number' && exitCode !== 0 ? 'error' : undefined}
        >
            <JetBrainsToolHeader
                name={toolUse.name}
                input={input}
                extra={typeof input.executeInShell === 'boolean'
                    ? <Badge title="Run in the user's default shell vs. as a direct process">
                        {input.executeInShell ? 'shell' : 'direct'}
                      </Badge>
                    : undefined}
            />
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : (
                <>
                    {typeof exitCode === 'number' && (
                        <div className="mt-1">
                            <Badge tone={exitCode === 0 ? 'success' : 'error'}>exit {exitCode}</Badge>
                        </div>
                    )}
                    <InOutBlock inContent={command} outContent={output} />
                </>
            )}
        </ToolWrapper>
    );
}
