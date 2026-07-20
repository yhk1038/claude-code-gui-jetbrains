import {
  ContextAgentEntry,
  ContextMemoryEntry,
  ContextSkillEntry,
} from '@/utils/parseContextUsage';

/** A single leaf in a tree section: a name plus its verbatim token label. */
export interface TreeItem {
  name: string;
  tokensLabel: string;
  /** Full text for the hover title (e.g. an untruncated path). */
  title?: string;
}

/** A group of leaves under an optional group header (e.g. a Source bucket). */
export interface TreeGroup {
  label?: string;
  items: TreeItem[];
}

/**
 * Group entries by a key while preserving first-seen order — the CLI lists rows
 * in a deliberate order (Project before Plugin before Built-in, etc.) and we
 * must not reorder them (원본 데이터 보존 원칙).
 */
function groupByOrdered<T>(entries: T[], keyOf: (entry: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  return groups;
}

/** Custom Agents → one group per Source, each item labeled by agent name. */
export function buildAgentGroups(agents: ContextAgentEntry[]): TreeGroup[] {
  const grouped = groupByOrdered(agents, (a) => a.source || '—');
  return [...grouped.entries()].map(([label, rows]) => ({
    label,
    items: rows.map((a) => ({ name: a.name, tokensLabel: a.tokensLabel })),
  }));
}

/**
 * Rank a Skills Source into the native TUI's fixed group order:
 * Project → User → Plugin(*) → Built-in → anything else. Within the Plugin band
 * the individual plugin buckets ("Plugin (oh-my-claudecode)", …) keep their
 * first-seen order, since the sort below is stable.
 */
function skillSourceRank(source: string): number {
  if (source === 'Project') return 0;
  if (source === 'User') return 1;
  if (source.startsWith('Plugin')) return 2;
  if (source === 'Built-in') return 3;
  return 4;
}

/**
 * Skills → one group per Source, ordered by the native TUI's group precedence
 * (Project, User, Plugin, Built-in). The CLI markdown lists Sources interleaved,
 * so we group-by then stable-sort the buckets; item order within a bucket stays
 * as the CLI printed it.
 */
export function buildSkillGroups(skills: ContextSkillEntry[]): TreeGroup[] {
  const grouped = groupByOrdered(skills, (s) => s.source || '—');
  const groups = [...grouped.entries()].map(([label, rows]) => ({
    label,
    items: rows.map((s) => ({ name: s.name, tokensLabel: s.tokensLabel })),
  }));
  return groups.sort((a, b) => skillSourceRank(a.label ?? '') - skillSourceRank(b.label ?? ''));
}

/** Memory Files → a single unlabeled group whose leaves are file paths. */
export function buildMemoryGroups(files: ContextMemoryEntry[]): TreeGroup[] {
  if (files.length === 0) return [];
  return [
    {
      items: files.map((f) => ({ name: f.path, tokensLabel: f.tokensLabel, title: f.path })),
    },
  ];
}
