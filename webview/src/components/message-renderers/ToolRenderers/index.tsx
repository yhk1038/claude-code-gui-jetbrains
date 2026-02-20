import {FC} from "react";
import {ToolUseBlockDto} from "@/dto";
import {LoadedMessageDto} from "@/types";
import { BashRenderer } from "./BashRenderer";
import {TodoWriteRenderer} from "./TodoWriteRenderer.tsx";
import {TaskRenderer} from "./TaskRenderer.tsx";
import {ReadRenderer} from "@/components/message-renderers/ToolRenderers/ReadRenderer.tsx";
import {GrepRenderer} from "@/components/message-renderers/ToolRenderers/GrepRenderer.tsx";
import {GlobRenderer} from "@/components/message-renderers/ToolRenderers/GlobRenderer.tsx";
import {EditRenderer} from "@/components/message-renderers/ToolRenderers/EditRenderer.tsx";
import {AskUserQuestionRenderer} from "./AskUserQuestionRenderer.tsx";
import {EnterPlanModeRenderer} from "./EnterPlanModeRenderer.tsx";
import {ExitPlanModeRenderer} from "./ExitPlanModeRenderer.tsx";
import {WebFetchRenderer} from "./WebFetchRenderer.tsx";
import {WebSearchRenderer} from "./WebSearchRenderer.tsx";
import {WriteRenderer} from "./WriteRenderer.tsx";

interface ToolRendererProps {
    toolUse: ToolUseBlockDto;
    toolResult?: LoadedMessageDto;
    message?: LoadedMessageDto;
}

export function toolMapper() {
    const map = new Map<string, FC<ToolRendererProps>>();

    registerTool(map, BashRenderer);
    registerTool(map, TodoWriteRenderer);
    registerTool(map, TaskRenderer);
    registerTool(map, ReadRenderer);
    registerTool(map, GrepRenderer);
    registerTool(map, GlobRenderer);
    registerTool(map, EditRenderer);
    registerTool(map, AskUserQuestionRenderer);
    registerTool(map, EnterPlanModeRenderer);
    registerTool(map, ExitPlanModeRenderer);
    registerTool(map, WebFetchRenderer);
    registerTool(map, WebSearchRenderer);
    registerTool(map, WriteRenderer);

    return map;
}

function registerTool(map: Map<string, FC<ToolRendererProps>>, tool: FC<ToolRendererProps>, name?: string) {
    const key = name || tool.name.replace('Renderer', '');
    map.set(key, tool);
}
