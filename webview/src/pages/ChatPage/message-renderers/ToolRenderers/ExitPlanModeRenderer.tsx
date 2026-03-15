import {Streamdown} from 'streamdown';
import {math} from '@streamdown/math';
import 'katex/dist/katex.min.css';
import {ToolUseBlockDto} from "@/dto";
import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper} from "./common";

class ExitPlanModeToolUseDto extends ToolUseBlockDto {
    declare input: {
        plan?: string;
    };
}

export function ExitPlanModeRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as ExitPlanModeToolUseDto;
    const plan = toolUse.input?.plan ?? '';
    const toolResult = props.toolResult as { message?: { content: Array<{ content: string; is_error?: boolean }> } } | undefined;
    const resultBlock = toolResult?.message?.content?.[0];
    const isError = resultBlock?.is_error ?? false;
    const feedbackContent = resultBlock?.content;
    const statusText = toolResult
        ? (isError ? 'Stayed in plan mode' : 'User approved the plan')
        : undefined;

    const headerName = plan ? "Claude's Plan" : 'Plan Mode';

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={headerName} inProgress={!props.toolResult} className="mb-2.5" />

            {plan && (
                <div className="markdown-content mb-2">
                    <Streamdown
                        className="space-y-0"
                        mode="static"
                        shikiTheme={['github-dark', 'github-light']}
                        controls={{ code: true, table: true }}
                        plugins={{ math }}
                    >
                        {plan}
                    </Streamdown>
                </div>
            )}

            {statusText && (
                <div className="text-[12px] text-white/50">{statusText}</div>
            )}

            {isError && feedbackContent && (
                <Container className="mt-1">
                    <LabelValue label="RE:" className="border-b border-white/15" maxHeight="max-h-[60px]">
                        {feedbackContent}
                    </LabelValue>
                </Container>
            )}
        </ToolWrapper>
    );
}
