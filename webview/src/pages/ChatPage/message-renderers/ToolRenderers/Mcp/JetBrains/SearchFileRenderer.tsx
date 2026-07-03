import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, PathRow, RawJsonResult, ScopeText, safeParseJson, asObjects, asStrings, inputProjectPath, getToolSpec} from "./_shared";

class SearchFileToolUseDto extends ToolUseBlockDto {
    declare input: {q: string; paths?: string[]; limit?: number};
}

interface SearchFileResult {
    items?: Array<{filePath: string}>; // older search_file
    files?: string[];                  // newer find_files_by_glob / _by_name_keyword
    more?: boolean;
    probablyHasMoreMatchingFiles?: boolean;
}

/**
 * `search_file` and the newer `find_files_by_glob` / `find_files_by_name_keyword`:
 * "pattern `…` in `…`" header, "N matches" + clickable path rows. The generations
 * differ only in the result shape (`items:[{filePath}]` vs `files:[path]`).
 */
export function SearchFileRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as SearchFileToolUseDto;
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const spec = getToolSpec(toolUse.name);
    const rawQ = spec?.queryParam ? input[spec.queryParam] : undefined;
    const q = typeof rawQ === 'string' ? rawQ : (toolUse.input?.q ?? '');
    const word = spec?.queryWord ?? 'query';
    const projectPath = inputProjectPath(input);
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const parsed = safeParseJson<SearchFileResult>(out);
    const paths: string[] = parsed?.items
        ? asObjects<{filePath: string}>(parsed.items).map((it) => it.filePath).filter((p): p is string => typeof p === 'string')
        : asStrings(parsed?.files);
    const hasMore = !!(parsed?.more ?? parsed?.probablyHasMoreMatchingFiles);

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
                        {paths.length}{hasMore ? '+' : ''} {paths.length === 1 ? 'match' : 'matches'}
                    </ResultCaption>
                    <CollapsibleBox collapsedMaxHeight={200} className="flex flex-col gap-0.5">
                        {paths.map((p, i) => <PathRow key={i} path={p} projectPath={projectPath} />)}
                    </CollapsibleBox>
                </div>
            ) : (
                <RawJsonResult out={out} pretty={false} />
            )}
        </ToolWrapper>
    );
}
