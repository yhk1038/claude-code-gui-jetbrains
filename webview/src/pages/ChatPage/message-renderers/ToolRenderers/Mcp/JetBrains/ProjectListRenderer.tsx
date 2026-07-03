import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, Badge, RawJsonResult, safeParseJson} from "./_shared";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Pick the result array of `get_project_modules` / `get_project_dependencies`. */
function pickList(parsed: any): any[] | null {
    if (!parsed || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed.modules)) return parsed.modules;
    if (Array.isArray(parsed.dependencies)) return parsed.dependencies;
    const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
    return Array.isArray(firstArray) ? firstArray : null;
}

function itemName(it: any): string {
    return typeof it === 'string' ? it : (it?.name ?? JSON.stringify(it));
}
function itemType(it: any): string | undefined {
    return typeof it === 'object' && it ? it.type : undefined;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** `get_project_modules` / `get_project_dependencies`: name (+ type badge) rows. */
export function ProjectListRenderer(props: RendererProps) {
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const list = pickList(safeParseJson(out));

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <JetBrainsToolHeader
                name={props.toolUse.name}
                input={(props.toolUse.input ?? {}) as Record<string, unknown>}
                extra={list ? <span className="text-text-primary/50">{list.length}</span> : undefined}
            />
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : !list ? (
                <RawJsonResult out={out} />
            ) : list.length === 0 ? (
                <ResultCaption className="mt-1">None</ResultCaption>
            ) : (
                <div className="mt-1.5">
                    <CollapsibleBox collapsedMaxHeight={200} className="flex flex-col gap-1">
                        {list.map((it, i) => (
                            <div key={i} className="flex items-center gap-2 text-[0.8461rem]">
                                <span className="font-mono text-text-primary/80 truncate">{itemName(it)}</span>
                                {itemType(it) && <Badge>{itemType(it)}</Badge>}
                            </div>
                        ))}
                    </CollapsibleBox>
                </div>
            )}
        </ToolWrapper>
    );
}
