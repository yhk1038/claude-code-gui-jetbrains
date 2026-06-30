import {FC} from "react";
import {RendererProps} from "../common";
import {FilesystemMcpRenderers} from "./Filesystem";
import {GmailRenderers} from "./Gmail";
import {JetBrainsRenderers} from "./JetBrains";

export const McpRenderers: Array<[string, FC<RendererProps>]> = [
    ...FilesystemMcpRenderers,
    ...GmailRenderers,
    ...JetBrainsRenderers,
];
