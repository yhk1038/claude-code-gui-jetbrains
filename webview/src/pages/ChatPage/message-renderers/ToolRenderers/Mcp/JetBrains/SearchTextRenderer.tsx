import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, PathRow, RawJsonResult, ScopeText, safeParseJson, asObjects, inputProjectPath, getToolSpec} from "./_shared";

class SearchTextToolUseDto extends ToolUseBlockDto {
    declare input: {q?: string; query?: string; paths?: string[]};
}

interface SearchEntry {
    filePath: string;
    startLine?: number;
    lineNumber?: number; // newer `search_in_files_by_*` name for the match line
}

interface SearchTextResult {
    items?: SearchEntry[];  // older search_text / search_regex
    entries?: SearchEntry[]; // newer search_in_files_by_text / _by_regex
    more?: boolean;
}

/**
 * `search_text` / `search_regex` and the newer `search_in_files_by_text` /
 * `search_in_files_by_regex`: "text/regex `…` in `…`" header, "N matches" +
 * `path:line` rows. The two tool generations differ only in the result key
 * (`items` vs `entries`) and the match-line field (`startLine` vs `lineNumber`).
 */
export function SearchTextRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as SearchTextToolUseDto;
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const spec = getToolSpec(toolUse.name);
    const rawQ = spec?.queryParam ? input[spec.queryParam] : undefined;
    const q = typeof rawQ === 'string' ? rawQ : (toolUse.input?.q ?? toolUse.input?.query ?? '');
    const word = spec?.queryWord ?? 'query';
    const projectPath = inputProjectPath(input);
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const parsed = safeParseJson<SearchTextResult>(out);
    const items = asObjects<SearchEntry>(parsed?.items ?? parsed?.entries);

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
                        {items.map((it, i) => <PathRow key={i} path={it.filePath} line={it.startLine ?? it.lineNumber} projectPath={projectPath} />)}
                    </CollapsibleBox>
                </div>
            ) : (
                <RawJsonResult out={out} pretty={false} />
            )}
        </ToolWrapper>
    );
}
