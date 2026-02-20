import { ToolUseBlockDto, ToolResultBlockDto } from "@/types";
import { Container, LabelValue, RendererProps, ToolHeader, ToolWrapper } from "./common";
import { ToolRenderer } from "../ToolRenderer";

class TaskToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        description: string;
        subagent_type?: string;
        prompt: string;
    };
}

export function TaskRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as TaskToolUseDto;

    const name = toolUse.name;
    const description = toolUse.input?.description ?? '';
    const input = toolUse.input?.prompt ?? '';
    const subAgentMessages = toolUse.subAgentMessages ?? [];

    // Extract tool_use blocks from sub-agent messages
    // Build a sub-agent toolUseMap for merging tool_results
    const subAgentToolUses: ToolUseBlockDto[] = [];
    const subAgentToolUseMap = new Map<string, ToolUseBlockDto>();

    for (const msg of subAgentMessages) {
        if (msg.role === 'assistant') {
            for (const block of msg.content) {
                if (block.type === 'tool_use') {
                    const tuBlock = block as ToolUseBlockDto;
                    subAgentToolUses.push(tuBlock);
                    subAgentToolUseMap.set(tuBlock.id, tuBlock);
                }
            }
        }
    }

    // Merge sub-agent tool_results into sub-agent tool_uses
    // (same pattern as ChatMessageArea does for top-level messages)
    for (const msg of subAgentMessages) {
        if (msg.role === 'user') {
            for (const block of msg.content) {
                if (block.type === 'tool_result') {
                    const trBlock = block as ToolResultBlockDto;
                    const matchingToolUse = subAgentToolUseMap.get(trBlock.tool_use_id);
                    if (matchingToolUse) {
                        // Create a minimal LoadedMessageDto-like wrapper
                        matchingToolUse.tool_result = {
                            type: 'user',
                            message: { role: 'user', content: [block] },
                        } as any;
                    }
                }
            }
        }
    }

    const hasSubAgentMessages = subAgentToolUses.length > 0;

    return (
        <>
            <ToolWrapper message={props.message}>
                {/* IMPORTANT: ToolHeader uses {children || <description>} pattern,
                so we MUST include description inside children to preserve it */}
                <ToolHeader name={name} inProgress={!props.toolResult && !hasSubAgentMessages}>
                    <div className="text-white/60">{description}</div>
                </ToolHeader>

                {/* Prompt input (always visible, collapsed) */}
                <Container>
                    <LabelValue
                        label="IN"
                        className="border-b border-white/15"
                        maxHeight="max-h-[60px]"
                    >
                        {input}
                    </LabelValue>
                </Container>
            </ToolWrapper>

            {/* Sub-agent tool calls (expandable) */}
            {hasSubAgentMessages && (
                <>
                    {subAgentToolUses.map((tu) => (
                        <ToolRenderer key={tu.id} toolUse={tu} message={props.message} />
                    ))}
                </>
            )}
        </>
    );
}
