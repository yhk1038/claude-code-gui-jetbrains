import {useTranslation} from "@/i18n";
import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper, toolResultText} from "./common";

interface BashToolUseDto {
    name: string;
    input: {
        command: string;
        description: string;
    };
}

export function BashRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as BashToolUseDto;

    const name = toolUse.name;
    const description = toolUse.input?.description ?? '';
    const input = toolUse.input?.command ?? '';
    const output = toolResultText(props.toolResult);

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader
                name={name}
                description={description}
                inProgress={!props.toolResult}
                className="mb-2.5"
            />

            <Container>
                <LabelValue
                    label={t('tool.in')}
                    className="border-b border-border-subtle"
                    maxHeight="max-h-[60px]"
                >
                    {input}
                </LabelValue>
                <LabelValue label={t('tool.out')} maxHeight="max-h-[60px]">
                    {output}
                </LabelValue>
            </Container>
        </ToolWrapper>
    )
}
