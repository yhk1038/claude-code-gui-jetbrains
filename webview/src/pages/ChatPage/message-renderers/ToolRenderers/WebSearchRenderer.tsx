import {ToolUseBlockDto} from "@/dto";
import {useTranslation} from "@/i18n";
import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper} from "./common";

class WebSearchToolUseDto extends ToolUseBlockDto {
    declare input: {
        query: string;
    };
}

export function WebSearchRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as WebSearchToolUseDto;
    const query = toolUse.input?.query ?? '';
    const toolResult = props.toolResult as { message?: { content: Array<{ content: string }> } } | undefined;
    const output = toolResult?.message?.content?.[0]?.content ?? '';

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name="WebSearch" inProgress={!props.toolResult} className="mb-2.5">
                <div className="text-text-primary/60 truncate">{query}</div>
            </ToolHeader>

            {props.toolResult && (
                <Container>
                    <LabelValue label={t('tool.out')} maxHeight="max-h-[60px]">
                        {output}
                    </LabelValue>
                </Container>
            )}
        </ToolWrapper>
    );
}
