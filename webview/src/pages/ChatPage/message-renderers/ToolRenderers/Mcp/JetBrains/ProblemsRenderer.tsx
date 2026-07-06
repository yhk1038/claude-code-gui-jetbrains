import {ToolUseBlockDto} from "@/dto";
import {useTranslation} from "@/i18n";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, PathRow, FileList, Badge, RawJsonResult, safeParseJson, inputProjectPath, resultIndicatesError} from "./_shared";

class ProblemsToolUseDto extends ToolUseBlockDto {
    declare input: {filePath?: string; files?: string[]};
}

interface Problem {
    file?: string;
    line?: number;
    severity?: string;
    message?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Normalize get_file_problems ({filePath,errors:[…]}), lint_files ({items:[…]})
 * and build_project ({problems:[{file,kind,description,…}]}) into a flat list.
 */
function collectProblems(parsed: any): Problem[] | null {
    if (!parsed || typeof parsed !== 'object') return null;
    const toProblem = (file: string | undefined, p: any): Problem => ({
        file: p?.file ?? file,
        line: p?.line ?? p?.startLine,
        severity: p?.severity ?? p?.kind,
        message: p?.description ?? p?.message ?? p?.text,
    });
    if (Array.isArray(parsed.errors)) {
        return parsed.errors.map((e: any) => toProblem(parsed.filePath, e));
    }
    if (Array.isArray(parsed.problems)) {
        return parsed.problems.map((e: any) => toProblem(parsed.filePath, e));
    }
    if (Array.isArray(parsed.items)) {
        const flat: Problem[] = [];
        for (const it of parsed.items) {
            const file = it?.filePath ?? it?.file;
            if (Array.isArray(it?.problems)) it.problems.forEach((p: any) => flat.push(toProblem(file, p)));
            else flat.push(toProblem(file, it));
        }
        return flat;
    }
    return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function severityTone(severity?: string): 'error' | 'warning' | 'default' {
    const s = (severity ?? '').toLowerCase();
    if (s.includes('error')) return 'error';
    if (s.includes('warn')) return 'warning';
    return 'default';
}

/** `get_file_problems` / `lint_files` / `build_project`: severity-badged problem rows. */
export function ProblemsRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as ProblemsToolUseDto;
    const input = toolUse.input ?? {};
    const projectPath = inputProjectPath(input);
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const parsedOut = safeParseJson<Record<string, unknown>>(out);
    const problems = collectProblems(parsedOut);
    const buildSucceeded = parsedOut?.isSuccess === true;

    // lint_files targets a list of files (the request); always show which files
    // were analyzed, even when zero problems came back.
    const files = Array.isArray(input.files) ? input.files : [];

    return (
        <ToolWrapper
            message={props.message}
            groupClassName="pb-2.5"
            forceStatus={resultIndicatesError(out) ? 'error' : undefined}
        >
            <JetBrainsToolHeader
                name={toolUse.name}
                path={input.filePath}
                projectPath={projectPath}
                input={input as Record<string, unknown>}
                extra={(input as Record<string, unknown>).errorsOnly === true ? <Badge>{t('jetbrains.problems.errorsOnly')}</Badge> : undefined}
            />
            {!input.filePath && files.length > 0 && <FileList files={files} projectPath={projectPath} />}
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : problems === null ? (
                <RawJsonResult out={out} />
            ) : problems.length === 0 ? (
                <ResultCaption className="mt-1">{buildSucceeded ? t('jetbrains.problems.buildSucceeded') : t('jetbrains.problems.none')}</ResultCaption>
            ) : (
                <div className="mt-1.5">
                    <ResultCaption>{t('jetbrains.problems.count', {count: problems.length})}</ResultCaption>
                    <CollapsibleBox collapsedMaxHeight={200} className="flex flex-col gap-1">
                        {problems.map((p, i) => (
                            <PathRow
                                key={i}
                                path={p.file ?? ''}
                                line={p.line}
                                projectPath={projectPath}
                                left={<Badge tone={severityTone(p.severity)}>{p.severity ?? t('jetbrains.problems.infoSeverity')}</Badge>}
                                right={p.message && <span className="text-text-primary/70 truncate">{p.message}</span>}
                            />
                        ))}
                    </CollapsibleBox>
                </div>
            )}
        </ToolWrapper>
    );
}
