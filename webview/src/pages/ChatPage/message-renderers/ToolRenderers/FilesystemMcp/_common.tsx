import {ReactNode, useEffect, useRef, useState} from "react";
import {cn} from "@/utils/cn";

export const McpToolBody = (props: {children?: ReactNode}) => {
    const {children} = props;
    return (
        <div className="mt-1.5 border border-border-subtle rounded text-[0.8461rem] font-mono overflow-hidden">
            {children}
        </div>
    );
};

export const McpToolRow = (props: {label: string; children?: ReactNode}) => {
    const {label, children} = props;
    const contentRef = useRef<HTMLDivElement>(null);
    const [overflows, setOverflows] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (contentRef.current) {
            setOverflows(contentRef.current.scrollHeight > 60);
        }
    }, [children]);

    return (
        <div className="flex items-start gap-2 p-2 border-b border-border-subtle last:border-b-0">
            <span className="text-tool-label-fg uppercase text-[0.7692rem] min-w-[28px] pt-[1px]">
                {label}
            </span>
            <div
                ref={contentRef}
                className={cn(
                    "flex-1 text-text-primary/80 whitespace-pre overflow-x-auto no-scrollbar",
                    overflows && !expanded && "overflow-hidden max-h-[60px] [mask-image:linear-gradient(to_bottom,black_50px,transparent_60px)]",
                    overflows && "cursor-pointer"
                )}
                onClick={overflows ? () => setExpanded((v) => !v) : undefined}
            >
                {children}
            </div>
        </div>
    );
};
