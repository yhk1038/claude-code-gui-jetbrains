/**
 * Parse the PID output of `lsof -t` / netstat and return the PIDs that are safe
 * to kill when reclaiming a port: valid positive integers, de-duplicated, and
 * excluding our own process.
 *
 * Critically, the *caller* must already have restricted the query to LISTENING
 * sockets (lsof `-sTCP:LISTEN`, netstat `LISTENING`). Without that restriction a
 * plain `lsof -ti :PORT` also returns processes merely *connected* to the port —
 * e.g. the IDE JVM's RPC WebSocket — and killing those takes the whole IDE down
 * (observed as exit 137 / SIGKILL). This helper is the second line of defence:
 * even if a connected PID slipped through, our own PID is filtered out here.
 */
export function selectKillablePids(rawPids: string, selfPid: number): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const line of rawPids.split('\n')) {
    const pid = parseInt(line.trim(), 10);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    if (pid === selfPid) continue;
    if (seen.has(pid)) continue;
    seen.add(pid);
    result.push(pid);
  }
  return result;
}
