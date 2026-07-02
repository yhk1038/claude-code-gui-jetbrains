import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, Container, LabelValue, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, PathRow, ScopeText, safeParseJson, asArray, inputProjectPath, getToolSpec} from "./_shared";

class SearchTextToolUseDto extends ToolUseBlockDto {
    declare input: {q?: string; query?: string; paths?: string[]};
}

interface SearchTextResult {
    items?: Array<{filePath: string; startLine?: number}>;
    more?: boolean;
}

/** `search_text` / `search_regex`: "text/regex `…` in `…`" header, "N matches" + `path:line` rows. */
export function SearchTextRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as SearchTextToolUseDto;
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const q = toolUse.input?.q ?? toolUse.input?.query ?? '';
    const word = getToolSpec(toolUse.name)?.queryWord ?? 'query';
    const projectPath = inputProjectPath(input);
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const parsed = safeParseJson<SearchTextResult>(out);
    const items = asArray<{filePath: string; startLine?: number}>(parsed?.items);

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <JetBrainsToolHeader
                name={toolUse.name}
                input={input}
                extra={
                    <span className="flex items-center gap-1.5 min-w-0 text-text-primary/50">
                        {q && <><span className="shrink-0">{word}</span><span className="font-mono text-text-primary/70 truncate">{q}</span></>}
                        <ScopeText paths={toolUse.input?.paths} projectPath={projectPath} />
                    </span>
                }
            />
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : parsed ? (
                <div className="mt-1.5">
                    <ResultCaption>
                        {items.length}{parsed?.more ? '+' : ''} {items.length === 1 ? 'match' : 'matches'}
                    </ResultCaption>
                    <CollapsibleBox collapsedMaxHeight={200} className="flex flex-col gap-0.5">
                        {items.map((it, i) => <PathRow key={i} path={it.filePath} line={it.startLine} projectPath={projectPath} />)}
                    </CollapsibleBox>
                </div>
            ) : (
                out && <Container className="mt-1.5"><LabelValue maxHeight="max-h-[160px]">{out}</LabelValue></Container>
            )}
        </ToolWrapper>
    );
}
