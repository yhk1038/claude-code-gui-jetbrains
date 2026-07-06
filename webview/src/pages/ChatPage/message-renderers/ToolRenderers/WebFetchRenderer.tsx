import {ToolUseBlockDto} from "@/dto";
import {useTranslation} from "@/i18n";
import {Container, RendererProps, ToolHeader, ToolWrapper} from "./common";

class WebFetchToolUseDto extends ToolUseBlockDto {
    declare input: {
        url: string;
        prompt: string;
    };
}

export function WebFetchRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as WebFetchToolUseDto;
    const url = toolUse.input?.url ?? '';

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name="WebFetch" inProgress={!props.toolResult} className="mb-2.5">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-text-primary/60 truncate hover:text-text-primary/80 hover:underline">{url}</a>
            </ToolHeader>

            {props.toolResult && (
                <Container>
                    <div className="p-2 text-text-primary/80">
                        {t('webFetch.fetchedFrom')} <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">{url}</a>
                    </div>
                </Container>
            )}
        </ToolWrapper>
    );
}
