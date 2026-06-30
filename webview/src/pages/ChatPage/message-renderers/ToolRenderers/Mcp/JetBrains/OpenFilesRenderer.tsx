import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, Container, LabelValue, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, PathRow, Badge, safeParseJson, asArray, prettyResult, inputProjectPath} from "./_shared";

interface OpenFilesResult {
    activeFilePath?: string;
    openFiles?: string[];
}

/** `get_all_open_file_paths`: list of open editors (active one badged). */
export function OpenFilesRenderer(props: RendererProps) {
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const parsed = safeParseJson<OpenFilesResult>(out);
    const hasFiles = Array.isArray(parsed?.openFiles);
    const files = asArray<string>(parsed?.openFiles);
    const active = parsed?.activeFilePath;
    const projectPath = inputProjectPath(props.toolUse.input);

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <JetBrainsToolHeader
                name={props.toolUse.name}
                input={(props.toolUse.input ?? {}) as Record<string, unknown>}
                extra={hasFiles ? <span className="text-text-primary/50">{files.length}</span> : undefined}
            />
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : !hasFiles ? (
                out && <Container className="mt-1.5"><LabelValue maxHeight="max-h-[160px]">{prettyResult(out)}</LabelValue></Container>
            ) : files.length === 0 ? (
                <ResultCaption className="mt-1">No open files</ResultCaption>
            ) : (
                <div className="mt-1.5">
                    <CollapsibleBox collapsedMaxHeight={200} className="flex flex-col gap-0.5">
                        {files.map((f, i) => (
                            <PathRow
                                key={i}
                                path={f}
                                projectPath={projectPath}
                                left={f === active ? <Badge tone="success">active</Badge> : undefined}
                            />
                        ))}
                    </CollapsibleBox>
                </div>
            )}
        </ToolWrapper>
    );
}
