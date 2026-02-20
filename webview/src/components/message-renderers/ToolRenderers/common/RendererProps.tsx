import {ToolUseBlockDto} from "@/dto";
import {LoadedMessageDto} from "@/types";

export interface RendererProps {
    toolUse: ToolUseBlockDto;
    toolResult?: LoadedMessageDto;
    message?: LoadedMessageDto;
}
