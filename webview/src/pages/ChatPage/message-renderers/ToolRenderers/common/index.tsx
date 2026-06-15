import {ReactNode, useState} from "react";
import {ContextPills} from "@/pages/ChatPage/message-renderers";
import type {LoadedMessageDto} from "@/types";
import {cn} from "@/utils/cn.ts";
import {AnyContentBlockDto, ContentBlockType, TextBlockDto, ToolResultBlockDto} from "@/dto/message/ContentBlockDto";

export * from './RendererProps';

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

    return (
        <div className={cn(`group pt-2 pb-4 pl-6 pr-3`, groupClassName)}>
            <div className="flex items-start gap-3">
                {/* Bullet indicator */}
                <span className="text-text-tertiary mt-[3px] text-[0.6923rem]">●</span>

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
