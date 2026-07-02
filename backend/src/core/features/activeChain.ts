/**
 * Filter messages to only include those in active conversation chains.
 * Ported from frontend filterActiveChain to allow backend-only pagination.
 */
export function filterActiveChain(messages: Record<string, any>[]): Record<string, any>[] {
  if (messages.length === 0) return messages;

  // Build uuid → message lookup
  const byUuid = new Map<string, Record<string, any>>();
  for (const msg of messages) {
    const uuid = msg.uuid as string | undefined;
    if (uuid) byUuid.set(uuid, msg);
  }

  // Find all child→parent references to identify leaf messages
  const hasChild = new Set<string>();
  for (const msg of messages) {
    const parentUuid = msg.parentUuid as string | undefined;
    if (parentUuid && byUuid.has(parentUuid)) {
      hasChild.add(parentUuid);
    }
  }

  // Find leaf messages (no message references them as parent)
  // For each leaf, trace back to root — collecting all active UUIDs
  const activeUuids = new Set<string>();
  for (const msg of messages) {
    const uuid = msg.uuid as string | undefined;
    if (!uuid) continue;
    if (hasChild.has(uuid)) continue; // not a leaf

    // Trace from this leaf backwards
    let current: Record<string, any> | undefined = msg;
    while (current) {
      const curUuid = current.uuid as string | undefined;
      if (curUuid) activeUuids.add(curUuid);
      const parentUuid = current.parentUuid as string | undefined;
      if (parentUuid && byUuid.has(parentUuid)) {
        current = byUuid.get(parentUuid);
      } else {
        break;
      }
    }
  }

  // Filter: keep messages in any active chain
  // progress and summary entries are always kept
  return messages.filter(msg => {
    const type = msg.type as string | undefined;
    if (type === 'progress' || type === 'summary') return true;
    const uuid = msg.uuid as string | undefined;
    return uuid ? activeUuids.has(uuid) : false;
  });
}
