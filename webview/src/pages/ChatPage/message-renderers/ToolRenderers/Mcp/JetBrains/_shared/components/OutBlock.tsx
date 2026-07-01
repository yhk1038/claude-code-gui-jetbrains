import {ReactNode} from "react";
import {Container, LabelValue} from "../../../../common";

interface InOutBlockProps {
    inContent?: ReactNode;
    outContent?: ReactNode;
    inLabel?: string;
    outLabel?: string;
}

/**
 * Bash-style IN/OUT box, reused for tools whose input is itself worth reviewing
 * (terminal command, debugger expression). IN holds the request, OUT the result.
 */
export const InOutBlock = (props: InOutBlockProps) => {
    const {inContent, outContent, inLabel = 'IN', outLabel = 'OUT'} = props;
    return (
        <Container className="mt-1.5">
            <LabelValue label={inLabel} className="border-b border-border-subtle" maxHeight="max-h-[80px]">
                {inContent}
            </LabelValue>
            <LabelValue label={outLabel} maxHeight="max-h-[140px]">
                {outContent}
            </LabelValue>
        </Container>
    );
};

interface OutBlockProps {
    children?: ReactNode;
    maxHeight?: string;
}

/**
 * Marks a result region as the tool's OUT for cards that have no IN/OUT block,
 * so the output can't be mistaken for the header/input above it. Two forms per
 * the result's shape:
 *  - `OutBlock`: code/mono results — the framed OUT half of an InOutBlock.
 *  - `OutLabel`: inline results (status badges, short text) — a dim "OUT" caption.
 */
export const OutBlock = (props: OutBlockProps) => (
    <Container className="mt-1.5">
        <LabelValue label="OUT" maxHeight={props.maxHeight ?? 'max-h-[140px]'}>{props.children}</LabelValue>
    </Container>
);

interface OutLabelProps {
    children?: ReactNode;
}

export const OutLabel = (props: OutLabelProps) => (
    <div className="mt-1.5">
        <div className="text-tool-label-fg text-[0.7692rem] uppercase tracking-wide">OUT</div>
        {props.children}
    </div>
);
