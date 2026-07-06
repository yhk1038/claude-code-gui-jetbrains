import {ToolUseBlockDto} from "@/dto";
import {useTranslation} from "@/i18n";
import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper} from "./common";

class ToolSearchToolUseDto extends ToolUseBlockDto {
    declare input: {
        query: string;
        max_results?: number;
    };
}

interface ToolSearchResultDto {
    toolUseResult?: {
        matches: string[];
        query: string;
        total_deferred_tools: number;
    };
}

export function ToolSearchRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as ToolSearchToolUseDto;
    const query = toolUse.input?.query ?? '';
    const toolResult = props.toolResult as ToolSearchResultDto | undefined;
    const rawMatches = toolResult?.toolUseResult?.matches;
    const matches = Array.isArray(rawMatches) ? rawMatches : [];

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name="ToolSearch" inProgress={!props.toolResult} className="mb-2.5">
                <div className="text-text-primary/60 truncate">{query}</div>
            </ToolHeader>

            {props.toolResult && matches.length > 0 && (
                <Container>
                    <LabelValue label={t('tool.out')} maxHeight="max-h-[60px]">
                        {matches.join(', ')}
                    </LabelValue>
                </Container>
            )}
        </ToolWrapper>
    );
}
