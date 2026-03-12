import { Container, LabelValue, RendererProps, ToolHeader, ToolWrapper } from "../common";

export function AskUserQuestionRenderer(props: RendererProps) {
    const toolUse = props.toolUse;
    const input = toolUse.input as { questions?: Array<{ question: string }> } | undefined;
    const toolResult = props.toolResult as
        | { message?: { content: Array<{ content: string }> } }
        | undefined;
    const output = toolResult?.message?.content?.[0]?.content ?? "";

    const isStreaming = props.message?.isStreaming === true;

    const questions = input?.questions ?? [];
    const hasValidQuestions = questions.length > 0 && typeof questions[0].question === "string";

    const inProgress = !toolResult && (isStreaming || !hasValidQuestions);

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader
                name={toolUse.name}
                inProgress={inProgress}
                className="mb-2.5"
            />

            {toolResult && (
                <Container>
                    {hasValidQuestions && (
                        <LabelValue label="ASK">
                            {questions.map((q, idx) => (
                                <div key={idx}>{q.question}</div>
                            ))}
                        </LabelValue>
                    )}
                    <LabelValue label="OUT" maxHeight="max-h-[60px]">
                        {output}
                    </LabelValue>
                </Container>
            )}
        </ToolWrapper>
    );
}
