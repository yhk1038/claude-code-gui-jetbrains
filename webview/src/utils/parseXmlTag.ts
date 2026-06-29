/**
 * Extract the inner text of the first `<tag>…</tag>` occurrence (dot matches
 * newlines). Returns the trimmed inner text, or `undefined` when the tag is
 * absent. Used to read the pseudo-XML envelopes the CLI emits for background
 * tasks and dynamic-workflow `<task-notification>` messages.
 */
export function parseXmlTag(text: string, tag: string): string | undefined {
    const match = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
    return match?.[1]?.trim();
}
