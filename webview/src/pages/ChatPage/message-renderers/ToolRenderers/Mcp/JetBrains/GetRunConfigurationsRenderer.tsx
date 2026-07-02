import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, Container, LabelValue, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, Badge, safeParseJson, asArray, prettyResult} from "./_shared";

interface RunConfig {
    name: string;
    description?: string;
}

interface RunConfigsResult {
    configurations?: RunConfig[];
}

/** `get_run_configurations`: list of config rows (name + description badge), or "No run configurations". */
export function GetRunConfigurationsRenderer(props: RendererProps) {
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const rawConfigs = safeParseJson<RunConfigsResult>(out)?.configurations;
    const hasConfigs = Array.isArray(rawConfigs);
    const configs = asArray<RunConfig>(rawConfigs);

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <JetBrainsToolHeader
                name={props.toolUse.name}
                input={(props.toolUse.input ?? {}) as Record<string, unknown>}
                extra={hasConfigs ? <span className="text-text-primary/50">{configs.length}</span> : undefined}
            />
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : !hasConfigs ? (
                out && <Container className="mt-1.5"><LabelValue maxHeight="max-h-[160px]">{prettyResult(out)}</LabelValue></Container>
            ) : configs.length === 0 ? (
                <ResultCaption className="mt-1">No run configurations</ResultCaption>
            ) : (
                <div className="mt-1.5">
                    <CollapsibleBox collapsedMaxHeight={200} className="flex flex-col gap-1">
                        {configs.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 text-[0.8461rem]">
                                <span className="font-mono text-text-primary/80 truncate">{c.name}</span>
                                {c.description && <Badge>{c.description}</Badge>}
                            </div>
                        ))}
                    </CollapsibleBox>
                </div>
            )}
        </ToolWrapper>
    );
}
