import {useTranslation} from "@/i18n";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, Badge, RawJsonResult, safeParseJson, asObjects} from "./_shared";

interface RunConfig {
    name: string;
    description?: string;
}

interface RunConfigsResult {
    configurations?: RunConfig[];
}

/** `get_run_configurations`: list of config rows (name + description badge), or "No run configurations". */
export function GetRunConfigurationsRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const rawConfigs = safeParseJson<RunConfigsResult>(out)?.configurations;
    const hasConfigs = Array.isArray(rawConfigs);
    const configs = asObjects<RunConfig>(rawConfigs);

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
                <RawJsonResult out={out} />
            ) : configs.length === 0 ? (
                <ResultCaption className="mt-1">{t('jetbrains.getRunConfigurations.none')}</ResultCaption>
            ) : (
                <div className="mt-1.5">
                    <CollapsibleBox collapsedMaxHeight={200} className="flex flex-col gap-1">
                        {configs.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 text-[0.8461rem]">
                                <span className="font-mono text-text-primary/80 truncate">
                                    {typeof c.name === 'string' ? c.name : JSON.stringify(c.name)}
                                </span>
                                {typeof c.description === 'string' && c.description && <Badge>{c.description}</Badge>}
                            </div>
                        ))}
                    </CollapsibleBox>
                </div>
            )}
        </ToolWrapper>
    );
}
