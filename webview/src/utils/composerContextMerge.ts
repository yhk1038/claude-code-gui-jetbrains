import { Context, ContextType } from '../types';

export interface ComposerContextEntry {
  id: string;
  context: Context;
}

function generateComposerEntryId(): string {
  return `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Dedupe key for selection contexts (allows multiple ranges in the same file). */
export function composerContextDedupeKey(ctx: Context): string {
  if (ctx.type === ContextType.Selection) {
    return `selection:${ctx.path ?? ''}:${ctx.startLine ?? ''}:${ctx.endLine ?? ''}:${ctx.content}`;
  }
  return `${ctx.type}:${ctx.path ?? ''}:${ctx.content}`;
}

export function mergeIdeContextsIntoEntries(
  prev: ComposerContextEntry[],
  incoming: Context[],
): ComposerContextEntry[] {
  const next = [...prev];
  for (const ctx of incoming) {
    const key = composerContextDedupeKey(ctx);
    if (next.some(e => composerContextDedupeKey(e.context) === key)) continue;
    next.push({ id: generateComposerEntryId(), context: ctx });
  }
  return next;
}

export function appendComposerSelectionsToContent(base: string, selections: Context[]): string {
  const parts: string[] = [];
  const trimmedBase = base.trim();
  if (trimmedBase) parts.push(trimmedBase);

  for (const ctx of selections) {
    if (ctx.type !== ContextType.Selection) continue;
    const body = ctx.content?.trim();
    if (!body) continue;

    const rangeLabel =
      ctx.path &&
      ctx.startLine != null &&
      ctx.endLine != null
        ? `${ctx.path}:${ctx.startLine}-${ctx.endLine}`
        : (ctx.path || 'selection');

    parts.push(['```', rangeLabel, '\n', body, '\n```'].join(''));
  }

  return parts.join('\n\n');
}

export function canSubmitComposer(
  trimmedInput: string,
  contexts: Context[],
  attachments?: ReadonlyArray<unknown> | null,
): boolean {
  const selections = contexts.filter(c => c.type === ContextType.Selection);
  const effective = appendComposerSelectionsToContent(trimmedInput, selections);
  return effective.trim().length > 0 || (attachments?.length ?? 0) > 0;
}

export function normalizeIdeComposerContexts(raw: unknown): Context[] {
  if (!Array.isArray(raw)) return [];
  const out: Context[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const typeRaw = o.type;
    if (typeRaw !== 'selection' && typeRaw !== ContextType.Selection) continue;
    const path = typeof o.path === 'string' ? o.path : '';
    const content = typeof o.content === 'string' ? o.content : '';
    if (!content.trim()) continue;
    const startLine = typeof o.startLine === 'number' ? o.startLine : undefined;
    const endLine = typeof o.endLine === 'number' ? o.endLine : undefined;
    out.push({
      type: ContextType.Selection,
      path: path || undefined,
      content,
      startLine,
      endLine,
    });
  }
  return out;
}
