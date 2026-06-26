import {ReactNode, useState} from "react";
import {ContextPills} from "@/pages/ChatPage/message-renderers";
import type {LoadedMessageDto} from "@/types";
import {cn} from "@/utils/cn.ts";
import {AnyContentBlockDto, ContentBlockType, TextBlockDto, ToolResultBlockDto} from "@/dto/message/ContentBlockDto";
import {useToolStatus} from "./toolStatus";

export * from './RendererProps';
export * from './toolStatus';

/**
 * Extract displayable text from a tool_result (OUT) message.
 * tool_result content can be a plain string or a content-block array
 * (e.g. [{ type: 'text', text }]); both are normalized to a single string.
 */
export function toolResultText(toolResult?: LoadedMessageDto): string {
    const content = toolResult?.message?.content;
    if (!Array.isArray(content)) return '';
    const block = content[0];
    if (!block || block.type !== ContentBlockType.ToolResult) return '';
    const value = (block as ToolResultBlockDto).content;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        return value
            .map((b: AnyContentBlockDto) => (b.type === ContentBlockType.Text ? (b as TextBlockDto).text : ''))
            .join('');
    }
    return '';
}

export const ToolWrapper = (props: {
    message?: LoadedMessageDto;
    onClick?: () => any;
    groupClassName?: string;
    className?: string;
    children?: ReactNode;
}) => {
    const {message, groupClassName = '', className = '', onClick, children} = props;
    const status = useToolStatus();
    const bulletColor =
        status === 'success' ? 'text-state-success-fg'
        : status === 'error' ? 'text-state-error-fg'
        : status === 'progress' ? 'text-text-secondary animate-pulse'
        : 'text-text-tertiary';

    return (
        <div className={cn(`group pt-2 pb-4 pl-6 pr-3`, groupClassName)}>
            <div className="flex items-start gap-3">
                {/* Bullet indicator — colored by tool status (success/error/pending) */}
                <span className={cn('mt-[3px] text-[0.6923rem]', bulletColor)}>●</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className={cn(`mt-0.5`, className)} onClick={onClick}>
                        {children}
                    </div>
                </div>

                {message?.context && <ContextPills context={message.context} />}
            </div>
        </div>
    )
}

export const ToolWrapper2 = (props: {
    onClick?: () => any;
    children: ReactNode;
}) => {
    const {onClick, children} = props;

    return (
        <div className="mt-0.5 mb-1.5" onClick={onClick}>
            {children}
        </div>
    )
}

export const ToolHeader = (props: {
    name: string;
    description?: string;
    inProgress?: boolean;
    className?: string;
    children?: ReactNode;
}) => {
    const {name, description = '', className = '', children} = props;

    return (
        <div className={cn(`flex items-start gap-1.5 text-[1rem]`, className)}>
            <div className="text-text-primary text-[1rem] font-semibold">
                <span className="">{name}</span>
            </div>

            {children || <div className="text-text-primary/60">{description}</div>}
        </div>
    )
}

/**
 * A short caption that explains a tool's execution result. Rendered between the
 * tool header and the result box (e.g. Edit's "Modified", search's "N found").
 */
export const ResultCaption = (props: {children?: ReactNode; className?: string}) => {
    const {children, className} = props;
    return (
        <div className={cn("text-text-primary/50 text-[0.8461rem] mb-1", className)}>
            {children}
        </div>
    );
};

export const Container = ({children, className = ''}: { children?: ReactNode; className?: string;}) => {
    return (
        <div className={`bg-surface-hover border border-border-subtle rounded text-[0.8461rem] font-mono ${className}`}>
            {children}
        </div>
    )
}

export const LabelValue = (props: {
    label?: string;
    className?: string;
    maxHeight?: string;
    children?: ReactNode;
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const {label = '', children, className = '', maxHeight} = props;

    return (
        <div className={`flex items-start p-2 ${className}`}>
            {label && <Label name={label}/>}
            <Value
                isFocused={isFocused}
                onClick={() => setIsFocused((v) => !v)}
                maxHeight={maxHeight}
            >{children}</Value>
        </div>
    )
}

export const Label = ({name}: { name: string }) => {
    return <div className="text-tool-label-fg min-w-[40px]">{name}</div>
}

export const Value = (props: {
    isFocused?: boolean;
    onClick?: () => any;
    maxHeight?: string;
    children?: ReactNode;
}) => {
    const {isFocused, onClick, children, maxHeight = 'max-h-[105px]'} = props;

    return (
        <div className={`flex-1 text-text-primary/80 whitespace-pre font-mono overflow-y-hidden overflow-x-auto no-scrollbar cursor-pointer ${isFocused ? '' : maxHeight}`} onClick={onClick}>
            {children}
        </div>
    );
}
