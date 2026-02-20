import React from 'react';
import {LoadedMessageDto} from '../../types';
import {ToolUseBlockDto} from '../../dto/message/ContentBlockDto';
import {toolMapper} from "./ToolRenderers";
import {ToolHeader, ToolWrapper} from "./ToolRenderers/common";

interface ToolRendererProps {
    toolUse: ToolUseBlockDto;
    message?: LoadedMessageDto;
}

const mapper = toolMapper();
export const ToolRenderer: React.FC<ToolRendererProps> = ({toolUse, message}) => {
    const toolResult = toolUse.tool_result as LoadedMessageDto | undefined;

    const Component = mapper.get(toolUse.name)
    if (Component) {
        return <Component toolUse={toolUse} toolResult={toolResult} message={message} />
    }

    return (
        <ToolWrapper message={message} onClick={() => console.log(toolUse)}>
            <ToolHeader name={toolUse.name} description={'unknown'} />
        </ToolWrapper>
    );
};
