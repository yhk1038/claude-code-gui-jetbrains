import {FC} from "react";
import {RendererProps} from "../../common";
import {SearchThreadsRenderer} from "./SearchThreadsRenderer";
import {GetThreadRenderer} from "./GetThreadRenderer";
import {CreateDraftRenderer} from "./CreateDraftRenderer";
import {ListDraftsRenderer} from "./ListDraftsRenderer";
import {ListLabelsRenderer} from "./ListLabelsRenderer";
import {GmailActionRenderer} from "./ActionRenderer";

const P = 'mcp__claude_ai_Gmail__';

export const GmailRenderers: Array<[string, FC<RendererProps>]> = [
    // Dedicated visualization cards
    [`${P}search_threads`, SearchThreadsRenderer],
    [`${P}get_thread`, GetThreadRenderer],
    [`${P}create_draft`, CreateDraftRenderer],
    [`${P}list_drafts`, ListDraftsRenderer],
    [`${P}list_labels`, ListLabelsRenderer],
    // Action cards (shared renderer, distinct names mapped to descriptions)
    [`${P}label_thread`, GmailActionRenderer],
    [`${P}unlabel_thread`, GmailActionRenderer],
    [`${P}label_message`, GmailActionRenderer],
    [`${P}unlabel_message`, GmailActionRenderer],
    [`${P}create_label`, GmailActionRenderer],
    [`${P}update_label`, GmailActionRenderer],
    [`${P}delete_label`, GmailActionRenderer],
    [`${P}apply_sensitive_message_label`, GmailActionRenderer],
    [`${P}apply_sensitive_thread_label`, GmailActionRenderer],
];
